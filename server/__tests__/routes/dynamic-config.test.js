import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import JSZip from "jszip";
import { inspectAndRestore } from "../helpers/importPackage.js";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";

let app, db, directory, previousRoot, previousPath;
const typed = (value) => ({ source: "typed", value });
const components = [{
  type: "TextComponent", coordinates: { x: 20, y: -30 }, width: 25, height: 8,
  text: typed("Keep __literal text"), _font_size_runtime_vw: typed(2),
  survey_json: typed({ elements: [{ name: "__answer" }] }),
}];
const publicMapping = { components: typed(components), trial_duration: typed(400) };
const privateMapping = { ...publicMapping, __runtimeOnly: typed({ width: 800, height: 600 }) };

function trial(fields = {}) {
  return {
    id: 1, name: "Source", plugin: "plugin-dynamic", branches: [],
    branchConditions: [], defaultNextTrialId: null, columnMapping: privateMapping,
    paramsOverride: [{ id: 2, rules: [], paramsToOverride: {
      trial_duration: typed(800), __runtimeOnly: typed(true),
    } }],
    csvJson: [{ __participant: "A", stimulus: "Hello" }],
    customOnStart: "trial.keep = true;", ...fields,
  };
}

function document(experimentID, item, current = true) {
  const source = structuredClone(item);
  if (!current) delete source.defaultNextTrialId;
  return {
    experimentID, trials: [source], loops: [],
    timeline: [{ id: source.id, name: source.name, type: "trial" }],
    ...(current ? { entryItemId: source.id } : {}),
  };
}

beforeEach(async () => {
  previousRoot = process.env.DB_ROOT;
  previousPath = process.env.DB_PATH;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "dynamic-config-"));
  process.env.DB_ROOT = directory;
  delete process.env.DB_PATH;
  jest.resetModules();
  const database = await import("../../utils/db.js");
  db = database.db;
  db.data = {};
  database.ensureDbData();
  db.data.trials.push(document("E1", trial()));
  await db.write();
  app = express();
  app.use(express.json());
  app.use((await import("../../routes/timeline/trials.js")).default);
  app.use((await import("../../routes/db/import.js")).default);
  app.use((await import("../../routes/db/export.js")).default);
});

afterEach(() => {
  if (previousRoot === undefined) delete process.env.DB_ROOT;
  else process.env.DB_ROOT = previousRoot;
  if (previousPath === undefined) delete process.env.DB_PATH;
  else process.env.DB_PATH = previousPath;
  fs.rmSync(directory, { recursive: true, force: true });
});

test.each(["plugin-dynamic", "DynamicPlugin"])(
  "POST persists only user parameters for %s and preserves component geometry",
  async (plugin) => {
    const payload = trial({ plugin, name: "New trial" });
    delete payload.id;
    const response = await request(app).post("/api/trial/E1").send(payload).expect(200);
    expect(response.body.trial.columnMapping).toEqual(publicMapping);
    expect(response.body.trial.paramsOverride).toEqual([
      { id: 2, rules: [], paramsToOverride: { trial_duration: typed(800) } },
    ]);
    expect(response.body.trial.csvJson).toEqual(payload.csvJson);
    expect(response.body.trial.customOnStart).toBe(payload.customOnStart);
    await db.read();
    expect(db.data.trials[0].trials.at(-1)).toEqual(response.body.trial);
  },
);

test("PATCH cleans the combined record even when it only changes the trial name", async () => {
  const response = await request(app).patch("/api/trial/E1/1")
    .send({ name: "Renamed" }).expect(200);
  expect(response.body.trial.columnMapping).toEqual(publicMapping);
  expect(response.body.trial.paramsOverride[0].paramsToOverride).toEqual({ trial_duration: typed(800) });
  expect(response.body.trial.csvJson).toEqual(trial().csvJson);
  expect(response.body.trial.name).toBe("Renamed");
  await db.read();
  expect(db.data.trials[0].trials[0]).toEqual(response.body.trial);
});

test("POST preserves private arguments of a custom plugin", async () => {
  const payload = trial({ plugin: "custom-stimulus", name: "Custom" });
  delete payload.id;
  const response = await request(app).post("/api/trial/E1").send(payload).expect(200);
  expect(response.body.trial.columnMapping).toEqual(payload.columnMapping);
  expect(response.body.trial.paramsOverride).toEqual(payload.paramsOverride);
});

function backup(current = true, manual = false) {
  return {
    experiment: { experimentID: "E2", name: "Imported" },
    trials: document("E2", trial(), current),
    config: { experimentID: "E2", isDevMode: manual, isSaveMode: true, data: {
      generatedCode: "savedCode();", customCode: "keepCustom();",
      customPreInitCode: { local: "keepPreInit();", public: "keepPublic();" },
    } },
    sessionResults: [{ experimentID: "E2", sessionId: "saved", data: [{ rt: 42 }] }],
    sessionCounter: 3,
  };
}

async function importBackup(payload) {
  const zip = new JSZip();
  zip.file("Imported/data.json", JSON.stringify(payload));
  zip.file("Imported/img/stimulus.png", "image-bytes");
  return inspectAndRestore(app, await zip.generateAsync({ type: "nodebuffer" }));
}

function parseZip(response, done) {
  const chunks = [];
  response.on("data", chunk => chunks.push(chunk));
  response.on("end", () => done(null, Buffer.concat(chunks)));
  response.on("error", done);
}

test.each([true, false])("import cleans current=%s navigation and discards only automatic code", async (current) => {
  const payload = backup(current);
  expect((await importBackup(payload)).status).toBe(200);
  await db.read();
  const restored = db.data.trials.find(doc => doc.experimentID === "E2");
  const config = db.data.configs.find(item => item.experimentID === "E2");
  expect(restored.trials[0].columnMapping).toEqual(publicMapping);
  expect(restored.trials[0].paramsOverride[0].paramsToOverride).toEqual({ trial_duration: typed(800) });
  expect(config).toMatchObject({ ...payload.config, data: { ...payload.config.data, generatedCode: "" } });
  expect(restored.trials[0].csvJson).toEqual(payload.trials.trials[0].csvJson);
  expect(db.data.sessionResults).toEqual(payload.sessionResults);
  expect(db.data.sessionCounters.E2).toBe(3);
  expect(fs.readFileSync(path.join(directory, "experiments/E2/media/img/stimulus.png"), "utf8")).toBe("image-bytes");

  const response = await request(app).get("/api/export-experiment/E2").buffer(true).parse(parseZip).expect(200);
  const exported = await JSZip.loadAsync(response.body);
  const roundTrip = JSON.parse(await exported.file("experiments/E2/data.json").async("string"));
  expect(roundTrip.trials).toEqual(restored);
  expect((await importBackup(roundTrip)).status).toBe(200);
  await db.read();
  expect(db.data.trials.find(doc => doc.experimentID === "E2")).toEqual(restored);
});

test("import preserves a manual program and its settings exactly", async () => {
  const payload = backup(true, true);
  expect((await importBackup(payload)).status).toBe(200);
  await db.read();
  expect(db.data.configs[0]).toMatchObject(payload.config);
  expect(db.data.trials.find(doc => doc.experimentID === "E2").trials[0].columnMapping).toEqual(publicMapping);
});

test("invalid imported navigation leaves the database and media unchanged", async () => {
  const payload = backup();
  payload.trials.trials[0].branches = [999];
  const before = fs.readFileSync(path.join(directory, "database/db.json"), "utf8");
  expect((await importBackup(payload)).status).toBe(400);
  expect(fs.readFileSync(path.join(directory, "database/db.json"), "utf8")).toBe(before);
  expect(fs.existsSync(path.join(directory, "Imported"))).toBe(false);
});
