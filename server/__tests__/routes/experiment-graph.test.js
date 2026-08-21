import fs from "fs";
import os from "os";
import path from "path";
import process from "node:process";
import express from "express";
import request from "supertest";
import { describe, expect, jest, test } from "@jest/globals";

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "experiment-graph-"));
  process.env.DB_ROOT = tmpDir;
  delete process.env.DB_PATH;
  jest.resetModules();

  const { db, ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  await db.write();

  const router = (await import("../../routes/timeline/index.js")).default;
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/", router);
  return { app, db };
};

const seedGraph = async (db) => {
  db.data.trials.push({
    experimentID: "E1",
    updatedAt: "2026-08-20T00:00:00.000Z",
    timeline: [
      { id: 1, type: "trial", name: "Start", branches: [2, 3] },
      { id: 2, type: "trial", name: "Left", branches: ["outer"] },
      { id: 3, type: "trial", name: "Right", branches: [] },
      {
        id: "outer",
        type: "loop",
        name: "Outer",
        branches: [8],
        trials: [4, "inner"],
      },
      { id: 8, type: "trial", name: "Root exit", branches: [] },
    ],
    trials: [
      { id: 1, type: "Trial", name: "Start", branches: [2, 3] },
      { id: 2, type: "Trial", name: "Left", branches: ["outer"] },
      { id: 3, type: "Trial", name: "Right", branches: [] },
      {
        id: 4,
        type: "Trial",
        name: "Outer source",
        parentLoopId: "outer",
        branches: [5, "inner", 8],
      },
      {
        id: 5,
        type: "Trial",
        name: "Outer branch",
        parentLoopId: "outer",
        branches: [],
      },
      {
        id: 6,
        type: "Trial",
        name: "Inner source",
        parentLoopId: "inner",
        branches: [],
      },
      { id: 8, type: "Trial", name: "Root exit", branches: [] },
    ],
    loops: [
      {
        id: "outer",
        name: "Outer",
        trials: [4, "inner"],
        branches: [],
        exitBranchRoutes: [
          { sourceTrialId: 3, targetTrialId: 8 },
        ],
      },
      {
        id: "inner",
        name: "Inner",
        parentLoopId: "outer",
        trials: [6],
        branches: [],
      },
    ],
  });
  await db.write();
};

const edgeKeys = (graph) =>
  graph.edges.map((edge) => `${edge.sourceId}->${edge.targetId}`);

describe("canonical experiment graph", () => {
  test("derives cross-scope routes only from canonical item branches", async () => {
    const { app, db } = await freshApp();
    await seedGraph(db);

    const response = await request(app).get("/api/experiment-graph/E1").expect(200);
    const { graph } = response.body;

    expect(edgeKeys(graph)).toContain("4->8");
    expect(edgeKeys(graph)).not.toContain("3->8");
    expect(graph.edges.find((edge) => edge.sourceId === 4 && edge.targetId === 8))
      .toMatchObject({
        sourceOwnerId: "outer",
        targetOwnerId: null,
        exitedLoopIds: ["outer"],
      });
    expect(graph.root.items.find((item) => item.id === "outer").branches)
      .toEqual([]);
    expect(graph.scopes.outer.items.map((item) => item.id))
      .toEqual([4, "inner", 5]);
  });

  test("returns one coherent graph after inserting another nested branch", async () => {
    const { app, db } = await freshApp();
    await seedGraph(db);

    const response = await request(app)
      .post("/api/loop-branch/E1")
      .send({ sourceTrialId: 6, targetScopeId: "inner", mode: "parallel" })
      .expect(200);
    const { graph, trial } = response.body;

    expect(edgeKeys(graph)).toContain(`6->${trial.id}`);
    expect(edgeKeys(graph)).toContain("4->8");
    expect(edgeKeys(graph)).not.toContain("3->8");
    expect(graph.scopes.inner.items.map((item) => item.id))
      .toEqual([6, trial.id]);

    await db.read();
    const doc = db.data.trials[0];
    expect(doc.loops.every((loop) => !("exitBranchRoutes" in loop))).toBe(true);
    expect(doc.loops.find((loop) => loop.id === "inner").trials)
      .toEqual([6, trial.id]);
  });

  test("owns a regular trial and returns its graph in the same mutation", async () => {
    const { app, db } = await freshApp();
    await seedGraph(db);

    const response = await request(app)
      .post("/api/trial/E1")
      .send({
        type: "Trial",
        name: "New nested trial",
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
        branches: [],
        parentLoopId: "inner",
      })
      .expect(200);

    expect(response.body.graph.scopes.inner.items.map((item) => item.id))
      .toEqual([6, response.body.trial.id]);
    await db.read();
    expect(db.data.trials[0].loops.find((loop) => loop.id === "inner").trials)
      .toEqual([6, response.body.trial.id]);
  });

  test("groups nested items and reassigns ownership atomically", async () => {
    const { app, db } = await freshApp();
    await seedGraph(db);

    const response = await request(app)
      .post("/api/loop/E1")
      .send({
        name: "Nested around source",
        parentLoopId: "outer",
        trials: [4],
        branches: [],
        repetitions: 1,
      })
      .expect(200);
    const loopId = response.body.loop.id;

    expect(response.body.graph.scopes.outer.items.map((item) => item.id))
      .toContain(loopId);
    expect(response.body.graph.scopes[loopId].items.map((item) => item.id))
      .toEqual([4]);
    await db.read();
    expect(db.data.trials[0].trials.find((trial) => trial.id === 4).parentLoopId)
      .toBe(loopId);
  });
});
