import path from "path";
import fs from "fs";
import os from "os";
import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

async function freshApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unique-names-"));
  process.env.DB_ROOT = tmpDir;
  delete process.env.DB_PATH;
  jest.resetModules();

  const { db, ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  db.data.trials.push({
    experimentID: "E1",
    trials: [{ id: 1, name: "New Trial 4", branches: [] }],
    loops: [{ id: "loop_1", name: "Nested Loop 1", trials: [] }],
    timeline: [],
  });
  await db.write();

  const router = (await import("../../routes/timeline/index.js")).default;
  const app = express();
  app.use(express.json());
  app.use("/", router);
  return app;
}

describe("globally unique experiment item names", () => {
  test("increments duplicate trial and nested-loop names before persisting", async () => {
    const app = await freshApp();

    const trial = await request(app)
      .post("/api/trial/E1")
      .send({ name: "New Trial 4", plugin: "plugin-dynamic" })
      .expect(200);
    const loop = await request(app)
      .post("/api/loop/E1")
      .send({ name: "Nested Loop 1", trials: [], parentLoopId: "loop_1" })
      .expect(200);

    expect(trial.body.trial.name).toBe("New Trial 5");
    expect(loop.body.loop.name).toBe("Nested Loop 2");
  });
});
