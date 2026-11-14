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
    browser = await chromium.launch({ headless: true,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("does not read or clear pending trials owned by another experiment", async () => {
    const context = await browser.newContext();
    await context.route("https://public-storage.test/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><body></body></html>",
      }),
    );
    const page = await context.newPage();
    await page.goto("https://public-storage.test/");

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
  it("keeps old unacknowledged data across three days, a new session, and that session's cleanup", async () => {
    const context = await browser.newContext();
    await context.route('https://public-storage.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
    const page = await context.newPage(); await page.goto('https://public-storage.test/');
    try {
      const result = await page.evaluate(async code => {
        type DB = { db: IDBDatabase; init(): Promise<void>; add(row: object): Promise<void>; getAll(): Promise<Array<{ id: number; payload: { marker: string } }>>; clear(): Promise<void> };
        const make = (sid: string) => new Function('trialSessionId', code + '\nreturn TrialDB;')(sid) as DB;
        const old = make('old'); await old.add({ marker: 'must survive' });
        const rows = await old.getAll();
        await new Promise<void>((resolve, reject) => {
          const tx = old.db.transaction('trials', 'readwrite'), store = tx.objectStore('trials');
          const read = store.get(rows[0].id); read.onsuccess = () => store.put({ ...read.result, createdAt: Date.now() - 10 * 86400000 });
          tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
        });
        const next = make('new'); await next.init(); await next.add({ marker: 'new response' });
        await next.clear();
        const pending = await old.getAll(); old.db.close(); next.db.close();
        return pending.map(row => row.payload.marker);
      }, publicDatabaseCode(options('same-experiment')));
      expect(result).toEqual(['must survive']);
    } finally { await context.close(); }
  });

});
