import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { jest } from "@jest/globals";

async function createHarness() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "session-write-failure-"));
  process.env.DB_ROOT = root;
  delete process.env.DB_PATH;
  jest.resetModules();

  const { db, ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  db.data.experiments.push({
    experimentID: "experiment-1",
    name: "Experiment 1",
  });
  await db.write();

  const router = (await import("../../routes/results.js")).default;
  const app = express();
  app.use(express.json());
  app.use(router);

  return {
    app,
    db,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
      delete process.env.DB_ROOT;
    },
  };
}

function rejectNextWrite(db) {
  return jest
    .spyOn(db, "write")
    .mockRejectedValueOnce(new Error("simulated disk failure"));
}

describe("session write failures", () => {
  test("does not acknowledge or persist a session when creation cannot write", async () => {
    const harness = await createHarness();
    try {
      const write = rejectNextWrite(harness.db);
      const response = await request(harness.app)
        .post("/api/append-result/experiment-1")
        .send({ sessionId: "failed-create" })
        .expect(500);

      expect(response.body.success).toBe(false);
      write.mockRestore();
      await harness.db.read();
      expect(harness.db.data.sessionResults).toEqual([]);
      expect(harness.db.data.sessionCounters).toEqual({});
    } finally {
      harness.cleanup();
    }
  });

  test("does not acknowledge or persist an event when its write fails", async () => {
    const harness = await createHarness();
    try {
      await request(harness.app)
        .post("/api/append-result/experiment-1")
        .send({ sessionId: "event-session" })
        .expect(200);

      const write = rejectNextWrite(harness.db);
      const response = await request(harness.app)
        .put("/api/append-result/experiment-1")
        .send({
          sessionId: "event-session",
          eventId: "event-session:0",
          sequence: 0,
          response: { answer: "must remain pending" },
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      write.mockRestore();
      await harness.db.read();
      expect(harness.db.data.sessionResults[0].data).toEqual([]);
      expect(harness.db.data.sessionResults[0].events).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  test("does not acknowledge or persist completion when its write fails", async () => {
    const harness = await createHarness();
    try {
      await request(harness.app)
        .post("/api/append-result/experiment-1")
        .send({ sessionId: "completion-session" })
        .expect(200);
      await request(harness.app)
        .put("/api/append-result/experiment-1")
        .send({
          sessionId: "completion-session",
          eventId: "completion-session:0",
          sequence: 0,
          response: { answer: "stored" },
        })
        .expect(200);

      const write = rejectNextWrite(harness.db);
      const response = await request(harness.app)
        .post("/api/complete-session/experiment-1")
        .send({
          sessionId: "completion-session",
          expectedEventCount: 1,
          lastSequence: 0,
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      write.mockRestore();
      await harness.db.read();
      expect(harness.db.data.sessionResults[0]).toMatchObject({
        sessionId: "completion-session",
        state: "in-progress",
      });
      expect(harness.db.data.sessionResults[0].completedAt).toBeUndefined();
    } finally {
      harness.cleanup();
    }
  });
});
