import { chromium } from "../../../client/node_modules/@playwright/test/index.js";
import { build } from "../../../client/node_modules/esbuild/lib/main.js";
import express from "express";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { jest } from "@jest/globals";

let browser;

async function createResultsServer() {
  const resultsRouter = (await import("../../routes/results.js")).default;
  const { serializeDbRequest } = await import(
    "../../modules/session-persistence/dbQueue.js"
  );
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.get("/", (_req, res) => {
    res.type("html").send("<!doctype html><html><head></head><body></body></html>");
  });
  app.use(serializeDbRequest);
  app.use(resultsRouter);
  return http.createServer(app);
}

async function listen(server, port = 0) {
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return server.address().port;
}

async function closeServer(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => server.close((error) => {
    if (error) reject(error);
    else resolve();
  }));
}

async function outboxRecordCount(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("expbuilder-local-session-outbox-v1", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const transaction = open.result.transaction("trial-events", "readonly");
      const records = transaction.objectStore("trial-events").getAll();
      records.onerror = () => reject(records.error);
      records.onsuccess = () => resolve(records.result.filter(
        (record) =>
          record.experimentID === "flow-exp" &&
          record.sessionId === window.JSPSYCH_SESSION_ID,
      ).length);
    };
  }));
}

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
});

test("runs generated local persistence through HTTP, LowDB and CSV", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "session-flow-e2e-"));
  process.env.DB_ROOT = root;
  delete process.env.DB_PATH;
  jest.resetModules();

  const { db, ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  db.data.experiments.push({ experimentID: "flow-exp", name: "Flow" });
  await db.write();

  let server = await createResultsServer();
  const port = await listen(server);
  const origin = `http://127.0.0.1:${port}`;
  const pages = [];

  try {
    const generatorBundle = path.join(root, "session-runtime-generator.mjs");
    await build({
      entryPoints: [
        path.resolve(
          import.meta.dirname,
          "../../../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/buildLocalExperimentCode.ts",
        ),
      ],
      bundle: true,
      format: "esm",
      outfile: generatorBundle,
      platform: "node",
    });
    const { buildLocalExperimentCode } = await import(
      pathToFileURL(generatorBundle).href
    );
    const generatedCode = buildLocalExperimentCode({
      experimentID: "flow-exp",
      sessionNameTokens: [],
      sessionNameSeparator: "_",
      evaluateCondition: "",
      branchingEvaluation: "",
      baseCode: "window.__started = true; jsPsych.run([]);",
      customCode: undefined,
      customPreInitCode: { local: "" },
      extensions: "",
      localParams: {},
      progressBar: false,
    });

    const participantCount = 10;
    await Promise.all(Array.from({ length: participantCount }, async (_, index) => {
      const page = await browser.newPage();
      pages.push(page);
      const pageErrors = [];
      const consoleMessages = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => consoleMessages.push(message.text()));
      await page.goto(`${origin}/`);
      await page.evaluate((code) => {
        Object.assign(window, {
          io: () => ({ emit: (_event, _payload, acknowledge) => acknowledge({ success: true }) }),
          _hideLoading: () => undefined,
          _setLoadingMsg: () => undefined,
          initJsPsych: (settings) => {
            window.__settings = settings;
            return { run: () => Promise.resolve() };
          },
        });
        Object.defineProperty(document.head, "appendChild", {
          configurable: true,
          value: (node) => {
            if (node.tagName === "SCRIPT" && node.src.includes("socket.io")) {
              queueMicrotask(() => node.onload?.(new Event("load")));
            }
            return node;
          },
        });
        new Function(code)();
      }, generatedCode);
      try {
        await page.waitForFunction(() => window.__started === true, null, {
          timeout: 12000,
        });
      } catch (error) {
        throw new Error(
          `runtime ${index} did not start: ${[
            ...pageErrors,
            ...consoleMessages,
            error.message,
          ].join(" | ")}`,
          { cause: error },
        );
      }
    }));

    await Promise.all(pages.map((page, index) => page.evaluate(
      (participantIndex) => window.__settings.on_data_update({
        trial_index: 0,
        answer: `before-restart-${participantIndex}`,
      }),
      index,
    )));
    let storedBeforeRestart = 0;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await fetch(`${origin}/api/session-results/flow-exp`);
      const body = await response.json();
      storedBeforeRestart = body.sessions.reduce(
        (total, session) => total + session.storedEventCount,
        0,
      );
      if (storedBeforeRestart === participantCount) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(storedBeforeRestart).toBe(participantCount);

    await closeServer(server);
    await Promise.all(pages.map((page, index) => page.evaluate(
      (participantIndex) => window.__settings.on_data_update({
        trial_index: 1,
        answer: `after-restart-${participantIndex}`,
      }),
      index,
    )));
    let outboxCounts = [];
    for (let attempt = 0; attempt < 100; attempt += 1) {
      outboxCounts = await Promise.all(pages.map(outboxRecordCount));
      if (outboxCounts.every((count) => count === 2)) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(outboxCounts).toEqual(Array(participantCount).fill(2));
    await new Promise((resolve) => setTimeout(resolve, 50));

    process.env.DB_PATH = path.join(root, "database", "db.json");
    jest.resetModules();
    const { db: restartedDb } = await import("../../utils/db.js");
    server = await createResultsServer();
    await listen(server, port);
    await Promise.all(pages.map((page) => page.evaluate(
      () => window.__settings.on_finish(),
    )));

    await restartedDb.read();
    expect(restartedDb.data.sessionResults).toHaveLength(participantCount);
    expect(new Set(restartedDb.data.sessionResults.map(
      (session) => session.sessionId,
    )).size).toBe(participantCount);
    expect(new Set(restartedDb.data.sessionResults.map(
      (session) => session.participantNumber,
    ))).toEqual(new Set(Array.from(
      { length: participantCount },
      (_, index) => index + 1,
    )));
    for (const session of restartedDb.data.sessionResults) {
      expect(session).toMatchObject({
        experimentID: "flow-exp",
        state: "completed",
        events: [{ sequence: 0 }, { sequence: 1 }],
      });
      expect(session.data).toHaveLength(2);
    }
    const session = restartedDb.data.sessionResults[0];
    const csvResponse = await fetch(
      `${origin}/api/download-session/${session.sessionId}/flow-exp`,
    );
    expect(csvResponse.status).toBe(200);
    const csv = await csvResponse.text();
    expect(csv).toContain(session.data[0].answer);
    expect(csv).toContain("session_sequence");
  } finally {
    await Promise.all(pages.map((page) => page.close()));
    await closeServer(server);
    fs.rmSync(root, { recursive: true, force: true });
    delete process.env.DB_ROOT;
    delete process.env.DB_PATH;
  }
}, 60000);
