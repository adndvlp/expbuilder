import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { jest } from "@jest/globals";

async function createHarness() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "session-durability-"));
  process.env.DB_ROOT = root;
  delete process.env.DB_PATH;
  jest.resetModules();

  const { db, ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  db.data.experiments.push(
    { experimentID: "experiment-1", name: "Experiment 1" },
    { experimentID: "restart-exp", name: "Restart Experiment" },
  );
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

describe("local session durability", () => {
  test("serializes concurrent creation and assigns unique participant numbers", async () => {
    const harness = await createHarness();
    try {
      const responses = await Promise.all(
        Array.from({ length: 25 }, (_, index) =>
          request(harness.app)
            .post("/api/append-result/experiment-1")
            .send({ sessionId: `session-${index}` }),
        ),
      );

      expect(responses.every((response) => response.status === 200)).toBe(true);
      expect(
        new Set(responses.map((response) => response.body.participantNumber)),
      ).toEqual(new Set(Array.from({ length: 25 }, (_, index) => index + 1)));

      await harness.db.read();
      expect(harness.db.data.sessionResults).toHaveLength(25);
    } finally {
      harness.cleanup();
    }
  });

  test("makes creation and trial writes idempotent under concurrency", async () => {
    const harness = await createHarness();
    try {
      const first = await request(harness.app)
        .post("/api/append-result/experiment-1")
        .send({ sessionId: "session-1" })
        .expect(200);
      const retry = await request(harness.app)
        .post("/api/append-result/experiment-1")
        .send({ sessionId: "session-1" })
        .expect(200);
      expect(retry.body.participantNumber).toBe(first.body.participantNumber);

      const events = Array.from({ length: 100 }, (_, sequence) => ({
        eventId: `event-${sequence}`,
        sequence,
        response: { trial_index: sequence },
      }));
      const responses = await Promise.all(
        events.map((event) =>
          request(harness.app)
            .put("/api/append-result/experiment-1")
            .send({ sessionId: "session-1", ...event }),
        ),
      );
      expect(responses.every((response) => response.status === 200)).toBe(true);

      await Promise.all(
        events.slice(0, 10).map((event) =>
          request(harness.app)
            .put("/api/append-result/experiment-1")
            .send({ sessionId: "session-1", ...event })
            .expect(200),
        ),
      );

      await request(harness.app)
        .put("/api/append-result/experiment-1")
        .send({
          sessionId: "session-1",
          eventId: "event-0",
          sequence: 0,
          response: { trial_index: 999 },
        })
        .expect(409);

      await harness.db.read();
      const session = harness.db.data.sessionResults[0];
      expect(session.data).toHaveLength(100);
      expect(session.events).toHaveLength(100);
      expect(session.events.map((event) => event.sequence)).toEqual(
        Array.from({ length: 100 }, (_, index) => index),
      );
    } finally {
      harness.cleanup();
    }
  });

  test("refuses completion until every declared sequence is stored", async () => {
    const harness = await createHarness();
    try {
      await request(harness.app)
        .post("/api/append-result/experiment-1")
        .send({ sessionId: "session-1" })
        .expect(200);

      for (const sequence of [0, 2]) {
        await request(harness.app)
          .put("/api/append-result/experiment-1")
          .send({
            sessionId: "session-1",
            eventId: `event-${sequence}`,
            sequence,
            response: { trial_index: sequence },
          })
          .expect(200);
      }

      const persisted = await request(harness.app)
        .get("/api/session-results/experiment-1?sessionId=session-1")
        .expect(200);
      expect(persisted.body.sessions[0]).toMatchObject({
        storedEventCount: 2,
        lastSequence: 2,
      });

      const incomplete = await request(harness.app)
        .post("/api/complete-session/experiment-1")
        .send({
          sessionId: "session-1",
          expectedEventCount: 3,
          lastSequence: 2,
        })
        .expect(409);
      expect(incomplete.body.missingSequences).toEqual([1]);

      await request(harness.app)
        .put("/api/append-result/experiment-1")
        .send({
          sessionId: "session-1",
          eventId: "event-1",
          sequence: 1,
          response: { trial_index: 1 },
        })
        .expect(200);
      await request(harness.app)
        .post("/api/complete-session/experiment-1")
        .send({
          sessionId: "session-1",
          expectedEventCount: 3,
          lastSequence: 2,
        })
        .expect(200);

      await harness.db.read();
      expect(harness.db.data.sessionResults[0].state).toBe("completed");
    } finally {
      harness.cleanup();
    }
  });

  test("keeps acknowledged data after loading a fresh database instance", async () => {
    const harness = await createHarness();
    try {
      await request(harness.app)
        .post("/api/append-result/restart-exp")
        .send({ sessionId: "restart-session" })
        .expect(200);
      await request(harness.app)
        .put("/api/append-result/restart-exp")
        .send({
          sessionId: "restart-session",
          eventId: "restart-session:0",
          sequence: 0,
          response: { answer: "durable" },
        })
        .expect(200);

      const databasePath = path.join(
        process.env.DB_ROOT,
        "database",
        "db.json",
      );
      process.env.DB_PATH = databasePath;
      jest.resetModules();
      const { db: restartedDb } = await import("../../utils/db.js");
      await restartedDb.read();
      const session = restartedDb.data.sessionResults.find(
        (candidate) => candidate.sessionId === "restart-session",
      );
      expect(session.data).toEqual([{ answer: "durable" }]);
      expect(session.events).toEqual([
        { eventId: "restart-session:0", sequence: 0 },
      ]);
    } finally {
      delete process.env.DB_PATH;
      harness.cleanup();
    }
  });

  test("does not reuse a participant number after its session is deleted", async () => {
    const harness = await createHarness();
    try {
      const first = await request(harness.app)
        .post("/api/append-result/experiment-1")
        .send({ sessionId: "deleted-session" })
        .expect(200);
      expect(first.body.participantNumber).toBe(1);
      await request(harness.app)
        .delete("/api/session-results/deleted-session/experiment-1")
        .expect(200);

      const replacement = await request(harness.app)
        .post("/api/append-result/experiment-1")
        .send({ sessionId: "replacement-session" })
        .expect(200);

      expect(replacement.body.participantNumber).toBe(2);
    } finally {
      harness.cleanup();
    }
  });

});
