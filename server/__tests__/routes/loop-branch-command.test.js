import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import process from "node:process";
import request from "supertest";
import { describe, expect, jest, test } from "@jest/globals";

const freshApp = async () => {
  process.env.DB_ROOT = fs.mkdtempSync(
    path.join(os.tmpdir(), "loop-branch-command-"),
  );
  delete process.env.DB_PATH;
  jest.resetModules();
  const { db, ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  db.data.trials.push({
    experimentID: "E1",
    updatedAt: "2026-08-20T00:00:00.000Z",
    timeline: [{ id: "outer", type: "loop", name: "Outer" }],
    trials: [
      {
        id: 1,
        type: "Trial",
        name: "Source",
        parentLoopId: "outer",
        branches: [],
      },
      {
        id: 2,
        type: "Trial",
        name: "Later",
        parentLoopId: "outer",
        branches: [],
      },
    ],
    loops: [
      { id: "outer", name: "Outer", trials: [1, 2], branches: [] },
    ],
  });
  await db.write();
  const router = (await import("../../routes/timeline/index.js")).default;
  const app = express();
  app.use(express.json());
  app.use("/", router);
  return { app, db };
};

const command = (app, key, body = {}) =>
  request(app)
    .post("/api/loop-branch/E1")
    .set("Idempotency-Key", key)
    .send({
      sourceTrialId: 1,
      targetScopeId: null,
      mode: "parallel",
      ...body,
    });

describe("atomic loop branch command", () => {
  test("[TA-03] rolls back target allocation when post-mutation graph validation fails", async () => {
    const { app, db } = await freshApp();
    db.data.trials[0].trials[0].branches = ["missing-target"];
    await db.write();

    const response = await command(app, "rollback-after-allocation").expect(409);
    expect(response.body.code).toBe("GRAPH_INVALID");
    await db.read();
    expect(db.data.trials[0].trials.map(({ id }) => id)).toEqual([1, 2]);
    expect(db.data.trials[0].trials[0].branches).toEqual(["missing-target"]);
    expect(db.data.mutationReceipts).toEqual([]);
  });

  test("[TA-04] [TA-05] replays one command and rejects key reuse with another payload", async () => {
    const { app, db } = await freshApp();
    const first = await command(app, "stable-command").expect(200);
    const retry = await command(app, "stable-command").expect(200);

    expect(retry.body.trial.id).toBe(first.body.trial.id);
    expect(retry.body.revision).toBe(first.body.revision);
    const conflict = await command(app, "stable-command", {
      targetScopeId: "outer",
    }).expect(409);
    expect(conflict.body.code).toBe("IDEMPOTENCY_CONFLICT");
    await db.read();
    expect(db.data.trials[0].trials).toHaveLength(3);
    expect(db.data.mutationReceipts).toHaveLength(1);
  });

  test("[TA-06] rejects a stale revision and returns the current graph", async () => {
    const { app, db } = await freshApp();
    const response = await command(app, "stale-revision", {
      expectedRevision: "stale",
    }).expect(409);

    expect(response.body).toMatchObject({
      code: "REVISION_CONFLICT",
      revision: "2026-08-20T00:00:00.000Z",
      graph: { revision: "2026-08-20T00:00:00.000Z" },
    });
    await db.read();
    expect(db.data.trials[0].trials).toHaveLength(2);
    expect(db.data.mutationReceipts).toEqual([]);
  });

  test("[TA-08] returns the committed revision and canonical owners", async () => {
    const { app } = await freshApp();
    const response = await command(app, "response-read-model", {
      expectedRevision: "2026-08-20T00:00:00.000Z",
    }).expect(200);

    expect(response.body.revision).toBe(response.body.graph.revision);
    expect(response.body.route).toMatchObject({
      sourceId: 1,
      targetId: response.body.trial.id,
      sourceOwnerId: "outer",
      targetOwnerId: null,
      exitedLoopIds: ["outer"],
    });
  });

  test("[TA-11] [TA-12] [TG-03] preserves valid cross-scope conditions and custom parameters", async () => {
    const { app } = await freshApp();
    const created = await command(app, "condition-round-trip").expect(200);
    const branchConditions = [
      {
        id: 91,
        rules: [{ column: "response", op: "==", value: "0" }],
        nextTrialId: created.body.trial.id,
        customParameters: {
          stimulus: { source: "typed", value: "cross-scope" },
        },
      },
    ];

    const updated = await request(app)
      .patch("/api/trial/E1/1")
      .send({ branchConditions })
      .expect(200);
    const loaded = await request(app).get("/api/trial/E1/1").expect(200);

    expect(loaded.body.trial.branchConditions).toEqual(branchConditions);
    expect(loaded.body.trial.repeatConditions ?? []).toEqual([]);
    expect(updated.body.graph.edges).toContainEqual(
      expect.objectContaining({
        sourceId: 1,
        targetId: created.body.trial.id,
      }),
    );
  });
});
