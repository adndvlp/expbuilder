/**
 * Integration tests for the timeline trial routes. Each test spins up a fresh
 * Express app backed by a temp DB_ROOT so the on-disk db.json is isolated.
 */
import path from "path";
import fs from "fs";
import os from "os";
import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "exp-trials-"));
  process.env.DB_ROOT = tmpDir;
  delete process.env.DB_PATH;
  jest.resetModules();

  const { db, ensureDbData } = await import("../../utils/db.js");
  // Defensive reset so a pre-existing db.json does not leak state.
  db.data = {};
  ensureDbData();
  await db.write();

  const trialsRouter = (await import("../../routes/timeline/index.js")).default;
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/", trialsRouter);

  return { app, db, tmpDir };
};

describe("POST /api/trial/:experimentID", () => {
  test("creates experiment doc + trial on first call", async () => {
    const { app } = await freshApp();
    const res = await request(app)
      .post("/api/trial/E1")
      .send({ name: "T1", plugin: "plugin-html-keyboard-response" })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trial.id).toBeGreaterThan(0);
    expect(res.body.trial.name).toBe("T1");
  });

  test("appends timeline entry for non-loop trial", async () => {
    const { app } = await freshApp();
    const create = await request(app)
      .post("/api/trial/E1")
      .send({ name: "T1", plugin: "p" })
      .expect(200);
    const meta = await request(app).get("/api/trials-metadata/E1").expect(200);
    expect(meta.body.timeline).toHaveLength(1);
    expect(meta.body.timeline[0]).toEqual({
      id: create.body.trial.id,
      type: "trial",
      name: "T1",
      branches: [],
    });
  });

  test("skips timeline when trial has parentLoopId", async () => {
    const { app } = await freshApp();
    await request(app)
      .post("/api/trial/E1")
      .send({ name: "T_in_loop", plugin: "p", parentLoopId: "loop_1" })
      .expect(200);
    const meta = await request(app).get("/api/trials-metadata/E1").expect(200);
    expect(meta.body.timeline).toHaveLength(0);
  });
});

describe("GET /api/trials-metadata/:experimentID", () => {
  test("returns empty timeline for unknown experiment", async () => {
    const { app } = await freshApp();
    const res = await request(app)
      .get("/api/trials-metadata/DOES_NOT_EXIST")
      .expect(200);
    expect(res.body).toEqual({ timeline: [] });
  });
});

describe("GET /api/trials-extensions/:experimentID", () => {
  test("404 on unknown experiment", async () => {
    const { app } = await freshApp();
    await request(app).get("/api/trials-extensions/NO").expect(404);
  });

  test("returns unique extensionType from trials flagged includesExtensions", async () => {
    const { app } = await freshApp();
    await request(app)
      .post("/api/trial/E1")
      .send({
        name: "T1",
        plugin: "p",
        parameters: { includesExtensions: true, extensionType: "webgazer" },
      });
    await request(app)
      .post("/api/trial/E1")
      .send({
        name: "T2",
        plugin: "p",
        parameters: { includesExtensions: true, extensionType: "webgazer" },
      });
    await request(app)
      .post("/api/trial/E1")
      .send({
        name: "T3",
        plugin: "p",
        parameters: { includesExtensions: true, extensionType: "mouse-tracking" },
      });
    const res = await request(app).get("/api/trials-extensions/E1").expect(200);
    expect(new Set(res.body.extensions)).toEqual(
      new Set(["webgazer", "mouse-tracking"]),
    );
  });

  test("omits trials without includesExtensions flag", async () => {
    const { app } = await freshApp();
    await request(app)
      .post("/api/trial/E1")
      .send({ name: "T1", plugin: "p", parameters: { extensionType: "any" } });
    const res = await request(app).get("/api/trials-extensions/E1").expect(200);
    expect(res.body.extensions).toEqual([]);
  });
});

describe("GET /api/trial/:experimentID/:id", () => {
  test("returns the trial by id", async () => {
    const { app } = await freshApp();
    const created = await request(app)
      .post("/api/trial/E1")
      .send({ name: "T1", plugin: "p" });
    const id = created.body.trial.id;
    const res = await request(app).get(`/api/trial/E1/${id}`).expect(200);
    expect(res.body.trial.name).toBe("T1");
  });

  test("404 when trial id missing", async () => {
    const { app } = await freshApp();
    await request(app)
      .post("/api/trial/E1")
      .send({ name: "T1", plugin: "p" });
    await request(app).get("/api/trial/E1/999999").expect(404);
  });
});
