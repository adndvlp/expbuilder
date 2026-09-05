import type { Browser, BrowserContext, Page } from "@playwright/test";
import { generatedCode, type RuntimeWindow } from "./localRuntimeTestHarness";

export const SESSION_KEY = "expbuilder:local:browser-exp:session-id";
export const SERVER_SESSION_KEY = "test:server-session-id";

export async function openRuntimePage(
  target: Browser | BrowserContext,
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

export type RuntimeSetup = {
  experimentID: string;
  runtimeCode: string;
  serverKey: string;
  failPuts: boolean;
};

export async function installRuntime(
  page: Page,
  setup: RuntimeSetup,
): Promise<void> {
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

export function defaultRuntimeSetup(
  experimentID: string,
  failPuts: boolean,
): RuntimeSetup {
  return {
    experimentID,
    runtimeCode: generatedCode(experimentID),
    serverKey: `test:server-${experimentID}`,
    failPuts,
  };
}

export async function waitForPendingOutbox(page: Page, experimentID: string) {
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
