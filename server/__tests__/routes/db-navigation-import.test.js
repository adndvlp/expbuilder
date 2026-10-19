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
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "branching-import-"));
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
const backup = (id = "E1") => ({
  experiment: { experimentID: id, name: id },
  trials: {
    experimentID: id,
    entryItemId: 1,
    trials: [
      {
        id: 1,
        name: "Source",
        branches: [],
        branchConditions: [],
        defaultNextTrialId: null,
      },
    ],
    loops: [],
    timeline: [{ id: 1, type: "trial", name: "Source" }],
  },
  config: { experimentID: id, keep: true },
  sessionCounter: 3,
  sessionResults: [
    { experimentID: id, sessionId: "saved", data: [{ response: "yes" }] },
  ],
});
async function importBackups(...backups) {
  const zip = new JSZip();
  for (const [index, value] of backups.entries()) {
    zip.file(`Experiment-${index}/data.json`, JSON.stringify(value));
    zip.file(`Experiment-${index}/img/stimulus.png`, "image-bytes");
  }
  return request(app)
    .post("/api/import-experiments")
    .attach(
      "zipfile",
      await zip.generateAsync({ type: "nodebuffer" }),
      "backup.zip",
    );
}
test("preserves a current experiment, media, configuration, CSV and sessions", async () => {
  const data = backup();
  data.trials.trials[0].csvJson = [{ stimulus: "a" }];
  expect((await importBackups(data)).status).toBe(200);
  await db.read();
  expect(db.data.trials[0]).toEqual(data.trials);
  expect(db.data.configs[0]).toEqual(data.config);
  expect(db.data.sessionResults).toEqual(data.sessionResults);
  expect(db.data.sessionCounters.E1).toBe(3);
  expect(
    fs.readFileSync(path.join(directory, "E1/img/stimulus.png"), "utf8"),
  ).toBe("image-bytes");
});
test.each(["default", "entry", "condition", "container", "unsupported"])(
  "rejects invalid %s data before any database or media mutation",
  async (kind) => {
    const data = backup();
    if (kind === "default") delete data.trials.trials[0].defaultNextTrialId;
    if (kind === "entry") delete data.trials.entryItemId;
    if (kind === "condition")
      data.trials.trials[0].branchConditions = [
        [{ id: 1, rules: [], nextTrialId: 1 }],
      ];
    if (kind === "unsupported") data.trials.trials[0].repeatConditions = [];
    if (kind === "container") {
      data.trials.loops = [
        { id: "rows", entryItemId: null, nextItemId: null, trials: [] },
      ];
      data.trials.trials[0].branches = ["rows"];
    }
    const before = JSON.stringify(db.data);
    expect((await importBackups(data)).status).toBe(400);
    await db.read();
    expect(JSON.stringify(db.data)).toBe(before);
    expect(fs.existsSync(path.join(directory, "E1/img/stimulus.png"))).toBe(
      false,
    );
  },
);
test("validates all experiments before restoring the first media file", async () => {
  const invalid = backup("E2");
  delete invalid.trials.entryItemId;
  expect((await importBackups(backup(), invalid)).status).toBe(400);
  await db.read();
  expect(db.data.trials).toEqual([]);
  expect(fs.existsSync(path.join(directory, "E1"))).toBe(false);
});
test("imports several current experiments without changing their navigation", async () => {
  const first = backup(),
    second = backup("E2");
  expect((await importBackups(first, second)).body).toEqual({
    success: true,
    imported: 2,
  });
  await db.read();
  expect(db.data.trials).toEqual([first.trials, second.trials]);
});
test("preserves loop repetitions and conditional cycles", async () => {
  const data = backup();
  data.trials.entryItemId = "rows";
  data.trials.trials[0].parentLoopId = "rows";
  data.trials.loops = [
    {
      id: "rows",
      trials: [1],
      entryItemId: 1,
      nextItemId: null,
      repetitions: 4,
      isConditionalLoop: true,
      loopConditions: [
        {
          id: 1,
          rules: [{ trialId: 1, column: "response", op: "==", value: "again" }],
        },
      ],
    },
  ];
  data.trials.timeline = [{ id: "rows", type: "loop" }];
  expect((await importBackups(data)).status).toBe(200);
  await db.read();
  expect(db.data.trials[0].loops).toEqual(data.trials.loops);
});

test.each(["cycle", "ambiguous", "dangling"])(
  "rejects %s ownership before restoring media",
  async (kind) => {
    const data = backup();
    const rows = {
      id: "rows",
      parentLoopId: null,
      trials: [1],
      entryItemId: 1,
      nextItemId: null,
    };
    data.trials.entryItemId = "rows";
    data.trials.timeline = [{ id: "rows", type: "loop" }];
    data.trials.trials[0].parentLoopId = "rows";
    data.trials.loops = [rows];
    if (kind === "cycle") {
      rows.parentLoopId = "rows";
      rows.trials.push("rows");
      data.trials.entryItemId = null;
      data.trials.timeline = [];
    }
    if (kind === "ambiguous") {
      data.trials.loops.push({
        id: "other",
        parentLoopId: null,
        trials: [1],
        entryItemId: 1,
        nextItemId: null,
      });
      data.trials.timeline.push({ id: "other", type: "loop" });
    }
    if (kind === "dangling") rows.trials.push("missing");
    const before = JSON.stringify(db.data);
    expect((await importBackups(data)).status).toBe(400);
    await db.read();
    expect(JSON.stringify(db.data)).toBe(before);
    expect(fs.existsSync(path.join(directory, "E1/img/stimulus.png"))).toBe(
      false,
    );
  },
);
