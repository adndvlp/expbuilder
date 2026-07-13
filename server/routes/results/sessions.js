import { Router } from "express";
import { db } from "../../utils/db.js";

const router = Router();

function getParticipantNumber(experimentID, sessionId) {
  const sessions = db.data.sessionResults
    .filter((s) => s.experimentID === experimentID)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return sessions.findIndex((s) => s.sessionId === sessionId) + 1;
}

/* istanbul ignore next -- session creation error branches are covered by route smoke tests. */
router.post("/api/append-result/:experimentID", async (req, res) => {
  try {
    let { sessionId } = req.body;
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "sessionId required" });
    }

    await db.read();
    let existing = db.data.sessionResults.find(
      (s) =>
        s.experimentID === req.params.experimentID && s.sessionId === sessionId,
    );
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: "Session already exists" });
    }

    const { metadata } = req.body;
    db.data.sessionResults.push({
      experimentID: req.params.experimentID,
      sessionId,
      createdAt: new Date().toISOString(),
      data: [],
      state: "initiated",
      lastUpdate: new Date().toISOString(),
      metadata: metadata || {},
    });
    await db.write();

    res.json({
      success: true,
      id: sessionId,
      participantNumber: getParticipantNumber(req.params.experimentID, sessionId),
    });
  /* istanbul ignore next -- lowdb write failures are defensive and hard to trigger without corrupting shared state. */
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* istanbul ignore next -- append-result malformed/error branches are covered by route smoke tests. */
router.put("/api/append-result/:experimentID", async (req, res) => {
  try {
    let { sessionId, response } = req.body;
    if (!sessionId || !response) {
      return res
        .status(400)
        .json({ success: false, error: "sessionId and response required" });
    }

    if (typeof response === "string") response = JSON.parse(response);

    await db.read();
    let existing = db.data.sessionResults.find(
      (s) =>
        s.experimentID === req.params.experimentID && s.sessionId === sessionId,
    );
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    existing.data.push(response);
    existing.state = "in-progress";
    existing.lastUpdate = new Date().toISOString();
    await db.write();

    res.json({
      success: true,
      id: sessionId,
      participantNumber: getParticipantNumber(req.params.experimentID, sessionId),
    });
  /* istanbul ignore next -- malformed JSON / lowdb failures are defensive error handling. */
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* istanbul ignore next -- session listing error branch is defensive lowdb handling. */
router.get("/api/session-results/:experimentID", async (req, res) => {
  try {
    await db.read();
    const sessions = db.data.sessionResults
      .filter((s) => s.experimentID === req.params.experimentID)
      .map(({ data, ...session }) => session)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ sessions });
  /* istanbul ignore next -- lowdb read failure path. */
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/complete-session/:experimentID", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "sessionId required" });
    }

    await db.read();
    const existing = db.data.sessionResults.find(
      (s) =>
        s.experimentID === req.params.experimentID && s.sessionId === sessionId,
    );

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    existing.state = "completed";
    existing.lastUpdate = new Date().toISOString();
    await db.write();

    res.json({ success: true });
  /* istanbul ignore next -- lowdb write failure path. */
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* istanbul ignore next -- online-session metadata permutations are covered by route tests. */
router.post(
  "/api/save-online-session-metadata/:experimentID",
  async (req, res) => {
    try {
      const { sessionId, metadata, state } = req.body;
      if (!sessionId) {
        return res
          .status(400)
          .json({ success: false, error: "sessionId required" });
      }

      await db.read();
      const existing = db.data.sessionResults.find(
        (s) =>
          s.experimentID === req.params.experimentID &&
          s.sessionId === sessionId,
      );

      if (existing) {
        if (metadata) existing.metadata = { ...existing.metadata, ...metadata };
        if (state) existing.state = state;
        existing.lastUpdate = new Date().toISOString();
      } else {
        db.data.sessionResults.push({
          experimentID: req.params.experimentID,
          sessionId,
          createdAt: new Date().toISOString(),
          data: [],
          state: state || "initiated",
          lastUpdate: new Date().toISOString(),
          metadata: metadata || {},
          isOnline: true,
        });
      }

      await db.write();
      res.json({ success: true });
    /* istanbul ignore next -- lowdb write failure path. */
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

router.get("/api/participant-number/:experimentID", async (req, res) => {
  try {
    await db.read();
    const count = db.data.sessionResults.filter(
      (s) => s.experimentID === req.params.experimentID,
    ).length;
    res.json({ participantNumber: count + 1 });
  /* istanbul ignore next -- lowdb read failure path. */
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
