import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import JSZip from "jszip";
import { beforeEach, afterEach, test, expect, jest } from "@jest/globals";

let app, db, directory, previousRoot, previousPath;
beforeEach(async () => {
  previousRoot = process.env.DB_ROOT;
  previousPath = process.env.DB_PATH;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-import-"));
  process.env.DB_ROOT = directory;
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
  if (previousRoot === undefined) delete process.env.DB_ROOT;
  else process.env.DB_ROOT = previousRoot;
  if (previousPath === undefined) delete process.env.DB_PATH;
  else process.env.DB_PATH = previousPath;
  fs.rmSync(directory, { recursive: true, force: true });
});

const trial = (id, fields = {}) => ({ id, name: `Trial ${id}`, ...fields });
const backup = (trials, loops = [], timeline) => ({
  experiment: { experimentID: "legacy", name: "Legacy" },
  trials: {
    experimentID: "legacy",
    updatedAt: "old-revision",
    trials,
    loops,
    timeline: timeline ?? trials.map(({ id, name }) => ({ id, name, type: "trial" })),
  },
  config: { experimentID: "legacy", keep: true },
  sessionCounter: 9,
  sessionResults: [{ experimentID: "legacy", sessionId: "saved", data: [{ rt: 42 }] }],
});
async function importBackups(...backups) {
  const zip = new JSZip();
  backups.forEach((data, index) => {
    zip.file(`${index}/data.json`, JSON.stringify(data));
    zip.file(`${index}/img/stimulus.png`, "image-bytes");
  });
  return request(app).post("/api/import-experiments").attach(
    "zipfile", await zip.generateAsync({ type: "nodebuffer" }), "backup.zip",
  );
}
async function imported(data) {
  const response = await importBackups(data);
  expect(response.body).toEqual({ success: true, imported: 1 });
  await db.read();
  return db.data.trials[0];
}

test("converts navigation conditions in their original priority and keeps experiment contents", async () => {
  const data = backup([
    trial(1, {
      branches: [2, "2", 3],
      branchConditions: [[{ id: 7, rules: [{ column: "response", op: "==", value: "go" }], nextTrialId: 3,
        customParameters: { stimulus: { source: "typed", value: "override" } } }]],
      repeatConditions: [{ id: 7, rules: [{ column: "response", op: "==", value: "back" }], jumpToTrialId: 1 }],
      csvJson: [{ stimulus: "a" }], parameters: { duration: 100 },
      paramsOverride: [{ keep: true }], customOnFinish: "data.keep = true;",
    }), trial(2), trial(3),
  ]);
  const original = structuredClone(data);
  const doc = await imported(data);
  expect(data).toEqual(original);
  expect(doc.entryItemId).toBe(1);
  expect(doc.trials[0]).toMatchObject({
    branches: [2, 3, 1], defaultNextTrialId: 2,
    csvJson: original.trials.trials[0].csvJson,
    parameters: { duration: 100 }, paramsOverride: [{ keep: true }], customOnFinish: "data.keep = true;",
  });
  expect(doc.trials[0].branchConditions.map(c => c.nextTrialId)).toEqual([1, 3]);
  expect(doc.trials[0].branchConditions.map(c => c.rules)).toEqual([
    original.trials.trials[0].repeatConditions[0].rules,
    original.trials.trials[0].branchConditions[0][0].rules,
  ]);
  expect(new Set(doc.trials[0].branchConditions.map(c => c.id)).size).toBe(2);
  expect(doc.trials[0].branchConditions[1].customParameters).toEqual(
    original.trials.trials[0].branchConditions[0][0].customParameters,
  );
  expect(JSON.stringify(doc)).not.toMatch(/repeatConditions|jumpToTrialId/);
  expect(doc.updatedAt).not.toBe("old-revision");
  expect(db.data.configs).toEqual([data.config]);
  expect(db.data.sessionResults).toEqual(data.sessionResults);
  expect(db.data.sessionCounters.legacy).toBe(9);
  expect(fs.readFileSync(path.join(directory, "Legacy/img/stimulus.png"), "utf8")).toBe("image-bytes");
  // The converted export needs no migration on the following import.
  expect(await imported({ ...data, trials: doc })).toEqual(doc);
});

test("materializes an implicit sequence and keeps branch leaves terminal", async () => {
  let doc = await imported(backup([trial(1), trial(2), trial(3)]));
  expect(doc.trials.map(t => t.defaultNextTrialId)).toEqual([2, 3, null]);
  expect(doc.trials.map(t => t.branches)).toEqual([[2], [3], []]);
  doc = await imported(backup([trial(1, { branches: [2, 3] }), trial(2), trial(3), trial(4)]));
  expect(doc.trials.map(t => t.defaultNextTrialId)).toEqual([2, null, null, null]);
});

test("materializes the previous shared-destination continuation explicitly", async () => {
  const doc = await imported(backup([
    trial(1, { branches: [2, 3] }), trial(2, { branches: [4] }),
    trial(3, { branches: [4] }), trial(4), trial(5),
  ]));
  expect(doc.trials.find(t => t.id === 4)).toMatchObject({ branches: [5], defaultNextTrialId: 5 });
});

test.each(["outer", 10])("converts nested loops with an old entry target %s without changing iteration settings", async (target) => {
  const loops = [
    { id: "outer", trials: ["inner", 12], branches: [], branchConditions: [], repeatConditions: [],
      repetitions: 3, isConditionalLoop: true, loopConditions: [{ id: 1, rules: [] }],
      csvJson: [{ order: 2 }, { order: 1 }], stimuliOrders: [[1, 0]], categoryData: ["A", "B"],
      randomize: true, customOnTimelineFinish: "window.keep = true;" },
    { id: "inner", parentLoopId: "outer", trials: [10, 11], repetitions: 2 },
  ];
  const data = backup([
    trial(1, { branches: [target], branchConditions: [[{ id: 1, rules: [], nextTrialId: target }]] }),
    trial(10, { parentLoopId: "inner", branches: [11] }),
    trial(11, { parentLoopId: "inner", branches: [12] }),
    trial(12, { parentLoopId: "outer", branches: [2] }), trial(2),
  ], loops, [{ id: 1, type: "trial" }, { id: "outer", type: "loop", branches: [], repeatConditions: [] }, { id: 2, type: "trial" }]);
  const doc = await imported(data);
  expect(doc.trials[0]).toMatchObject({ branches: [10], defaultNextTrialId: 10, branchConditions: [{ nextTrialId: 10 }] });
  expect(doc.loops[0]).toMatchObject({ ...Object.fromEntries(Object.entries(loops[0]).filter(([key]) => !["branches", "branchConditions", "repeatConditions"].includes(key))), entryItemId: "inner", nextItemId: null });
  expect(doc.loops[1]).toMatchObject({ entryItemId: 10, nextItemId: 12 });
  expect(JSON.stringify(doc)).not.toMatch(/repeatConditions|jumpToTrialId/);
  expect(doc.timeline[0]).toMatchObject({ branches: [10], defaultNextTrialId: 10 });
  expect(doc.timeline[1]).not.toHaveProperty("branches");
});

test("handles empty scopes and experiment completion without creating a sentinel edge", async () => {
  let doc = await imported(backup([], [{ id: "empty", trials: [] }], [{ id: "empty", type: "loop" }]));
  expect(doc).toMatchObject({ entryItemId: "empty", loops: [{ entryItemId: null, nextItemId: null }] });
  doc = await imported(backup([trial(1, { branches: ["FINISH_EXPERIMENT"] })]));
  expect(doc.trials[0]).toMatchObject({ branches: [], defaultNextTrialId: "FINISH_EXPERIMENT" });
});

test("resolves entries through eight nested loops and removes duplicate root summaries", async () => {
  const loops = Array.from({ length: 8 }, (_, i) => ({
    id: `level-${i}`, trials: [i === 7 ? 2 : `level-${i + 1}`],
    ...(i ? { parentLoopId: `level-${i - 1}` } : {}),
    repetitions: i + 1,
  }));
  const doc = await imported(backup([
    trial(1, { branches: ["level-0"] }), trial(2, { parentLoopId: "level-7" }),
  ], loops, [{ id: 1, type: "trial" }, ...loops.map(l => ({ id: l.id, type: "loop" })), { id: 2, type: "trial" }]));
  expect(doc.timeline.map(t => t.id)).toEqual([1, "level-0"]);
  expect(doc.trials[0].defaultNextTrialId).toBe(2);
  expect(doc.loops.map(l => l.entryItemId)).toEqual([...loops.slice(1).map(l => l.id), 2]);
  expect(doc.loops.map(l => l.repetitions)).toEqual(loops.map(l => l.repetitions));
});

test("preserves implicit condition targets and explicit completion", async () => {
  const doc = await imported(backup([
    trial(1, {
      branches: [2],
      branchConditions: [{ id: 1, rules: [], customParameters: { duration: { source: "typed", value: 50 } } }],
      repeatConditions: [{ id: 2, rules: [{ column: "response", op: "==", value: "stop" }], jumpToTrialId: "FINISH_EXPERIMENT" }],
    }), trial(2),
  ]));
  expect(doc.trials[0]).toMatchObject({ branches: [2], defaultNextTrialId: 2 });
  expect(doc.trials[0].branchConditions.map(c => c.nextTrialId)).toEqual(["FINISH_EXPERIMENT", 2]);
  expect(doc.trials[0].branchConditions[1].customParameters.duration.value).toBe(50);
});

test.each(["loop-navigation", "loop-summary", "empty-target", "missing-target", "repeat", "ownership", "cycle", "entry"])(
  "rejects unmigratable %s before writing any experiment or media", async (kind) => {
    const data = backup([trial(1), trial(2)]);
    if (kind === "loop-navigation") {
      data.trials.loops = [{ id: "loop", trials: [], repeatConditions: [{ rules: [], jumpToTrialId: 1 }] }];
      data.trials.timeline.push({ id: "loop", type: "loop" });
    }
    if (kind === "loop-summary") {
      data.trials.loops = [{ id: "loop", trials: [2] }];
      data.trials.timeline.push({ id: "loop", type: "loop", branches: [1] });
    }
    if (kind === "empty-target") {
      data.trials.loops = [{ id: "loop", trials: [] }];
      data.trials.timeline.push({ id: "loop", type: "loop" });
      data.trials.trials[0].branches = ["loop"];
    }
    if (kind === "missing-target") data.trials.trials[0].branches = ["missing"];
    if (kind === "repeat") data.trials.trials[0].repeatConditions = [{ rules: [] }];
    if (kind === "ownership") {
      data.trials.loops = [{ id: "a", trials: [1] }, { id: "b", trials: [1] }];
      data.trials.timeline = [{ id: "a", type: "loop" }, { id: "b", type: "loop" }, { id: 2, type: "trial" }];
    }
    if (kind === "cycle") {
      data.trials.loops = [{ id: "a", trials: ["b"] }, { id: "b", trials: ["a"] }];
    }
    if (kind === "entry") {
      data.trials.trials[0].branches = [2];
      data.trials.trials[1].branches = [1];
    }
    const before = JSON.stringify(db.data);
    const valid = backup([trial(1)]);
    valid.experiment = { experimentID: "first", name: "First" };
    valid.trials.experimentID = "first";
    const response = await importBackups(valid, data);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("LEGACY_IMPORT_NOT_MIGRATABLE");
    await db.read();
    expect(JSON.stringify(db.data)).toBe(before);
    expect(fs.existsSync(path.join(directory, "First"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "Legacy"))).toBe(false);
  },
);
