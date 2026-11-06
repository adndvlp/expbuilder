import { chromium, type Browser } from "@playwright/test";
import path from "node:path";
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPublicExperimentCode } from "../buildPublicExperimentCode";
import type { PublicExperimentCodeOptions } from "../publicCodeTypes";
import { receipt, type Upload } from "./publicBatchTestHarness";

let browser: Browser;
function code(indexed: boolean, closed = false) {
  return buildPublicExperimentCode({
    DATA_API_URL: "/apiData", FIREBASE_DATABASE_URL: "https://example.invalid",
    experimentID: "generated-runtime", useStorage: "googledrive",
    batchConfig: { useIndexedDB: indexed, batchSize: 1, resumeTimeoutMinutes: 1 },
    recruitmentConfig: { platform: "none", prolificCompletionCode: "" },
    captchaConfig: { enabled: false, provider: "hcaptcha", siteKey: "" },
    sessionNameTokens: [], sessionNameSeparator: "_", currentUid: "owner",
    evaluateCondition: "", branchingEvaluation: "", customPreInitCode: { local: "", public: "" },
    publicParams: { on_finish: "window.__complete = true;" }, extensions: "", progressBar: false,
    baseCode: `
      const branchParameters = null; if (branchParameters) Object.entries(branchParameters);
      class AutoTrial {
        static info = { name: 'auto', version: '1', parameters: {}, data: {} };
        constructor(instance) { this.instance = instance; }
        trial() { const id = window.__started.length + 1; window.__started.push(id); this.instance.finishTrial({ response: id }); }
      }
      ${closed ? "throw new Error('A closed session must not run any trial');" : ""}
      jsPsych.run([1, 2].map(id => ({ type: AutoTrial, data: { builder_id: id, trial_id: id } })));
    `,
  } as PublicExperimentCodeOptions);
}
describe("generated public runtime with real jsPsych", () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined }); });
  afterAll(async () => { await browser?.close(); });

  async function fixture() {
    const context = await browser.newContext();
    await context.route("http://localhost/**", route => route.request().method() === "GET"
      ? route.fulfill({ contentType: "text/html", body: '<html><body><div id="jspsych-container"></div></body></html>' }) : route.fallback());
    const page = await context.newPage(); await page.goto("http://localhost/");
    await page.addScriptTag({ path: path.resolve("../server/jspsych-bundle/index.js") });
    await page.evaluate(() => {
      const target = window as unknown as Record<string, unknown>;
      target.__started = []; target.__complete = false; target.__updates = [];
      const database = Object.assign(() => ({ ref: () => ({ set: async () => {},
        update: async (value: unknown) => (target.__updates as unknown[]).push(value),
        on: (_event: string, callback: (value: { val(): boolean }) => void) => callback({ val: () => true }),
        onDisconnect: () => ({ set: async () => {}, update: async () => {}, cancel: async () => {} }) }) }), { ServerValue: { TIMESTAMP: 1 } });
      target.firebase = { apps: [{}], database };
    });
    return { context, page };
  }
  it.each([true, false])("waits for %s mode's backup before advancing and for verified storage before success", async indexed => {
    const { context, page } = await fixture();
    let release!: () => void;
    try {
      const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
      let arrived!: () => void;
      const entered = new Promise<void>(resolve => { arrived = resolve; });
      const blocked = new Promise<void>(resolve => { release = resolve; });
      const uploads: Upload[] = [];
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload;
        if (['createSession', 'resumeSession', 'activateConnection'].includes(body.action || '')) {
          await route.fulfill({ json: { success: true, decision: 'resume_allowed', sessionProtocolVersion: 3,
            participantNumber: 0, receivedEvents: [], resumeCheckpoint: null, lifecycle: 'active',
            connection: { id: 'C1', generation: 1, phase: body.action === 'activateConnection' ? 'active' : 'connecting' } } }); return;
        }
        uploads.push(body);
        if (uploads.length === 1) { arrived(); await blocked; }
        await route.fulfill({ json: receipt(body) });
      });
      await page.addScriptTag({ content: code(indexed) }); await entered;
      if (indexed) await page.waitForFunction(() => (window as unknown as { __started: number[] }).__started.length === 2);
      const state = await page.evaluate(() => {
        const target = window as unknown as { __started: number[]; __complete: boolean; __updates: Record<string, unknown>[] };
        return { started: target.__started, complete: target.__complete, finished: target.__updates.some(update => update.finished) };
      });
      expect(state).toEqual({ started: indexed ? [1, 2] : [1], complete: false, finished: false });
      release();
      await page.waitForFunction(() => (window as unknown as { __complete: boolean }).__complete);
      expect(uploads.filter(body => body.action === "appendEvents").flatMap(body => body.data.events?.map(event => event.sequence))).toEqual([0, 1]);
      expect(uploads.at(-1)).toMatchObject({ action: "completeSession", expectedEventCount: 2 });
      expect(errors).toEqual([]);
    } finally { release?.(); await context.close(); }
  });
  it("retries a previously closed session without running its timeline", async () => {
    const { context, page } = await fixture();
    try {
      const uploads: Upload[] = [];
      const receivedEvents = [0, 1].map(sequence => ({ eventId: 'saved-' + sequence, sequence, payloadHash: String(sequence).repeat(64) }));
      const eventsHash = createHash('sha256').update(JSON.stringify(receivedEvents.map(({ eventId, payloadHash, sequence }) => ({ eventId, payloadHash, sequence })))).digest('hex');
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload; uploads.push(body);
        await route.fulfill({ json: !['createSession', 'resumeSession'].includes(body.action || '') ? { success: true, experimentID: body.experimentID, sessionId: body.sessionId,
          export: { status: 'confirmed', confirmed: true, revision: 1, requestedRevision: 1, confirmedRevision: 1, eventCount: 2, eventsHash },
        } : {
          success: true, decision: 'session_completed', sessionProtocolVersion: 3, participantNumber: 23, receivedEvents, resumeCheckpoint: null, lifecycle: "completed",
        } });
      });
      await page.addScriptTag({ content: code(false, true) });
      await page.waitForFunction(() => (window as unknown as { __complete: boolean }).__complete);
      expect(await page.evaluate(() => (window as unknown as { __started: number[] }).__started)).toEqual([]);
      expect(uploads.at(-1)).toMatchObject({ action: 'sessionStatus' });
      expect(uploads.some(body => body.action === 'completeSession')).toBe(false);
    } finally { await context.close(); }
  });
  it("expires during a blocked response, recovers it into the old session and requires a choice before starting another", async () => {
    const { context, page } = await fixture(); let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    try {
      const uploads: Upload[] = []; let sessionId = '', received: Upload['data']['events'] = [];
      await page.route('**/apiData', async route => {
        const body = route.request().postDataJSON() as Upload; uploads.push(body); sessionId ||= body.sessionId;
        if (['createSession', 'activateConnection'].includes(body.action || '')) {
          await route.fulfill({ json: { success: true, sessionProtocolVersion: 3, decision: 'resume_allowed', lifecycle: 'active', participantNumber: 0,
            receivedEvents: [], connection: { id: 'C1', generation: 1, phase: body.action === 'activateConnection' ? 'active' : 'connecting' } } }); return;
        }
        if (body.action === 'appendEvents') {
          await route.fulfill({ status: 409, json: { success: false, lifecycle: 'expired', decision: 'session_expired' } }); return;
        }
        if (body.action === 'recoverEvents') { received = body.data.events; await route.fulfill({ json: receipt(body) }); return; }
        await blocked;
        const eventsHash = createHash('sha256').update(JSON.stringify(received!.map(({ eventId, payloadHash, sequence }) => ({ eventId, payloadHash, sequence })))).digest('hex');
        await route.fulfill({ json: { success: true, experimentID: body.experimentID, sessionId: body.sessionId, lifecycle: 'expired',
          export: { confirmed: true, status: 'confirmed', eventCount: 1, eventsHash, requestedRevision: 1, confirmedRevision: 1 } } });
      });
      await page.addScriptTag({ content: code(false) });
      await page.locator('#expbuilder-expired-session').waitFor();
      expect(await page.getByRole('button', { name: 'Start a new participation' }).count()).toBe(1);
      await page.locator('[data-new-session]:not([disabled])').waitFor();
      expect(await page.evaluate(() => (window as unknown as { __started: number[] }).__started)).toEqual([1]);
      expect(uploads.filter(body => body.action === 'createSession')).toHaveLength(1);
      expect(uploads.filter(body => body.action === 'recoverEvents')).toHaveLength(1);
      expect(uploads.every(body => body.sessionId === sessionId)).toBe(true);
      expect(uploads.some(body => body.action === 'completeSession')).toBe(false);
      release();
    } finally { release?.(); await context.close(); }
  });

  it('offers a new participation after expiry while the earlier storage export is still pending', async () => {
    const { context, page } = await fixture(); let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    try {
      const receivedEvents = [{ eventId: 'old-0', sequence: 0, payloadHash: 'a'.repeat(64) }];
      const eventsHash = createHash('sha256').update(JSON.stringify(receivedEvents.map(({ eventId, payloadHash, sequence }) => ({ eventId, payloadHash, sequence })))).digest('hex');
      await page.route('**/apiData', async route => {
        const body = route.request().postDataJSON() as Upload;
        if (body.action === 'createSession') {
          await route.fulfill({ json: { success: true, decision: 'session_expired', sessionProtocolVersion: 3, lifecycle: 'expired', participantNumber: 0, receivedEvents } }); return;
        }
        await blocked;
        await route.fulfill({ json: { success: true, experimentID: body.experimentID, sessionId: body.sessionId, lifecycle: 'expired',
          export: { confirmed: true, status: 'confirmed', eventCount: 1, eventsHash, requestedRevision: 1, confirmedRevision: 1 } } });
      });
      await page.addScriptTag({ content: code(false, true) });
      const choice = page.getByRole('button', { name: 'Start a new participation' });
      await choice.waitFor(); expect(await choice.isEnabled()).toBe(true);
      expect(await page.evaluate(() => (window as unknown as { __started: number[] }).__started)).toEqual([]);
      release();
      await page.getByText('This session has ended. The available responses have been saved.').waitFor();
      expect(await page.getByRole('button', { name: 'Start a new participation' }).count()).toBe(1);
    } finally { release?.(); await context.close(); }
  });

});
