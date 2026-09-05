import path from "path";
import fs from "fs";
import os from "os";
import process from "node:process";
import express from "express";
import request from "supertest";
import { describe, expect, jest, test } from "@jest/globals";

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "exp-loop-branches-"));
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

const seedNestedExperiment = async (db) => {
  db.data.trials.push({
    experimentID: "E1",
    trials: [
      {
        id: 1,
        type: "Trial",
        name: "Source",
        parentLoopId: "inner",
        branches: [2, 3],
      },
      {
        id: 2,
        type: "Trial",
        name: "Middle exit",
        parentLoopId: "middle",
        branches: [],
      },
      { id: 3, type: "Trial", name: "Root exit", branches: [] },
      {
        id: 4,
        type: "Trial",
        name: "Later inner trial",
        parentLoopId: "inner",
        branches: [],
      },
    ],
    loops: [
      {
        id: "outer",
        name: "Outer loop",
        trials: ["middle"],
        branches: [],
      },
      {
        id: "middle",
        name: "Middle loop",
        parentLoopId: "outer",
        trials: ["inner", 2],
        branches: [],
      },
      {
        id: "inner",
        name: "Inner loop",
        parentLoopId: "middle",
        trials: [1, 4],
        branches: [],
      },
    ],
    timeline: [
      {
        id: "outer",
        type: "loop",
        name: "Outer loop",
        branches: [3],
        trials: ["middle"],
      },
      { id: 3, type: "trial", name: "Root exit", branches: [] },
    ],
  });
  await db.write();
};

describe("loop exit branches", () => {
  test("[TD-03] [TD-06] lists current, ancestor, and root levels with per-level counts", async () => {
    const { app, db } = await freshApp();
    await seedNestedExperiment(db);

    const response = await request(app)
      .get("/api/loop-branch-levels/E1/1")
      .expect(200);

    expect(response.body.levels).toEqual([
      expect.objectContaining({ scopeId: "inner", branchCount: 0 }),
      expect.objectContaining({ scopeId: "middle", branchCount: 1 }),
      expect.objectContaining({ scopeId: "outer", branchCount: 0 }),
      expect.objectContaining({ scopeId: null, branchCount: 1 }),
    ]);
  });

  test("[TA-01] creates a parallel branch with one derived cross-scope route", async () => {
    const { app, db } = await freshApp();
    await seedNestedExperiment(db);

    const response = await request(app)
      .post("/api/loop-branch/E1")
      .set("Idempotency-Key", "parallel-outer")
      .send({ sourceTrialId: 1, targetScopeId: "outer", mode: "parallel" })
      .expect(200);

    await db.read();
    const doc = db.data.trials[0];
    const target = doc.trials.find(
      (trial) => trial.id === response.body.trial.id,
    );
    expect(target).toMatchObject({
      parentLoopId: "outer",
      plugin: "plugin-dynamic",
      branches: [],
    });
    expect(doc.trials.find((trial) => trial.id === 1).branches).toContain(
      target.id,
    );
    expect(doc.loops.find((loop) => loop.id === "outer").trials)
      .toContain(target.id);
    expect(response.body.graph.edges).toContainEqual(
      expect.objectContaining({
        sourceId: 1,
        targetId: target.id,
        exitedLoopIds: ["inner", "middle"],
      }),
    );
    expect(doc.loops.every((loop) => !("exitBranchRoutes" in loop))).toBe(true);
  });

  test("[TA-02] inserts sequentially only before branches in the selected level", async () => {
    const { app, db } = await freshApp();
    await seedNestedExperiment(db);

    const response = await request(app)
      .post("/api/loop-branch/E1")
      .set("Idempotency-Key", "sequential-root")
      .send({ sourceTrialId: 1, targetScopeId: null, mode: "sequential" })
      .expect(200);

    await db.read();
    const doc = db.data.trials[0];
    const source = doc.trials.find((trial) => trial.id === 1);
    const target = doc.trials.find(
      (trial) => trial.id === response.body.trial.id,
    );
    expect(source.branches).toEqual([2, target.id]);
    expect(target.branches).toEqual([3]);
    expect(doc.timeline.map((item) => item.id)).toEqual([
      "outer",
      target.id,
      3,
    ]);
    expect(response.body.graph.edges).toContainEqual(
      expect.objectContaining({
        sourceId: 1,
        targetId: target.id,
        exitedLoopIds: ["inner", "middle", "outer"],
      }),
    );
    expect(response.body.graph.edges).not.toContainEqual(
      expect.objectContaining({ sourceId: 1, targetId: 3 }),
    );
  });

  test("[TA-09] keeps external targets out of an inner loop read model", async () => {
    const { app, db } = await freshApp();
    await seedNestedExperiment(db);

    const response = await request(app)
      .get("/api/loop-trials-metadata/E1/inner")
      .expect(200);

    expect(response.body.trialsMetadata.map((item) => item.id)).toEqual([1, 4]);
    expect(response.body.trialsMetadata[0]).toMatchObject({
      parentLoopId: "inner",
      branches: [2, 3],
    });
  });

  test("[TA-10] keeps projections out of metadata and exposes the canonical edge", async () => {
    const { app, db } = await freshApp();
    await seedNestedExperiment(db);

    const response = await request(app)
      .get("/api/trials-metadata/E1")
      .expect(200);

    expect(response.body.timeline[0]).toMatchObject({
      id: "outer",
      type: "loop",
      branches: [],
    });
    const graphResponse = await request(app)
      .get("/api/experiment-graph/E1")
      .expect(200);
    expect(graphResponse.body.graph.edges).toContainEqual(
      expect.objectContaining({ sourceId: 1, targetId: 3 }),
    );
  });

  test("[TD-04] [TA-07] rejects a destination that is not the current scope or an ancestor", async () => {
    const { app, db } = await freshApp();
    await seedNestedExperiment(db);
    db.data.trials[0].loops.push({
      id: "sibling",
      name: "Sibling",
      trials: [],
      branches: [],
    });
    await db.write();

    await request(app)
      .post("/api/loop-branch/E1")
      .set("Idempotency-Key", "invalid-sibling")
      .send({ sourceTrialId: 1, targetScopeId: "sibling", mode: "parallel" })
      .expect(400);
  });

  test("removes a deleted target from the canonical graph", async () => {
    const { app, db } = await freshApp();
    await seedNestedExperiment(db);

    await request(app).delete("/api/trial/E1/3").expect(200);

    await db.read();
    const doc = db.data.trials[0];
    expect(doc.trials.find((trial) => trial.id === 1).branches).toEqual([2]);
    const response = await request(app).get("/api/experiment-graph/E1").expect(200);
    expect(response.body.graph.edges).toContainEqual(
      expect.objectContaining({ sourceId: 1, targetId: 2 }),
    );
    expect(response.body.graph.edges).not.toContainEqual(
      expect.objectContaining({ sourceId: 1, targetId: 3 }),
    );
  });

  test("derives edited branches without rebuilding stored projections", async () => {
    const { app, db } = await freshApp();
    await seedNestedExperiment(db);

    const response = await request(app)
      .patch("/api/trial/E1/1")
      .send({ branches: [2] })
      .expect(200);

    expect(response.body.graph.edges).toContainEqual(
      expect.objectContaining({ sourceId: 1, targetId: 2 }),
    );
    expect(response.body.graph.edges).not.toContainEqual(
      expect.objectContaining({ sourceId: 1, targetId: 3 }),
    );
  });
});
