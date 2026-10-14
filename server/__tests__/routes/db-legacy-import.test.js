import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { buildExperimentGraph } from "../../routes/timeline/graph/buildExperimentGraph.js";
import { assertTimelineBranching, assertTrialBranching, assertLoopHasNoBranching } from "../../routes/timeline/branchContract.js";

const backup = () => ({
  experiment: { experimentID: "legacy", name: "Legacy", updatedAt: "2026-10-05T20:30:30.177Z" },
  trials: {
    experimentID: "legacy", updatedAt: "2026-10-05T20:30:30.177Z",
    trials: [
      { id: 1, name: "Before", branches: ["outer"] },
      { id: 2, name: "Entry", parentLoopId: "outer", branches: [3], parameters: { stimulus: { source: "csv", value: "text" } } },
      { id: 3, name: "After", branches: [] },
    ],
    loops: [{ id: "outer", name: "Loop", trials: [2], parentLoopId: null, repetitions: 2, csvJson: [{ text: "a" }, { text: "b" }], orders: false }],
    timeline: [
      { id: 1, type: "trial", branches: ["outer"] },
      { id: "outer", type: "loop", trials: [], branches: [] },
      { id: 3, type: "trial", branches: [] },
    ],
  },
  config: { experimentID: "legacy", data: { code: "keep" }, isSaveMode: true },
  sessionResults: [{ experimentID: "legacy", sessionId: "existing", data: [{ response: "keep" }] }],
  sessionCounter: 4,
});

describe("temporary legacy branching migration on ZIP import", () => {
  let app, db, tmpDir, previousRoot, previousPath;
  beforeEach(async () => {
    previousRoot = process.env.DB_ROOT;
    previousPath = process.env.DB_PATH;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-import-"));
    process.env.DB_ROOT = tmpDir;
    delete process.env.DB_PATH;
    jest.resetModules();
    const database = await import("../../utils/db.js");
    db = database.db;
    db.data = {};
    database.ensureDbData();
    await db.write();
    app = express();
    app.use((await import("../../routes/db/import.js")).default);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (previousRoot === undefined) delete process.env.DB_ROOT;
    else process.env.DB_ROOT = previousRoot;
    if (previousPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previousPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function importBackups(...backups) {
    const zip = new JSZip();
    for (const [index, data] of backups.entries()) {
      const folder = zip.folder(`Experiment-${index}`);
      folder.file("data.json", JSON.stringify(data));
      folder.folder("img").file("stimulus.png", "image-bytes");
    }
    return request(app).post("/api/import-experiments")
      .attach("zipfile", await zip.generateAsync({ type: "nodebuffer" }), "backup.zip");
  }

  function expectCurrentContract(doc) {
    expect(buildExperimentGraph(doc).diagnostics).toEqual([]);
    for (const trial of doc.trials) expect(() => assertTrialBranching(doc, trial)).not.toThrow();
    for (const loop of doc.loops) expect(() => assertLoopHasNoBranching(loop)).not.toThrow();
    expect(() => assertTimelineBranching(doc, doc.timeline)).not.toThrow();
  }

  test("rewrites legacy loop destinations in both records without changing CSV, exits, configuration, media or sessions", async () => {
    const original = backup();
    const result = await importBackups(original);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, imported: 1 });
    await db.read();
    const doc = db.data.trials[0];
    expect(doc.trials[0].branches).toEqual([2]);
    expect(doc.timeline[0].branches).toEqual([2]);
    expect(doc.timeline[1]).not.toHaveProperty("branches");
    expect(doc.loops).toEqual(original.trials.loops);
    expect(doc.trials.slice(1)).toEqual(original.trials.trials.slice(1));
    expect(doc.updatedAt).not.toBe(original.trials.updatedAt);
    expect(db.data.experiments).toEqual([original.experiment]);
    expect(db.data.configs).toEqual([original.config]);
    expect(db.data.sessionResults).toEqual(original.sessionResults);
    expect(db.data.sessionCounters.legacy).toBe(4);
    expect(fs.readFileSync(path.join(tmpDir, "Legacy", "img", "stimulus.png"), "utf8")).toBe("image-bytes");
    expectCurrentContract(doc);
  });

  test("resolves ordered nested entrances and conditional targets, preserving conditions and parameters", async () => {
    const original = backup();
    const condition = { id: "condition", nextTrialId: "outer", rules: [{ column: "response", op: "==", value: "yes" }], customParameters: { duration: { source: "typed", value: 10 } } };
    original.trials.trials[0].branches = ["outer", "2"];
    original.trials.trials[0].branchConditions = [condition];
    original.trials.timeline[0].branches = ["outer", "2"];
    original.trials.timeline[0].branchConditions = [condition];
    original.trials.trials[1].parentLoopId = "inner";
    original.trials.trials.push({ id: 4, parentLoopId: "outer", branches: [] });
    original.trials.loops[0].trials = ["inner", 4];
    original.trials.loops[0].branches = [];
    original.trials.loops[0].branchConditions = null;
    original.trials.loops.push({ id: "inner", parentLoopId: "outer", trials: ["2"], branches: [], branchConditions: [] });
    expect((await importBackups(original)).status).toBe(200);
    await db.read();
    const doc = db.data.trials[0];
    for (const trial of [doc.trials[0], doc.timeline[0]]) {
      expect(trial.branches).toEqual([2]);
      expect(trial.branchConditions).toEqual([{ ...condition, nextTrialId: 2 }]);
    }
    expect(doc.loops.map(loop => loop.trials)).toEqual([["inner", 4], ["2"]]);
    expectCurrentContract(doc);
  });

  test("keeps current backups unchanged and remains idempotent after a migration", async () => {
    const original = backup();
    original.trials.trials[0].branches = ["2"];
    original.trials.timeline[0].branches = ["2"];
    delete original.trials.timeline[1].branches;
    expect((await importBackups(original)).status).toBe(200);
    await db.read();
    expect(db.data.trials[0]).toEqual(original.trials);
    expect((await importBackups(backup())).status).toBe(200);
    await db.read();
    const migrated = structuredClone(db.data.trials[0]);
    expect((await importBackups({ ...original, trials: migrated })).status).toBe(200);
    await db.read();
    expect(db.data.trials[0]).toEqual(migrated);
    expect(db.data.trials).toHaveLength(1);
    expectCurrentContract(migrated);
  });

  test("migrates each experiment in a multiple-experiment ZIP", async () => {
    const second = backup();
    second.experiment = { experimentID: "second", name: "Second" };
    second.trials.experimentID = "second";
    delete second.config;
    delete second.sessionResults;
    delete second.sessionCounter;
    const result = await importBackups(backup(), second);
    expect(result.body).toEqual({ success: true, imported: 2 });
    await db.read();
    expect(db.data.trials).toHaveLength(2);
    for (const doc of db.data.trials) expectCurrentContract(doc);
  });

  test.each([
    ["empty entrance", doc => { doc.loops[0].trials = []; }],
    ["missing entrance", doc => { doc.loops[0].trials = ["deleted"]; }],
    ["cyclic entrance", doc => { doc.loops[0].trials = ["outer"]; }],
    ["loop branches", doc => { doc.loops[0].branches = [3]; }],
    ["timeline loop conditions", doc => { doc.timeline[1].branchConditions = [{ nextTrialId: 3 }]; }],
  ])("rejects an ambiguous legacy %s before persisting any experiment or media", async (_name, change) => {
    const invalid = backup();
    change(invalid.trials);
    const before = structuredClone(db.data);
    const write = jest.spyOn(db, "write");
    const result = await importBackups(backup(), invalid);
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ success: false, code: "LEGACY_IMPORT_NOT_MIGRATABLE" });
    expect(result.body.error).toContain("legacy");
    expect(write).not.toHaveBeenCalled();
    expect(db.data).toEqual(before);
    await db.read();
    expect(db.data).toEqual(before);
    expect(fs.existsSync(path.join(tmpDir, "Legacy"))).toBe(false);
    expect(fs.readdirSync(path.join(tmpDir, "database"))).toEqual(["db.json"]);
  });
});
