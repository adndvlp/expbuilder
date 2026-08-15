import { chromium, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  preparePage,
  type RuntimeWindow,
} from "./localRuntimeTestHarness";

let browser: Browser;

describe("generated local runtime acknowledgement validation", () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("retains an event and refuses completion after malformed JSON", async () => {
    const page = await preparePage(browser, { malformedPutAck: true });
    await page.evaluate(() => {
      const settings = (window as RuntimeWindow).__settings!;
      settings.on_data_update({ trial_index: 0, answer: "must remain pending" });
    });
    await page.evaluate(async () => {
      const settings = (window as RuntimeWindow).__settings!;
      await settings.on_finish();
    });

    expect(await page.evaluate(
      () => (window as RuntimeWindow).__putAttempts?.(),
    )).toBeGreaterThanOrEqual(1);
    expect(await page.evaluate(
      () => (window as RuntimeWindow).__completionAttempts?.(),
    )).toBe(0);
    const records = await page.evaluate(async () => {
      const open = indexedDB.open("expbuilder-local-session-outbox-v1", 1);
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const transaction = database.transaction("trial-events", "readonly");
      const request = transaction.objectStore("trial-events").getAll();
      const stored = await new Promise<Array<Record<string, unknown>>>(
        (resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        },
      );
      database.close();
      return stored;
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: "pending",
      payload: { answer: "must remain pending" },
    });
    expect(await page.locator("#jspsych-loading-msg").textContent()).toContain(
      "remains on this device",
    );
    await page.close();
  });
});
