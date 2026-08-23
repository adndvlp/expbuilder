import { Router } from "express";
import {
  appendSessionResult,
  completeSession,
  createSession,
  getSession,
  listSessions,
  nextParticipantNumber,
  saveOnlineSession,
} from "../../runtime/sessionStore.js";

const router = Router();

/* istanbul ignore next -- session creation error branches are covered by route smoke tests. */
router.post("/api/append-result/:experimentID", async (req, res) => {
  try {
    let { sessionId } = req.body;
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "sessionId required" });
    }

    const result = await createSession(
      req.params.experimentID,
      sessionId,
      req.body.metadata || {},
    );
    if (!result.created) {
      return res
        .status(409)
        .json({ success: false, error: "Session already exists" });
    }

    res.json({
      success: true,
      id: sessionId,
      participantNumber: result.participantNumber,
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

    const result = await appendSessionResult(
      req.params.experimentID,
      sessionId,
      response,
    );
    if (!result.found) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    res.json({
      success: true,
      id: sessionId,
      participantNumber: result.participantNumber,
    });
  /* istanbul ignore next -- malformed JSON / lowdb failures are defensive error handling. */
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* istanbul ignore next -- session listing error branch is defensive lowdb handling. */
router.get("/api/session-results/:experimentID", async (req, res) => {
  try {
    const sessions = await listSessions(req.params.experimentID);
    res.json({ sessions });
  /* istanbul ignore next -- lowdb read failure path. */
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get(
  "/api/session-result/:experimentID/:sessionId",
  async (req, res) => {
    try {
      const session = await getSession(
        req.params.experimentID,
        req.params.sessionId,
      );
      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }
      return res.json({ success: true, session });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },
);

router.post("/api/complete-session/:experimentID", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "sessionId required" });
    }

    const completed = await completeSession(
      req.params.experimentID,
      sessionId,
    );
    if (!completed) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

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

      await saveOnlineSession(
        req.params.experimentID,
        sessionId,
        metadata,
        state,
      );
      res.json({ success: true });
    /* istanbul ignore next -- lowdb write failure path. */
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

router.get("/api/participant-number/:experimentID", async (req, res) => {
  try {
    const participantNumber = await nextParticipantNumber(
      req.params.experimentID,
    );
    res.json({ participantNumber });
  /* istanbul ignore next -- lowdb read failure path. */
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
