import { chromium, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PublicExperimentCodeOptions } from "../publicCodeTypes";
import { publicDatabaseCode } from "../publicDatabaseCode";

function options(experimentID: string): PublicExperimentCodeOptions {
  return {
    DATA_API_URL: "/apiData",
    FIREBASE_DATABASE_URL: "https://example.invalid",
    experimentID,
    useStorage: "firebase",
    batchConfig: {
      useIndexedDB: true,
      batchSize: 10,
      resumeTimeoutMinutes: 30,
    },
    recruitmentConfig: { platform: "none", prolificCompletionCode: "" },
    captchaConfig: { enabled: false, provider: "hcaptcha", siteKey: "" },
    sessionNameTokens: [],
    sessionNameSeparator: "_",
    currentUid: "test-user",
    evaluateCondition: "",
    branchingEvaluation: "",
    customPreInitCode: { local: "", public: "" },
    publicParams: {},
    extensions: "",
    progressBar: false,
    baseCode: "",
  };
}

let browser: Browser;

describe("public IndexedDB isolation in Chromium", () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("does not read or clear pending trials owned by another experiment", async () => {
    const context = await browser.newContext();
    await context.route("http://public-storage.test/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><body></body></html>",
      }),
    );
    const page = await context.newPage();
    await page.goto("http://public-storage.test/");

    const result = await page.evaluate(
      async ({ firstCode, secondCode }) => {
        type TrialDatabase = {
          add: (trial: Record<string, unknown>) => Promise<unknown>;
          clear: () => Promise<void>;
          db: IDBDatabase | null;
          dbName: string;
          getAll: () => Promise<Array<Record<string, unknown>>>;
        };
        const createDatabase = (code: string, sessionId: string) =>
          new Function("trialSessionId", `${code}\nreturn TrialDB;`)(
            sessionId,
          ) as TrialDatabase;

        const first = createDatabase(firstCode, "session-a");
        const second = createDatabase(secondCode, "session-b");

        await first.add({ marker: "experiment-a" });
        await second.add({ marker: "experiment-b" });
        const beforeClear = {
          first: await first.getAll(),
          second: await second.getAll(),
        };

        await second.clear();
        const afterClear = {
          first: await first.getAll(),
          second: await second.getAll(),
        };

        const names = [first.dbName, second.dbName];
        first.db?.close();
        second.db?.close();
        return { afterClear, beforeClear, names };
      },
      {
        firstCode: publicDatabaseCode(options("experiment-a")),
        secondCode: publicDatabaseCode(options("experiment-b")),
      },
    );

    expect(result.names[0]).not.toBe(result.names[1]);
    expect(result.beforeClear.first).toEqual([
      expect.objectContaining({
        marker: "experiment-a",
        sessionId: "session-a",
      }),
    ]);
    expect(result.beforeClear.second).toEqual([
      expect.objectContaining({
        marker: "experiment-b",
        sessionId: "session-b",
      }),
    ]);
    expect(result.afterClear.first).toEqual([
      expect.objectContaining({
        marker: "experiment-a",
        sessionId: "session-a",
      }),
    ]);
    expect(result.afterClear.second).toEqual([]);

    await context.close();
  });
});
