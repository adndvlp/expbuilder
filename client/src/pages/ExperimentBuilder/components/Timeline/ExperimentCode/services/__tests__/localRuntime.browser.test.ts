import {
  chromium,
  type Browser,
} from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generatedCode,
  preparePage,
  prepareSharedPage,
  type RuntimeWindow,
} from "./localRuntimeTestHarness";

let browser: Browser;

describe("generated local runtime in Chromium", () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("keeps the experiment independent from Socket.IO availability", async () => {
    const page = await preparePage(browser);
    expect(await page.evaluate(() => (window as unknown as { __started: boolean }).__started)).toBe(true);
    await page.close();
  });

  it("retries failed PUTs and finishes without duplicates", async () => {
    const page = await preparePage(browser, { failures: 2 });
    await page.evaluate(() => {
      const settings = (window as unknown as { __settings: Record<string, (data?: unknown) => unknown> }).__settings;
      settings.on_data_update({ trial_index: 0, answer: "kept" });
    });
    await page.evaluate(async () => {
      const settings = (window as unknown as { __settings: Record<string, () => Promise<void>> }).__settings;
      await settings.on_finish();
    });
    expect(await page.evaluate(() => (window as unknown as { __putAttempts: () => number }).__putAttempts())).toBe(3);
    const message = await page.evaluate(
      () => (window as unknown as { __message?: string }).__message || "",
    );
    expect(message).not.toContain("safe on this device");
    await page.close();
  });

  it("keeps failed results in IndexedDB and replays them after reload", async () => {
    const page = await preparePage(browser, { permanentFailure: true });
    await page.evaluate(() => {
      const settings = (window as unknown as { __settings: Record<string, (data?: unknown) => unknown> }).__settings;
      settings.on_data_update({ trial_index: 0, answer: "survives-reload" });
    });
    await page.evaluate(async () => {
      const settings = (window as unknown as { __settings: Record<string, () => Promise<void>> }).__settings;
      await settings.on_finish();
    });
    const failedAttempts = await page.evaluate(
      () => (window as unknown as { __putAttempts: () => number }).__putAttempts(),
    );
    expect(failedAttempts).toBeGreaterThanOrEqual(3);

    await Promise.all([
      page.waitForNavigation(),
      page.evaluate(() => window.location.reload()),
    ]);
    await page.evaluate(
      ({ code }) => {
        let putAttempts = 0;
        const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
          const method = init?.method || "GET";
          const sessionId = localStorage.getItem("expbuilder:local:browser-exp:session-id");
          if (method === "GET") {
            return new Response(JSON.stringify({ sessions: [{
              experimentID: "browser-exp",
              sessionId,
              participantNumber: 1,
              storedEventCount: 0,
              lastSequence: -1,
              sequenceTracked: true,
              state: "in-progress",
              createdAt: new Date().toISOString(),
            }] }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          if (method === "PUT") {
            putAttempts += 1;
            const body = JSON.parse(String(init?.body));
            return new Response(JSON.stringify({
              success: true,
              eventId: body.eventId,
              sequence: body.sequence,
              storedCount: Number(body.sequence) + 1,
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        };
        Object.assign(window, {
          fetch: fetchMock,
          __putAttempts: () => putAttempts,
          _hideLoading: () => undefined,
          _setLoadingMsg: () => undefined,
          initJsPsych: (settings: Record<string, unknown>) => {
            (window as unknown as { __settings: Record<string, unknown> }).__settings = settings;
            return { run: () => Promise.resolve() };
          },
        });
        new Function(code)();
      },
      { code: generatedCode() },
    );
    await page.waitForFunction(
      () => (window as unknown as { __putAttempts: () => number }).__putAttempts?.() === 1,
    );
    expect(await page.evaluate(() => (window as unknown as { __putAttempts: () => number }).__putAttempts())).toBe(1);
    await page.close();
  });

  it("creates independent sessions in two tabs sharing the same origin", async () => {
    const context = await browser.newContext();
    await context.route("http://tabs.test/**", async (route) => {
      if (route.request().url().includes("socket.io/socket.io.js")) {
        await route.abort();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><head></head><body></body></html>",
      });
    });

    const first = await prepareSharedPage(context, 1);
    const second = await prepareSharedPage(context, 2);
    const firstId = await first.evaluate(
      () => (window as RuntimeWindow & { JSPSYCH_SESSION_ID: string }).JSPSYCH_SESSION_ID,
    );
    const secondId = await second.evaluate(
      () => (window as RuntimeWindow & { JSPSYCH_SESSION_ID: string }).JSPSYCH_SESSION_ID,
    );

    expect(firstId).not.toBe(secondId);
    expect(await first.evaluate(() => sessionStorage.getItem(
      "expbuilder:local:browser-exp:tab-session-id",
    ))).toBe(firstId);
    expect(await second.evaluate(() => sessionStorage.getItem(
      "expbuilder:local:browser-exp:tab-session-id",
    ))).toBe(secondId);
    await context.close();
  });

  it("lets only one simultaneous tab claim a recoverable session", async () => {
    const context = await browser.newContext();
    await context.route("http://tabs.test/**", async (route) => {
      if (route.request().url().includes("socket.io/socket.io.js")) {
        await route.abort();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><head></head><body></body></html>",
      });
    });
    const seed = await context.newPage();
    await seed.goto("http://tabs.test/");
    await seed.evaluate(() => {
      localStorage.setItem(
        "expbuilder:local:browser-exp:session-id",
        "recoverable-session",
      );
      localStorage.setItem(
        "expbuilder:local:browser-exp:owner",
        "closed-tab",
      );
    });
    await seed.close();

    const [first, second] = await Promise.all([
      prepareSharedPage(context, 2, "recoverable-session"),
      prepareSharedPage(context, 3, "recoverable-session"),
    ]);
    const ids = await Promise.all(
      [first, second].map((page) => page.evaluate(
        () => (window as RuntimeWindow & { JSPSYCH_SESSION_ID: string })
          .JSPSYCH_SESSION_ID,
      )),
    );

    expect(ids.filter((id) => id === "recoverable-session")).toHaveLength(1);
    expect(new Set(ids)).toHaveProperty("size", 2);
    await context.close();
  });

  it("continues sequence and completion counts from a persisted session", async () => {
    const page = await preparePage(browser, { recoverStoredSession: true });
    await page.evaluate(() => {
      const settings = (window as RuntimeWindow).__settings!;
      settings.on_data_update({ trial_index: 2, answer: "continued" });
    });
    await page.evaluate(async () => {
      const settings = (window as RuntimeWindow).__settings!;
      await settings.on_finish();
    });

    const result = await page.evaluate(() => ({
      puts: (window as RuntimeWindow).__putBodies,
      completions: (window as RuntimeWindow).__completionBodies,
    }));
    expect(result.puts?.at(-1)).toMatchObject({ sequence: 2 });
    expect(result.completions?.at(-1)).toMatchObject({
      expectedEventCount: 3,
      lastSequence: 2,
    });
    await page.close();
  });

  it("never calls completion when the first IndexedDB write cannot commit", async () => {
    const page = await preparePage(browser);
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = function() {
        throw new Error("simulated IndexedDB failure");
      };
      const settings = (window as RuntimeWindow).__settings!;
      settings.on_data_update({ trial_index: 0, answer: "must-not-disappear" });
    });
    await page.evaluate(async () => {
      const settings = (window as RuntimeWindow).__settings!;
      await settings.on_finish();
    });

    expect(await page.evaluate(
      () => (window as RuntimeWindow).__completionAttempts?.(),
    )).toBe(0);
    expect(await page.locator("#jspsych-loading-msg").textContent()).toContain(
      "remains on this device",
    );
    await page.close();
  });

  it("recovers a transient first IndexedDB failure before completion", async () => {
    const page = await preparePage(browser);
    await page.evaluate(() => {
      const originalPut = IDBObjectStore.prototype.put;
      let failures = 1;
      IDBObjectStore.prototype.put = function(...args) {
        if (failures > 0) {
          failures -= 1;
          throw new Error("transient IndexedDB failure");
        }
        return originalPut.apply(this, args as Parameters<typeof originalPut>);
      };
      const settings = (window as RuntimeWindow).__settings!;
      settings.on_data_update({ trial_index: 0, answer: "recovered" });
    });
    await page.evaluate(async () => {
      const settings = (window as RuntimeWindow).__settings!;
      await settings.on_finish();
    });

    expect(await page.evaluate(
      () => (window as RuntimeWindow).__putBodies?.length,
    )).toBe(1);
    expect(await page.evaluate(
      () => (window as RuntimeWindow).__completionBodies?.at(-1),
    )).toMatchObject({ expectedEventCount: 1, lastSequence: 0 });
    await page.close();
  });
});
