import cors from "cors";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { jest } from "@jest/globals";

async function createHarness() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tunnel-session-flow-"));
  process.env.DB_ROOT = root;
  delete process.env.DB_PATH;
  jest.resetModules();

  const { db, ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  db.data.experiments.push({
    experimentID: "tunnel-experiment",
    name: "Tunnel experiment",
  });
  await db.write();

  const { serializeDbRequest } = await import(
    "../../modules/session-persistence/dbQueue.js"
  );
  const {
    originMatchesRequest,
    restrictRemoteAccess,
  } = await import("../../modules/tunnel-access/participantAccess.js");
  const resultsRouter = (await import("../../routes/results.js")).default;
  const app = express();
  app.use((req, res, next) =>
    cors({
      origin: (origin, callback) =>
        callback(null, !origin || originMatchesRequest(req, origin)),
      credentials: true,
    })(req, res, next),
  );
  app.use(express.json());
  app.use(restrictRemoteAccess);
  app.use(serializeDbRequest);
  app.use(resultsRouter);
  app.use((req, res) => res.status(404).json({ error: "not found" }));

  return {
    app,
    db,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
      delete process.env.DB_ROOT;
    },
  };
}

const tunnelHeaders = {
  Host: "study.trycloudflare.com",
  Origin: "https://study.trycloudflare.com",
  "Cf-Ray": "test-ray",
};

function throughTunnel(testRequest) {
  return Object.entries(tunnelHeaders).reduce(
    (current, [name, value]) => current.set(name, value),
    testRequest,
  );
}

describe("session persistence through a Cloudflare tunnel", () => {
  test("saves and completes a participant session while hiding administration", async () => {
    const harness = await createHarness();
    try {
      const preflight = await throughTunnel(
        request(harness.app)
          .options("/api/append-result/tunnel-experiment")
          .set("Access-Control-Request-Method", "POST")
          .set("Access-Control-Request-Headers", "content-type"),
      ).expect(204);
      expect(preflight.headers["access-control-allow-origin"]).toBe(
        tunnelHeaders.Origin,
      );

      const created = await throughTunnel(
        request(harness.app)
          .post("/api/append-result/tunnel-experiment")
          .send({ sessionId: "tunnel-session" }),
      ).expect(200);
      expect(created.body).toMatchObject({
        success: true,
        id: "tunnel-session",
        participantNumber: 1,
      });

      for (const sequence of [1, 0]) {
        await throughTunnel(
          request(harness.app)
            .put("/api/append-result/tunnel-experiment")
            .send({
              sessionId: "tunnel-session",
              eventId: `tunnel-session:${sequence}`,
              sequence,
              response: { trial_index: sequence, answer: `answer-${sequence}` },
            }),
        ).expect(200);
      }

      await throughTunnel(
        request(harness.app)
          .post("/api/complete-session/tunnel-experiment")
          .send({
            sessionId: "tunnel-session",
            expectedEventCount: 2,
            lastSequence: 1,
          }),
      ).expect(200, {
        success: true,
        storedEventCount: 2,
        lastSequence: 1,
      });

      const session = await throughTunnel(
        request(harness.app).get(
          "/api/session-results/tunnel-experiment?sessionId=tunnel-session",
        ),
      ).expect(200);
      expect(session.body.sessions[0]).toMatchObject({
        sessionId: "tunnel-session",
        state: "completed",
        sequenceTracked: true,
        storedEventCount: 2,
        lastSequence: 1,
      });
      expect(session.body.sessions[0]).not.toHaveProperty("data");
      expect(session.body.sessions[0]).not.toHaveProperty("events");

      await throughTunnel(
        request(harness.app).get("/api/session-results/tunnel-experiment"),
      ).expect(404);

      await harness.db.read();
      const stored = harness.db.data.sessionResults[0];
      expect(stored.state).toBe("completed");
      expect(stored.events.map((event) => event.sequence)).toEqual([0, 1]);
      expect(stored.data.map((trial) => trial.trial_index)).toEqual([0, 1]);
    } finally {
      harness.cleanup();
    }
  });
});
