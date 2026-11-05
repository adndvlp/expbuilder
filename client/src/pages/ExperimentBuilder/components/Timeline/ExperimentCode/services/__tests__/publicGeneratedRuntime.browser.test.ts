import { chromium, type Browser } from "@playwright/test";
import path from "node:path";
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
        onDisconnect: () => ({ update: async () => {}, cancel: async () => {} }) }) }), { ServerValue: { TIMESTAMP: 1 } });
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
        if (!body.action) {
          await route.fulfill({ json: { success: true, participantNumber: 0, receivedEvents: [], resumeCheckpoint: null } }); return;
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
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload; uploads.push(body);
        await route.fulfill({ json: body.action ? receipt(body) : {
          success: true, participantNumber: 23, receivedEvents: [0, 1].map(sequence => ({ eventId: 'saved-' + sequence,
            sequence, payloadHash: String(sequence).repeat(64) })), resumeCheckpoint: null, lifecycle: "completed",
        } });
      });
      await page.addScriptTag({ content: code(false, true) });
      await page.waitForFunction(() => (window as unknown as { __complete: boolean }).__complete);
      expect(await page.evaluate(() => (window as unknown as { __started: number[] }).__started)).toEqual([]);
      expect(uploads.at(-1)).toMatchObject({ action: "completeSession", expectedEventCount: 2 });
    } finally { await context.close(); }
  });
});
