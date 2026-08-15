import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { jest } from "@jest/globals";

async function createHarness() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "session-validation-"));
  process.env.DB_ROOT = root;
  delete process.env.DB_PATH;
  jest.resetModules();

  const { db, ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  db.data.experiments.push({ experimentID: "experiment-1", name: "Experiment" });
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

test("rejects writes that could corrupt completed or unsequenced sessions", async () => {
  const harness = await createHarness();
  try {
    const now = new Date().toISOString();
    harness.db.data.sessionResults.push(
      {
        experimentID: "experiment-1",
        sessionId: "completed-session",
        createdAt: now,
        data: [{ answer: "stored" }],
        events: [{ eventId: "completed-session:0", sequence: 0 }],
        state: "completed",
        lastUpdate: now,
        metadata: {},
      },
      {
        experimentID: "experiment-1",
        sessionId: "unsequenced-session",
        createdAt: now,
        data: [{ answer: "existing" }],
        state: "in-progress",
        lastUpdate: now,
        metadata: {},
      },
      {
        experimentID: "experiment-1",
        sessionId: "invalid-sequences",
        createdAt: now,
        data: [{ answer: 1 }, { answer: 2 }, { answer: 3 }],
        events: [
          { eventId: "one", sequence: 0 },
          { eventId: "two", sequence: 2 },
          { eventId: "three", sequence: 2 },
        ],
        state: "in-progress",
        lastUpdate: now,
        metadata: {},
      },
    );
    await harness.db.write();

    for (const sessionId of ["completed-session", "unsequenced-session"]) {
      await request(harness.app)
        .put("/api/append-result/experiment-1")
        .send({
          sessionId,
          eventId: `${sessionId}:1`,
          sequence: 1,
          response: { answer: "new" },
        })
        .expect(409);
    }

    const completedRetry = await request(harness.app)
      .put("/api/append-result/experiment-1")
      .send({
        sessionId: "completed-session",
        eventId: "completed-session:0",
        sequence: 0,
        response: { answer: "stored" },
      })
      .expect(200);
    expect(completedRetry.body.duplicate).toBe(true);

    await request(harness.app)
      .post("/api/complete-session/experiment-1")
      .send({
        sessionId: "unsequenced-session",
        expectedEventCount: 0,
        lastSequence: -1,
      })
      .expect(409);

    const metadata = await request(harness.app)
      .get("/api/session-results/experiment-1?sessionId=invalid-sequences")
      .expect(200);
    expect(metadata.body.sessions[0].sequenceTracked).toBe(false);
  } finally {
    harness.cleanup();
  }
});

test("rejects unsafe sequence numbers before storing a result", async () => {
  const harness = await createHarness();
  try {
    await request(harness.app)
      .post("/api/append-result/experiment-1")
      .send({ sessionId: "session-1" })
      .expect(200);
    await request(harness.app)
      .put("/api/append-result/experiment-1")
      .send({
        sessionId: "session-1",
        eventId: "unsafe",
        sequence: Number.MAX_SAFE_INTEGER + 1,
        response: { answer: "rejected" },
      })
      .expect(400);

    await harness.db.read();
    expect(harness.db.data.sessionResults[0].data).toEqual([]);
  } finally {
    harness.cleanup();
  }
});

test("reports the first missing sequence without building an unbounded response", async () => {
  const harness = await createHarness();
  try {
    await request(harness.app)
      .post("/api/append-result/experiment-1")
      .send({ sessionId: "session-1" })
      .expect(200);

    const response = await request(harness.app)
      .post("/api/complete-session/experiment-1")
      .send({
        sessionId: "session-1",
        expectedEventCount: 10001,
        lastSequence: 10000,
      })
      .expect(409);
    expect(response.body.missingSequences).toEqual([0]);
  } finally {
    harness.cleanup();
  }
});
