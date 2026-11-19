import { chromium, type Browser, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { receipt, startPublicRuntime, trial, type Upload } from "./publicBatchTestHarness";

let browser: Browser;
const drain = (page: Page) => page.evaluate(async () => { await Promise.all(window.publicBatchTest.pending); });
async function fixture() {
  const context = await browser.newContext();
  await context.route("http://localhost/**", route => route.request().method() === "GET"
    ? route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }) : route.fallback());
  const page = await context.newPage(); await page.goto("http://localhost/");
  return { context, page };
}
describe("backed checkpoints and verified closure", () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined }); });
  afterAll(async () => { await browser?.close(); });

  it("H03: a failed local transaction cannot advance the checkpoint or report completion", async () => {
    const { context, page } = await fixture();
    try {
      await startPublicRuntime(page, 0);
      await page.evaluate(() => {
        const add = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.add = function(value, key) {
          const request = add.call(this, value, key);
          if (this.name === "trials") request.addEventListener("success", () => this.transaction.abort(), { once: true });
          return request;
        };
      });
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A")); await drain(page);
      expect(await page.evaluate(() => localStorage.getItem("checkpoint"))).toBeNull();
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(false);
      expect(await page.evaluate(() => window.publicBatchTest.resumes)).toBe(0);
      expect(await page.evaluate(() => window.publicBatchTest.db.getState())).toMatchObject({ events: [] });
    } finally { await context.close(); }
  });

  it("does not turn a checkpoint preparation error into an empty successful completion", async () => {
    const { context, page } = await fixture();
    try {
      await page.route("**/apiData", route => route.fulfill({ json: receipt(route.request().postDataJSON()) }));
      await startPublicRuntime(page, 0);
      await page.evaluate(() => { window.publicBatchTest.checkpoint = () => { throw new Error('Cannot capture route'); }; });
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A")); await drain(page);
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(false);
      expect(await page.evaluate(() => window.publicBatchTest.resumes)).toBe(0);
    } finally { await context.close(); }
  });

  it("keeps a committed checkpoint in IndexedDB if its localStorage mirror fails", async () => {
    const { context, page } = await fixture();
    try {
      await startPublicRuntime(page, 0);
      await page.evaluate(() => {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (key === 'checkpoint') throw new DOMException('Quota exceeded', 'QuotaExceededError');
          return set.call(this, key, value);
        };
      });
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A")); await drain(page);
      expect(await page.evaluate(() => window.publicBatchTest.db.getState())).toMatchObject({
        checkpoint: { completed: "A" }, events: [expect.objectContaining({ sequence: 0 })],
      });
      expect(await page.evaluate(() => localStorage.getItem('checkpoint'))).toBeNull();
      expect(await page.evaluate(() => window.publicBatchTest.resumes)).toBe(1);
    } finally { await context.close(); }
  });

  it.each([true, false])("binds the backed checkpoint to its event identity in %s mode", async indexed => {
    const { context, page } = await fixture();
    try {
      const uploads: Upload[] = [];
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload; uploads.push(body);
        await route.fulfill({ json: receipt(body) });
      });
      await startPublicRuntime(page, 1, indexed);
      await page.evaluate(() => {
        window.publicBatchTest.checkpoint = data => ({ completed: { builderId: data.builder_id, trialIndex: data.trial_index } });
      });
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A")); await drain(page);
      const saved = uploads[0].data.events![0];
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('checkpoint')!).completed)).toEqual({
        builderId: 'A', trialIndex: 0, eventId: saved.eventId, sequence: saved.sequence,
      });
      if (indexed) expect(await page.evaluate(() => window.publicBatchTest.db.getState())).toMatchObject({
        checkpoint: { completed: { eventId: saved.eventId, sequence: saved.sequence } },
      });
    } finally { await context.close(); }
  });

  it("without IndexedDB, pauses advancement and checkpoints only the acknowledged response", async () => {
    const { context, page } = await fixture();
    let release!: () => void;
    try {
      let arrived!: () => void;
      const entered = new Promise<void>(resolve => { arrived = resolve; });
      const blocked = new Promise<void>(resolve => { release = resolve; });
      await page.route("**/apiData", async route => {
        arrived(); await blocked; await route.fulfill({ json: receipt(route.request().postDataJSON()) });
      });
      await startPublicRuntime(page, 1, false);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A")); await entered;
      expect(await page.evaluate(() => localStorage.getItem("checkpoint"))).toBeNull();
      expect(await page.evaluate(() => window.publicBatchTest.pauses)).toBe(1);
      expect(await page.evaluate(() => window.publicBatchTest.resumes)).toBe(0);
      release(); await drain(page);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("checkpoint")!))).toEqual({ completed: "A" });
      expect(await page.evaluate(() => window.publicBatchTest.resumes)).toBe(1);
    } finally { release?.(); await context.close(); }
  });

  it("H04: waits for a delayed last write, verifies its event set, then marks the session finished", async () => {
    const { context, page } = await fixture();
    let release!: () => void;
    try {
      const uploads: Upload[] = [];
      let arrived!: () => void;
      const entered = new Promise<void>(resolve => { arrived = resolve; });
      const blocked = new Promise<void>(resolve => { release = resolve; });
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload; uploads.push(body);
        if (body.action === "appendEvents") { arrived(); await blocked; }
        await route.fulfill({ json: receipt(body) });
      });
      await startPublicRuntime(page, 1, false);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A")); await entered;
      const finishing = page.evaluate(() => window.publicBatchTest.finish());
      await page.waitForTimeout(50);
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(false);
      expect(uploads.map(body => body.action)).toEqual(["appendEvents"]);
      expect(await page.evaluate(() => window.publicBatchTest.updates.some(update => update.finished))).toBe(false);
      release(); await finishing;
      const event = uploads[0].data.events![0];
      const eventsHash = createHash("sha256").update(JSON.stringify([
        { eventId: event.eventId, payloadHash: event.payloadHash, sequence: event.sequence },
      ])).digest("hex");
      expect(uploads[1]).toMatchObject({ action: "completeSession", expectedEventCount: 1, expectedLastSequence: 0, eventsHash });
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(true);
      expect(await page.evaluate(() => window.publicBatchTest.updates.at(-1))).toMatchObject({ finished: true, needsFinalization: false });
    } finally { release?.(); await context.close(); }
  });

  it.each(["unconfirmed", "wrong-hash", "wrong-count", "wrong-session"])("does not report success on a %s provider receipt", async mode => {
    const { context, page } = await fixture();
    try {
      let completions = 0;
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload, result = receipt(body);
        if (result.completion) {
          completions++;
          if (mode === "unconfirmed") result.completion.confirmed = false;
          if (mode === "wrong-hash") result.completion.eventsHash = "wrong";
          if (mode === "wrong-count") result.completion.expectedEventCount = 100;
          if (mode === "wrong-session") result.sessionId = "another-session";
        }
        await route.fulfill({ status: mode === "unconfirmed" && result.completion ? 202 : 200, json: result });
      });
      await startPublicRuntime(page, 0);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A")); await drain(page);
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(completions).toBe(1);
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(false);
      expect(await page.evaluate(() => window.publicBatchTest.updates.some(update => update.finished))).toBe(false);
    } finally { await context.close(); }
  });

  it("H05: batch zero uses the common event path and retains its manifest after payload removal and reload", async () => {
    const { context, page } = await fixture();
    try {
      const uploads: Upload[] = [];
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload; uploads.push(body);
        const result = receipt(body);
        if (result.completion && uploads.length === 2) result.completion.confirmed = false;
        await route.fulfill({ json: result });
      });
      await startPublicRuntime(page, 0);
      await page.evaluate(rows => rows.forEach(row => window.publicBatchTest.call(row)), [trial("A"), trial("B", 1)]);
      await drain(page); expect(uploads).toHaveLength(0);
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(uploads.map(body => body.action)).toEqual(["appendEvents", "completeSession"]);
      expect(uploads[1]).toMatchObject({ expectedEventCount: 2, expectedLastSequence: 1 });
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(false);
      await page.reload(); await startPublicRuntime(page, 0);
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(uploads[2]).toMatchObject({ action: "completeSession", eventsHash: uploads[1].eventsHash, expectedEventCount: 2 });
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(true);
    } finally { await context.close(); }
  });
});
