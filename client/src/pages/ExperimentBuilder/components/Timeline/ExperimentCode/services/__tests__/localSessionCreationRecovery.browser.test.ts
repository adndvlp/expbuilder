import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generatedCode, type RuntimeWindow } from "./localRuntimeTestHarness";

const SESSION_KEY = "expbuilder:local:browser-exp:session-id";
const SERVER_SESSION_KEY = "test:server-session-id";

let browser: Browser;

async function openRuntimePage(
  target: Browser | BrowserContext = browser,
): Promise<Page> {
  const page = await target.newPage();
  await page.route("http://creation-recovery.test/**", async (route) => {
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
  await page.goto("http://creation-recovery.test/");
  return page;
}

type RuntimeSetup = {
  experimentID: string;
  runtimeCode: string;
  serverKey: string;
  failPuts: boolean;
};

async function installRuntime(page: Page, setup: RuntimeSetup): Promise<void> {
  await page.evaluate(({ experimentID, failPuts, runtimeCode, serverKey }) => {
    const putBodies: unknown[] = [];
    window.fetch = async (input, init) => {
      const method = init?.method || "GET";
      const url = String(input);
      if (method === "GET") {
        const sessionId = localStorage.getItem(serverKey);
        return new Response(JSON.stringify({ sessions: sessionId ? [{
          experimentID,
          sessionId,
          participantNumber: 1,
          storedEventCount: 0,
          lastSequence: -1,
          sequenceTracked: true,
          state: "in-progress",
          createdAt: new Date().toISOString(),
        }] : [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === "POST" && url.includes("append-result")) {
        localStorage.setItem(serverKey, body.sessionId);
        return new Response(JSON.stringify({
          success: true,
          id: body.sessionId,
          participantNumber: 1,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (method === "PUT") {
        putBodies.push(body);
        if (failPuts) throw new TypeError("server unavailable");
        return new Response(JSON.stringify({
          success: true,
          eventId: body.eventId,
          sequence: body.sequence,
          storedCount: Number(body.sequence) + 1,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("complete-session")) {
        return new Response(JSON.stringify({
          success: true,
          storedEventCount: body.expectedEventCount,
          lastSequence: body.lastSequence,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    Object.assign(window, {
      __putBodies: putBodies,
      _hideLoading: () => undefined,
      _setLoadingMsg: () => undefined,
      initJsPsych: (settings: Record<string, unknown>) => {
        (window as RuntimeWindow).__settings = settings as RuntimeWindow["__settings"];
        return { run: () => Promise.resolve() };
      },
    });
    new Function(runtimeCode)();
  }, setup);
  await page.waitForFunction(() => Boolean((window as RuntimeWindow).__started));
}

async function waitForPendingOutbox(page: Page, experimentID: string) {
  await page.waitForFunction(async (expectedExperimentID) => {
    const records = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = indexedDB.open("expbuilder-local-session-outbox-v1", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("trial-events", "readonly");
        const all = transaction.objectStore("trial-events").getAll();
        all.onerror = () => reject(all.error);
        all.onsuccess = () => resolve(all.result);
      };
    });
    return records.some(
      (record) => record.experimentID === expectedExperimentID,
    );
  }, experimentID);
}

describe("local session creation recovery", () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    await browser.close();
  }, 30000);

  it("recovers the same UUID when the server commits creation but its response is lost", async () => {
    const page = await openRuntimePage();
    const code = generatedCode();

    await page.evaluate(({ runtimeCode, serverKey }) => {
      const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method || "GET") === "POST" && String(input).includes("append-result")) {
          const body = JSON.parse(String(init?.body)) as { sessionId: string };
          localStorage.setItem(serverKey, body.sessionId);
          throw new TypeError("creation response was lost");
        }
        return new Response(JSON.stringify({ sessions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };
      Object.assign(window, {
        fetch: fetchMock,
        _hideLoading: () => undefined,
        _setLoadingMsg: () => undefined,
        initJsPsych: (settings: Record<string, unknown>) => {
          (window as RuntimeWindow).__settings = settings as RuntimeWindow["__settings"];
          return { run: () => Promise.resolve() };
        },
      });
      new Function(runtimeCode)();
    }, { runtimeCode: code, serverKey: SERVER_SESSION_KEY });

    await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), SESSION_KEY);
    const pendingId = await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY);
    expect(await page.evaluate(
      (key) => localStorage.getItem(key),
      SERVER_SESSION_KEY,
    )).toBe(pendingId);
    expect(await page.evaluate(() => Boolean((window as RuntimeWindow).__started))).toBe(false);

    await page.reload();
    await page.evaluate(({ runtimeCode, serverKey }) => {
      const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        if (method === "POST" && String(input).includes("append-result")) {
          throw new Error("a recovered session must not be created again");
        }
        const sessionId = localStorage.getItem(serverKey);
        if (method === "GET") {
          return new Response(JSON.stringify({ sessions: [{
            experimentID: "browser-exp",
            sessionId,
            participantNumber: 7,
            storedEventCount: 0,
            lastSequence: -1,
            sequenceTracked: true,
            state: "initiated",
            createdAt: new Date().toISOString(),
          }] }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };
      Object.assign(window, {
        fetch: fetchMock,
        _hideLoading: () => undefined,
        _setLoadingMsg: () => undefined,
        initJsPsych: (settings: Record<string, unknown>) => {
          (window as RuntimeWindow).__settings = settings as RuntimeWindow["__settings"];
          return { run: () => Promise.resolve() };
        },
      });
      new Function(runtimeCode)();
    }, { runtimeCode: code, serverKey: SERVER_SESSION_KEY });

    await page.waitForFunction(() => Boolean((window as RuntimeWindow).__started));
    expect(await page.evaluate(
      () => (window as RuntimeWindow & { JSPSYCH_SESSION_ID: string }).JSPSYCH_SESSION_ID,
    )).toBe(pendingId);
    await page.close();
  }, 30000);

  it("keeps A pending across close, runs B independently, then recovers A", async () => {
    const context = await browser.newContext();
    const firstA = await openRuntimePage(context);
    await installRuntime(firstA, {
      experimentID: "experiment-a",
      runtimeCode: generatedCode("experiment-a"),
      serverKey: "test:server-a",
      failPuts: true,
    });
    const sessionA = await firstA.evaluate(
      () => (window as RuntimeWindow & { JSPSYCH_SESSION_ID: string }).JSPSYCH_SESSION_ID,
    );
    await firstA.evaluate(() => {
      (window as RuntimeWindow).__settings?.on_data_update({
        trial_index: 0,
        answer: "survives-close",
      });
    });
    await waitForPendingOutbox(firstA, "experiment-a");
    await firstA.close();

    const pageB = await openRuntimePage(context);
    await installRuntime(pageB, {
      experimentID: "experiment-b",
      runtimeCode: generatedCode("experiment-b"),
      serverKey: "test:server-b",
      failPuts: false,
    });
    const sessionB = await pageB.evaluate(
      () => (window as RuntimeWindow & { JSPSYCH_SESSION_ID: string }).JSPSYCH_SESSION_ID,
    );
    expect(sessionB).not.toBe(sessionA);
    expect(await pageB.evaluate(() => localStorage.getItem(
      "expbuilder:local:experiment-a:session-id",
    ))).toBe(sessionA);
    await pageB.close();

    const reopenedA = await openRuntimePage(context);
    await installRuntime(reopenedA, {
      experimentID: "experiment-a",
      runtimeCode: generatedCode("experiment-a"),
      serverKey: "test:server-a",
      failPuts: false,
    });
    await reopenedA.waitForFunction(
      () => ((window as RuntimeWindow).__putBodies?.length || 0) === 1,
    );
    expect(await reopenedA.evaluate(
      () => (window as RuntimeWindow).__putBodies?.[0],
    )).toMatchObject({
      sessionId: sessionA,
      sequence: 0,
      response: { answer: "survives-close" },
    });
    await reopenedA.evaluate(
      () => (window as RuntimeWindow).__settings?.on_finish(),
    );
    expect(await reopenedA.evaluate(() => localStorage.getItem(
      "expbuilder:local:experiment-b:session-id",
    ))).toBe(sessionB);

    await context.close();
  }, 30000);
});
