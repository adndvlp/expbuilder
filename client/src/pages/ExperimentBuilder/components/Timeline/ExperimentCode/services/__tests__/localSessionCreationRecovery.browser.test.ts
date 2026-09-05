import { chromium, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generatedCode, type RuntimeWindow } from "./localRuntimeTestHarness";
import {
  SERVER_SESSION_KEY,
  SESSION_KEY,
  defaultRuntimeSetup,
  installRuntime,
  openRuntimePage,
  waitForPendingOutbox,
} from "./localSessionCreationRecoveryHarness";

let browser: Browser;

describe("local session creation recovery", () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("recovers the same UUID when the server commits creation but its response is lost", async () => {
    const page = await openRuntimePage(browser);
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
  });

  it("keeps persistence busy while a new result enters the outbox", async () => {
    const page = await openRuntimePage(browser);
    await installRuntime(page, defaultRuntimeSetup("persistence-race", false));

    const result = await page.evaluate(async () => {
      const runtime = window as RuntimeWindow & {
        ExpBuilderPersistence?: {
          pendingCount(): number;
          whenIdle(): Promise<void>;
        };
      };
      runtime.__settings?.on_data_update({
        trial_index: 0,
        builder_id: "source-before-reload",
      });
      const pendingImmediately =
        runtime.ExpBuilderPersistence?.pendingCount() ?? -1;
      await runtime.ExpBuilderPersistence?.whenIdle();
      return {
        pendingImmediately,
        putBodies: runtime.__putBodies || [],
      };
    });

    expect(result.pendingImmediately).toBeGreaterThan(0);
    expect(result.putBodies).toHaveLength(1);
    expect(result.putBodies[0]).toMatchObject({
      sequence: 0,
      response: {
        trial_index: 0,
        builder_id: "source-before-reload",
      },
    });
    await page.close();
  });

  it("keeps A pending across close, runs B independently, then recovers A", async () => {
    const context = await browser.newContext();
    const firstA = await openRuntimePage(context);
    await installRuntime(firstA, defaultRuntimeSetup("experiment-a", true));
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
    await installRuntime(pageB, defaultRuntimeSetup("experiment-b", false));
    const sessionB = await pageB.evaluate(
      () => (window as RuntimeWindow & { JSPSYCH_SESSION_ID: string }).JSPSYCH_SESSION_ID,
    );
    expect(sessionB).not.toBe(sessionA);
    expect(await pageB.evaluate(() => localStorage.getItem(
      "expbuilder:local:experiment-a:session-id",
    ))).toBe(sessionA);
    await pageB.close();

    const reopenedA = await openRuntimePage(context);
    await installRuntime(reopenedA, defaultRuntimeSetup("experiment-a", false));
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
  });
});
