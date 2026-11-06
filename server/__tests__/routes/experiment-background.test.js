import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { load } from "cheerio";
import { beforeEach, afterEach, test, expect, jest } from "@jest/globals";

let app, db, directory, originalRoot, originalPath, originalFetch, originalFirebase;
let functionalSettings;
beforeEach(async () => {
  originalRoot = process.env.DB_ROOT;
  originalPath = process.env.DB_PATH;
  originalFirebase = process.env.FIREBASE_URL;
  originalFetch = global.fetch;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "experiment-background-"));
  process.env.DB_ROOT = directory;
  process.env.FIREBASE_URL = "https://firebase.example.com";
  delete process.env.DB_PATH;
  jest.resetModules();
  const database = await import("../../utils/db.js");
  db = database.db;
  db.data = {};
  database.ensureDbData();
  db.data.experiments.push({ experimentID: "E1", name: "Background" });
  const { defaultFunctionalSettings } = await import(
    "../../utils/functionalSettings.js"
  );
  functionalSettings = defaultFunctionalSettings();
  db.data.configs.push({
    experimentID: "E1",
    functionalSettings,
    settingsMigration: { state: "complete", source: "new" },
  });
  await db.write();
  global.fetch = jest.fn(async () => ({ json: async () => ({ success: true }) }));
  app = express();
  app.use(express.json());
  app.use((await import("../../routes/experiments.js")).default);
});
afterEach(() => {
  for (const [key, value] of [["DB_ROOT", originalRoot], ["DB_PATH", originalPath], ["FIREBASE_URL", originalFirebase]]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = originalFetch;
  fs.rmSync(directory, { recursive: true, force: true });
});

async function build(mode, extra = {}) {
  const endpoint = mode === "run" ? "run-experiment" : mode === "preview" ? "trials-preview" : "publish-experiment";
  const body = mode === "publish"
    ? { uid: "test-user", generatedPublicCode: "const generated = true;", functionalSettings }
    : { generatedCode: "const generated = true;" };
  return request(app).post(`/api/${endpoint}/E1`).send({ ...body, ...extra });
}
function htmlFor(mode) {
  if (mode === "publish") return JSON.parse(global.fetch.mock.calls.at(-1)[1].body).htmlContent;
  return fs.readFileSync(path.join(directory, mode === "run" ? "experiments_html" : "trials_previews_html", "E1.html"), "utf8");
}

test("saved appearance does not bypass pending functional settings review", async () => {
  db.data.experiments[0].appearanceSettings = { backgroundColor: "#123456" };
  db.data.configs = [];
  await db.write();

  const response = await build("publish");
  expect(response.status).toBe(422);
  expect(response.body.code).toBe("SETTINGS_REVIEW_REQUIRED");
  expect(global.fetch).not.toHaveBeenCalled();
  await db.read();
  expect(db.data.experiments[0].appearanceSettings).toEqual({ backgroundColor: "#123456" });
});

test.each([undefined, {}, { fullScreen: false }, { backgroundColor: "", progressBar: true }])(
  "uses the same default for GET, run, preview and publication: %j", async settings => {
    db.data.experiments[0].appearanceSettings = settings;
    await db.write();
    const response = await request(app).get("/api/appearance-settings/E1").expect(200);
    expect(response.body.settings.backgroundColor).toBe("#ffffff");
    for (const mode of ["run", "preview", "publish"]) {
      expect((await build(mode)).status).toBe(200);
      const $ = load(htmlFor(mode));
      expect($("style#experiment-appearance")).toHaveLength(1);
      expect($("style#experiment-appearance").text()).toContain("body { background-color: #ffffff; }");
      expect($("head style").text()).not.toContain("#f0f0f0");
    }
  },
);

test("new builds use the saved color without changing or resaving trials", async () => {
  db.data.trials.push({ experimentID: "E1", entryItemId: 1,
    trials: [{ id: 1, plugin: "plugin-dynamic", branches: [], branchConditions: [], defaultNextTrialId: null,
      columnMapping: { } }],
    loops: [], timeline: [{ id: 1, type: "trial" }] });
  const trials = structuredClone(db.data.trials);
  await db.write();
  for (const color of ["#123456", "#abcdef"]) {
    await request(app).put("/api/appearance-settings/E1").send({ backgroundColor: color, fullScreen: false, progressBar: true }).expect(200);
    for (const mode of ["run", "preview", "publish"]) {
      expect((await build(mode)).status).toBe(200);
      const $ = load(htmlFor(mode));
      expect($("style#experiment-appearance")).toHaveLength(1);
      expect($("style#experiment-appearance").text()).toContain(`body { background-color: ${color}; }`);
    }
    await db.read();
    expect(db.data.trials).toEqual(trials);
    expect(db.data.experiments[0].appearanceSettings).toEqual({ backgroundColor: color, fullScreen: false, progressBar: true });
  }
});

test("publication replaces a stale local style rather than dropping the saved appearance", async () => {
  db.data.experiments[0].appearanceSettings = { backgroundColor: "#654321" };
  await db.write();
  fs.mkdirSync(path.join(directory, "experiments_html"), { recursive: true });
  fs.writeFileSync(path.join(directory, "experiments_html", "Background.html"), '<html><head><style id="experiment-appearance">body {background-color:#ff0000}</style></head><body></body></html>');
  expect((await build("publish")).status).toBe(200);
  const $ = load(htmlFor("publish"));
  expect($("style#experiment-appearance")).toHaveLength(1);
  expect($("style#experiment-appearance").text()).toContain("#654321");
  expect($("head style").text()).not.toContain("#ff0000");
});

test.each(["run", "preview", "publish"])("uses saved appearance with unused request attributes on %s", async mode => {
  db.data.experiments[0].appearanceSettings = { backgroundColor: "#123456" };
  await db.write();
  const response = await build(mode, { unusedOption: { backgroundColor: "#ff0000" } });
  expect(response.status).toBe(200);
  const $ = load(htmlFor(mode));
  expect($("style#experiment-appearance").text()).toContain("#123456");
  await db.read();
  expect(db.data.experiments[0].appearanceSettings).toEqual({ backgroundColor: "#123456" });
});
