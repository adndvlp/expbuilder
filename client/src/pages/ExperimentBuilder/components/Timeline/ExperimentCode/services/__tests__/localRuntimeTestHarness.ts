import type { Browser, BrowserContext, Page } from "@playwright/test";
import { buildLocalExperimentCode } from "../buildLocalExperimentCode";
import type { LocalExperimentCodeOptions } from "../localCodeTypes";

export type RuntimeOptions = {
  failures?: number;
  malformedPutAck?: boolean;
  permanentFailure?: boolean;
  recoverStoredSession?: boolean;
};

export type RuntimeWindow = Window & {
  __completionBodies?: Array<Record<string, unknown>>;
  __completionAttempts?: () => number;
  __putBodies?: Array<Record<string, unknown>>;
  __setPermanentFailure?: (value: boolean) => void;
  __settings?: Record<string, (data?: unknown) => unknown>;
  __started?: boolean;
};

export function generatedCode(experimentID = "browser-exp"): string {
  const options: LocalExperimentCodeOptions = {
    experimentID,
    sessionNameTokens: [],
    sessionNameSeparator: "_",
    evaluateCondition: "",
    branchingEvaluation: "",
    baseCode: "window.__started = true; if (window.branchCustomParameters) { Object.entries(window.branchCustomParameters).forEach(() => {}); } jsPsych.run([]);",
    customCode: undefined,
    customPreInitCode: { local: "" },
    extensions: "",
    localParams: {},
    progressBar: false,
  };
  return buildLocalExperimentCode(options);
}

export async function preparePage(
  browser: Browser,
  options: RuntimeOptions = {},
): Promise<Page> {
  const page = await browser.newPage();
  await page.route("http://runtime.test/**", async (route) => {
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
  await page.goto("http://runtime.test/");
  await page.evaluate(
    ({
      code,
      failures,
      malformedPutAck,
      permanentFailure,
      recoverStoredSession,
    }) => {
      let putAttempts = 0;
      let completionAttempts = 0;
      let forceFailure = permanentFailure;
      const putBodies: Array<Record<string, unknown>> = [];
      const completionBodies: Array<Record<string, unknown>> = [];
      if (recoverStoredSession) {
        localStorage.setItem(
          "expbuilder:local:browser-exp:session-id",
          "persisted-session",
        );
      }
      const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        if (method === "POST" && String(input).includes("append-result")) {
          const body = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({
            success: true,
            id: body.sessionId,
            participantNumber: 1,
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (method === "PUT") {
          putAttempts += 1;
          const body = JSON.parse(String(init?.body));
          putBodies.push(body);
          if (forceFailure || putAttempts <= failures) {
            return new Response(JSON.stringify({ success: false }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (malformedPutAck) {
            return new Response("not-json", {
              status: 200,
              headers: { "Content-Type": "text/plain" },
            });
          }
          return new Response(JSON.stringify({
            success: true,
            eventId: body.eventId,
            sequence: body.sequence,
            storedCount: Number(body.sequence) + 1,
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (String(input).includes("complete-session")) {
          completionAttempts += 1;
          const body = JSON.parse(String(init?.body));
          completionBodies.push(body);
          return new Response(JSON.stringify({
            success: true,
            storedEventCount: body.expectedEventCount,
            lastSequence: body.lastSequence,
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        const sessionId = localStorage.getItem(
          "expbuilder:local:browser-exp:session-id",
        );
        return new Response(JSON.stringify({
          sessions: recoverStoredSession && sessionId ? [{
            experimentID: "browser-exp",
            sessionId,
            participantNumber: 1,
            storedEventCount: 2,
            lastSequence: 1,
            sequenceTracked: true,
            state: "in-progress",
            createdAt: new Date().toISOString(),
          }] : [],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      };
      Object.assign(window, {
        fetch: fetchMock,
        __completionBodies: completionBodies,
        __completionAttempts: () => completionAttempts,
        __putBodies: putBodies,
        __putAttempts: () => putAttempts,
        __setPermanentFailure: (value: boolean) => { forceFailure = value; },
        _hideLoading: () => undefined,
        _setLoadingMsg: (message: string) => {
          (window as unknown as { __message: string }).__message = message;
        },
        initJsPsych: (settings: Record<string, unknown>) => {
          (window as unknown as { __settings: Record<string, unknown> }).__settings = settings;
          return { run: () => Promise.resolve() };
        },
      });
      new Function(code)();
    },
    {
      code: generatedCode(),
      failures: options.failures || 0,
      malformedPutAck: options.malformedPutAck || false,
      permanentFailure: options.permanentFailure || false,
      recoverStoredSession: options.recoverStoredSession || false,
    },
  );
  await page.waitForFunction(() => Boolean((window as RuntimeWindow).__started));
  return page;
}

export async function prepareSharedPage(
  context: BrowserContext,
  participantNumber: number,
  persistedSessionId?: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto("http://tabs.test/");
  await page.evaluate(
    ({ code, participant, persisted }) => {
      const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        if (method === "POST" && String(input).includes("append-result")) {
          const body = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({
            success: true,
            id: body.sessionId,
            participantNumber: participant,
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        const candidate = localStorage.getItem(
          "expbuilder:local:browser-exp:session-id",
        );
        return new Response(JSON.stringify({
          sessions: persisted && candidate === persisted ? [{
            experimentID: "browser-exp",
            sessionId: persisted,
            participantNumber: 1,
            storedEventCount: 0,
            lastSequence: -1,
            sequenceTracked: true,
            state: "in-progress",
            createdAt: new Date().toISOString(),
          }] : [],
        }), {
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
      new Function(code)();
    },
    {
      code: generatedCode(),
      participant: participantNumber,
      persisted: persistedSessionId,
    },
  );
  await page.waitForFunction(() => Boolean((window as RuntimeWindow).__started));
  return page;
}
