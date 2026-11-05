import { chromium, type Browser, type Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { receipt, responses, startPublicRuntime, trial, type Upload } from "./publicBatchTestHarness";

let browser: Browser;
async function pageFixture() {
  const context = await browser.newContext();
  await context.route("http://localhost/**", route => route.request().method() === "GET"
    ? route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }) : route.fallback());
  const page = await context.newPage();
  await page.goto("http://localhost/");
  return { context, page };
}
const drain = (page: Page) => page.evaluate(async () => { await Promise.all(window.publicBatchTest.pending); });

describe("public batches with real IndexedDB", () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined }); });
  afterAll(async () => { await browser?.close(); });

  it("H02: overlapping responses are uploaded once each, and only acknowledged records are removed", async () => {
    const { context, page } = await pageFixture();
    try {
      const uploads: Upload[] = [];
      let release!: () => void;
      const blocked = new Promise<void>(resolve => { release = resolve; });
      let firstArrived!: () => void;
      const firstRequest = new Promise<void>(resolve => { firstArrived = resolve; });
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload;
        uploads.push(body);
        if (uploads.length === 1) { firstArrived(); await blocked; }
        await route.fulfill({ json: receipt(body) });
      });
      await startPublicRuntime(page);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A"));
      await firstRequest;
      await page.evaluate(data => window.publicBatchTest.call(data), trial("B", 1));
      await page.waitForFunction(() => window.publicBatchTest.acknowledged.length === 2);
      // Queue readonly transactions behind the pending batch-selection reads.
      await page.evaluate(async () => {
        await window.publicBatchTest.db.getAll();
        await window.publicBatchTest.db.getAll();
      });
      release();
      await drain(page);
      expect(uploads.flatMap(responses)).toEqual(["A", "B"]);
      expect(await page.evaluate(() => window.publicBatchTest.db.count())).toBe(0);
    } finally { await context.close(); }
  });

  it.each(["missing", "false", "wrong-session", "wrong-hash", "wrong-sequence"])("keeps a batch pending after a %s acknowledgement", async mode => {
    const { context, page } = await pageFixture();
    try {
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload;
        const result = receipt(body);
        if (mode === "missing") result.acknowledged = [];
        if (mode === "false") result.success = false;
        if (mode === "wrong-session") result.sessionId = "another-session";
        if (mode === "wrong-hash" && result.acknowledged[0]) result.acknowledged[0].payloadHash = "wrong";
        if (mode === "wrong-sequence" && result.acknowledged[0]) result.acknowledged[0].sequence = 123;
        await route.fulfill({ json: result });
      });
      await startPublicRuntime(page);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A"));
      await drain(page);
      expect(await page.evaluate(() => window.publicBatchTest.db.count())).toBe(1);
      expect(await page.evaluate(() => window.publicBatchTest.errors.length)).toBeGreaterThan(0);
    } finally { await context.close(); }
  });

  it("reuses an event identity after the server receives it but the HTTP response is lost, including reload", async () => {
    const { context, page } = await pageFixture();
    try {
      const uploads: Upload[] = [];
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload;
        uploads.push(body);
        if (uploads.length === 1) await route.abort("failed");
        else await route.fulfill({ json: receipt(body) });
      });
      await startPublicRuntime(page);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A"));
      await drain(page);
      await page.reload();
      await startPublicRuntime(page);
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(uploads).toHaveLength(2);
      expect(uploads[0].action).toBe("appendEvents");
      expect(uploads[0].data.events?.[0]).toEqual(uploads[1].data.events?.[0]);
      expect(uploads[0].data.events?.[0].eventId).toEqual(expect.any(String));
      expect(await page.evaluate(() => window.publicBatchTest.db.count())).toBe(0);
    } finally { await context.close(); }
  });

  it("flushes a final remainder without duplicating an in-flight batch", async () => {
    const { context, page } = await pageFixture();
    try {
      const uploads: Upload[] = [];
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload;
        uploads.push(body); await route.fulfill({ json: receipt(body) });
      });
      await startPublicRuntime(page, 2);
      await page.evaluate(rows => rows.forEach(row => window.publicBatchTest.call(row)), [trial("A"), trial("B", 1), trial("C", 2)]);
      await drain(page);
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(uploads.flatMap(responses)).toEqual(["A", "B", "C"]);
      expect(await page.evaluate(() => window.publicBatchTest.db.count())).toBe(0);
    } finally { await context.close(); }
  });

  it("keeps event sequences stable after deleting confirmed records and reopening the database", async () => {
    const { context, page } = await pageFixture();
    try {
      const uploads: Upload[] = [];
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload;
        uploads.push(body); await route.fulfill({ json: receipt(body) });
      });
      await startPublicRuntime(page);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A"));
      await drain(page);
      await page.reload();
      await startPublicRuntime(page);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("B", 1));
      await drain(page);
      expect(uploads.map(body => body.data.events?.[0].sequence)).toEqual([0, 1]);
      expect(uploads[0].data.events?.[0].eventId).not.toBe(uploads[1].data.events?.[0].eventId);
    } finally { await context.close(); }
  });

  it("splits a large configured batch by bytes without dropping its events", async () => {
    const { context, page } = await pageFixture();
    try {
      const uploads: Upload[] = [];
      const bytes: number[] = [];
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload;
        uploads.push(body); bytes.push(Buffer.byteLength(route.request().postData()!));
        await route.fulfill({ json: receipt(body) });
      });
      await startPublicRuntime(page, 4);
      const rows = ["A", "B", "C", "D"].map((id, index) => ({ ...trial(id, index), response: id.repeat(300_000) }));
      await page.evaluate(data => data.forEach(row => window.publicBatchTest.call(row)), rows);
      await drain(page);
      expect(uploads.flatMap(responses)).toEqual(["A", "B", "C", "D"]);
      expect(bytes.length).toBeGreaterThan(1);
      expect(Math.max(...bytes)).toBeLessThan(1_000_000);
    } finally { await context.close(); }
  });

  it("preserves batch-zero data when the direct-upload response does not confirm success", async () => {
    const { context, page } = await pageFixture();
    try {
      await page.route("**/apiDataComplete", route => route.fulfill({ json: { success: false } }));
      await startPublicRuntime(page, 0);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A"));
      await drain(page);
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(await page.evaluate(() => window.publicBatchTest.db.count())).toBe(1);
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(false);
    } finally { await context.close(); }
  });

  it("deletes only the batch-zero snapshot that was acknowledged, preserving later writes", async () => {
    const { context, page } = await pageFixture();
    try {
      let release!: () => void, arrived!: () => void;
      const blocked = new Promise<void>(resolve => { release = resolve; });
      const request = new Promise<void>(resolve => { arrived = resolve; });
      await page.route("**/apiDataComplete", async route => {
        arrived(); await blocked; await route.fulfill({ json: { success: true } });
      });
      await startPublicRuntime(page, 0);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A"));
      await drain(page);
      const finishing = page.evaluate(() => window.publicBatchTest.finish());
      await request;
      await page.evaluate(data => window.publicBatchTest.call(data), trial("B", 1));
      await drain(page);
      release(); await finishing;
      const pending = await page.evaluate(() => window.publicBatchTest.db.getAll());
      expect(pending.map(row => row.builder_id)).toEqual(["B"]);
    } finally { await context.close(); }
  });

  it("uses the same receipt contract without IndexedDB and retries a lost response with the same identity", async () => {
    const { context, page } = await pageFixture();
    try {
      const uploads: Upload[] = [];
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload;
        uploads.push(body);
        if (uploads.length === 1) await route.abort("failed");
        else await route.fulfill({ json: receipt(body) });
      });
      await startPublicRuntime(page, 1, false);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A"));
      await drain(page);
      await page.evaluate(data => window.publicBatchTest.call(data), trial("B", 1));
      await drain(page);
      expect(uploads.map(body => body.action)).toEqual(["appendEvents", "appendEvents", "appendEvents"]);
      expect(uploads[0].data.events?.[0]).toEqual(uploads[1].data.events?.[0]);
      expect(uploads.flatMap(responses)).toEqual(["A", "A", "B"]);
      expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
    } finally { await context.close(); }
  });

  it("does not acknowledge a local write whose transaction aborts after its add request succeeds", async () => {
    const { context, page } = await pageFixture();
    try {
      await startPublicRuntime(page);
      await page.evaluate(() => {
        const add = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.add = function(value, key) {
          const request = add.call(this, value, key);
          if (this.name === "trials") request.addEventListener("success", () => this.transaction.abort(), { once: true });
          return request;
        };
      });
      await page.evaluate(data => window.publicBatchTest.call(data), trial("A"));
      await drain(page);
      expect(await page.evaluate(() => window.publicBatchTest.acknowledged)).toEqual([]);
      expect(await page.evaluate(() => window.publicBatchTest.db.count())).toBe(0);
    } finally { await context.close(); }
  });

  it("upgrades pending v1 records in place before resending them with stable identities", async () => {
    const { context, page } = await pageFixture();
    try {
      await page.evaluate(() => new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("expbuilder:public:batch-test:trials-v1", 1);
        open.onupgradeneeded = () => {
          const store = open.result.createObjectStore("trials", { keyPath: "id", autoIncrement: true });
          ["createdAt", "sessionId", "timestamp"].forEach(name => store.createIndex(name, name));
        };
        open.onsuccess = () => {
          const tx = open.result.transaction("trials", "readwrite");
          tx.objectStore("trials").add({ builder_id: "A", response: "A", trial_type: "test", sessionId: "S1", createdAt: Date.now() });
          tx.oncomplete = () => { open.result.close(); resolve(); };
          tx.onabort = () => reject(tx.error);
        };
      }));
      const uploads: Upload[] = [];
      await page.route("**/apiData", async route => {
        const body = route.request().postDataJSON() as Upload;
        uploads.push(body); await route.fulfill({ json: receipt(body) });
      });
      await startPublicRuntime(page);
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(uploads.flatMap(responses)).toEqual(["A"]);
      expect(uploads[0].data.events?.[0]).toMatchObject({ sequence: 0, eventId: expect.any(String) });
      expect(await page.evaluate(() => window.publicBatchTest.db.count())).toBe(0);
    } finally { await context.close(); }
  });
});
