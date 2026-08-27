import { Router } from "express";
import { withDbLock } from "../../modules/session-persistence/dbQueue.js";
import { logSessionEvent } from "../../modules/session-persistence/sessionLog.js";
import {
  appendEvent,
  createSession,
  findSession,
  missingSequences,
  participantNumberFor,
  previewParticipantNumber,
  sessionProgress,
} from "../../modules/session-persistence/sessionStore.js";
import { appendSessionResult } from "../../runtime/sessionStore.js";
import { db, ensureDbData } from "../../utils/db.js";

const router = Router();

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resultSizeLimit() {
  const configured = Number(process.env.SESSION_RESULT_MAX_BYTES);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : 5 * 1024 * 1024;
}

async function locked(handler, res, diagnostics = {}) {
  try {
    return await withDbLock(async () => {
      await db.read();
      ensureDbData();
      return handler();
    });
  } catch (error) {
    logSessionEvent("error", "database-operation-failed", {
      ...diagnostics,
      error,
    });
    return res.status(500).json({ success: false, error: error.message });
  }
}

router.post("/api/append-result/:experimentID", async (req, res) => {
  const { displayName, metadata, sessionId } = req.body || {};
  if (!isNonEmptyString(sessionId)) {
    return res.status(400).json({ success: false, error: "sessionId required" });
  }
  if (metadata !== undefined && !isObject(metadata)) {
    return res.status(400).json({ success: false, error: "metadata must be an object" });
  }
  if (displayName !== undefined && !isNonEmptyString(displayName)) {
    return res.status(400).json({ success: false, error: "displayName must be a string" });
  }

  return locked(async () => {
    const experimentExists = db.data.experiments.some(
      (experiment) => experiment.experimentID === req.params.experimentID,
    );
    if (!experimentExists) {
      logSessionEvent("warn", "session-create-rejected", {
        experimentID: req.params.experimentID,
        sessionId,
        result: "experiment-not-found",
      });
      return res.status(404).json({ success: false, error: "Experiment not found" });
    }
    const result = createSession(
      req.params.experimentID,
      sessionId,
      metadata,
      displayName,
    );
    if (result.created) await db.write();
    const participantNumber = participantNumberFor(
      req.params.experimentID,
      result.session,
    );
    logSessionEvent("info", "session-created", {
      experimentID: req.params.experimentID,
      sessionId,
      participantNumber,
      result: result.created ? "created" : "existing",
    });
    return res.json({
      success: true,
      id: result.session.sessionId,
      participantNumber,
      created: result.created,
    });
  }, res, { experimentID: req.params.experimentID, sessionId });
});

router.put("/api/append-result/:experimentID", async (req, res) => {
  let { response } = req.body || {};
  const { eventId, sequence, sessionId } = req.body || {};
  if (
    !isNonEmptyString(sessionId) ||
    response === undefined ||
    response === null
  ) {
    return res.status(400).json({
      success: false,
      error: "sessionId and response required",
    });
  }

  try {
    if (typeof response === "string") response = JSON.parse(response);
  } catch {
    return res.status(400).json({ success: false, error: "response must be valid JSON" });
  }
  if (!isObject(response)) {
    return res.status(400).json({ success: false, error: "response must be an object" });
  }
  if (Buffer.byteLength(JSON.stringify(response), "utf8") > resultSizeLimit()) {
    return res.status(413).json({ success: false, error: "response is too large" });
  }

  // When eventId and sequence are both absent, use simple append (loop-branches mode).
  // When either is present, require both valid and use the dedup path.
  const hasEventId = eventId !== undefined && eventId !== null;
  const hasSequence = sequence !== undefined && sequence !== null;
  const hasEventMetadata = hasEventId && hasSequence;

  if (hasEventId || hasSequence) {
    if (!isNonEmptyString(eventId) || !Number.isSafeInteger(sequence) || sequence < 0) {
      return res.status(400).json({
        success: false,
        error: "eventId and non-negative sequence required when either is provided",
      });
    }
  }

  return locked(async () => {
    const session = findSession(req.params.experimentID, sessionId);
    if (!session) {
      logSessionEvent("warn", "trial-rejected", {
        experimentID: req.params.experimentID,
        sessionId,
        eventId,
        sequence,
        result: "session-not-found",
      });
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    if (hasEventMetadata) {
      const result = appendEvent(session, { eventId, sequence, response });
      if (result.conflict) {
        logSessionEvent("warn", "trial-conflict", {
          experimentID: req.params.experimentID,
          sessionId,
          eventId,
          sequence,
          result: result.conflict,
        });
        return res.status(409).json({ success: false, error: result.conflict });
      }
      if (!result.duplicate) await db.write();
      logSessionEvent("info", "trial-stored", {
        experimentID: req.params.experimentID,
        sessionId,
        eventId,
        sequence,
        storedCount: session.events.length,
        result: result.duplicate ? "duplicate" : "stored",
    });
    return res.json({
      success: true,
      id: sessionId,
      eventId,
      sequence,
      duplicate: result.duplicate,
      storedCount: session.events.length,
      participantNumber: participantNumberFor(req.params.experimentID, session),
    });
    } else {
      // Simple append mode (loop-branches runtime without outbox)
      const result = appendSessionResult(
        req.params.experimentID,
        sessionId,
        response,
      );
      if (!result.found) {
        return res.status(404).json({ success: false, error: "Session not found" });
      }
      await db.write();
      logSessionEvent("info", "trial-stored", {
        experimentID: req.params.experimentID,
        sessionId,
        storedCount: (session.data || []).length,
        result: "stored",
      });
      return res.json({
        success: true,
        id: sessionId,
        participantNumber: result.participantNumber,
      });
    }
  }, res, {
    experimentID: req.params.experimentID,
    sessionId,
    eventId,
    sequence,
  });
});
router.get("/api/session-results/:experimentID", async (req, res) =>
  locked(() => {
    const requestedSession = req.query.sessionId;
    const sessions = db.data.sessionResults
      .filter(
        (session) =>
          session.experimentID === req.params.experimentID &&
          (!requestedSession || session.sessionId === requestedSession),
      )
      .map(({ data, events, ...session }) => ({
        ...session,
        ...sessionProgress(data, events),
      }))
      .sort((left, right) => {
        const leftTime = Date.parse(left.createdAt);
        const rightTime = Date.parse(right.createdAt);
        return (Number.isFinite(rightTime) ? rightTime : 0) -
          (Number.isFinite(leftTime) ? leftTime : 0);
      });
    return res.json({ sessions });
  }, res),
);

router.post("/api/complete-session/:experimentID", async (req, res) => {
  const { expectedEventCount, lastSequence, sessionId } = req.body || {};
  if (
    !isNonEmptyString(sessionId) ||
    !Number.isSafeInteger(expectedEventCount) ||
    expectedEventCount < 0 ||
    !Number.isSafeInteger(lastSequence) ||
    lastSequence !== expectedEventCount - 1
  ) {
    return res.status(400).json({
      success: false,
      error: "sessionId, expectedEventCount and matching lastSequence required",
    });
  }

  return locked(async () => {
    const session = findSession(req.params.experimentID, sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    const hasEvents = Array.isArray(session.events) && session.events.length > 0;
    const hasData = Array.isArray(session.data) && session.data.length > 0;
    if (hasEvents) {
      const missing = missingSequences(session, expectedEventCount, lastSequence);
      if (missing.length > 0 || session.events.length !== expectedEventCount) {
        logSessionEvent("warn", "completion-rejected", {
          experimentID: req.params.experimentID,
          sessionId,
          expectedEventCount,
          lastSequence,
          storedCount: session.events.length,
          result: "missing-results",
        });
        return res.status(409).json({
          success: false,
          error: "Session has missing results",
          missingSequences: missing,
          storedEventCount: session.events.length,
        });
      }
    } else if (hasData && expectedEventCount !== session.data.length) {
      // Simple append mode: validate data count matches expected
      logSessionEvent("warn", "completion-rejected", {
        experimentID: req.params.experimentID,
        sessionId,
        expectedEventCount,
        lastSequence,
        storedCount: session.data.length,
        result: "missing-results",
      });
      return res.status(409).json({
        success: false,
        error: "Session has missing results",
        storedEventCount: session.data.length,
      });
    } else if (!hasData && !hasEvents && expectedEventCount > 0) {
      // No data stored but expectedEventCount > 0
      const missing = missingSequences(session, expectedEventCount, lastSequence);
      logSessionEvent("warn", "completion-rejected", {
        experimentID: req.params.experimentID,
        sessionId,
        expectedEventCount,
        lastSequence,
        storedCount: 0,
        result: "missing-results",
      });
      return res.status(409).json({
        success: false,
        error: "Session has missing results",
        missingSequences: missing,
        storedEventCount: 0,
      });
    }
    session.state = "completed";
    session.completedAt = new Date().toISOString();
    session.lastUpdate = session.completedAt;
    await db.write();
    logSessionEvent("info", "session-completed", {
      experimentID: req.params.experimentID,
      sessionId,
      expectedEventCount,
      lastSequence,
      storedCount: hasEvents ? session.events.length : (session.data || []).length,
      result: "completed",
    });
    return res.json({
      success: true,
      storedEventCount: hasEvents ? session.events.length : (session.data || []).length,
      lastSequence,
    });
  }, res, {
    experimentID: req.params.experimentID,
    sessionId,
    expectedEventCount,
    lastSequence,
  });
});

router.post("/api/save-online-session-metadata/:experimentID", async (req, res) => {
  const { metadata, sessionId, state } = req.body || {};
  if (!isNonEmptyString(sessionId)) {
    return res.status(400).json({ success: false, error: "sessionId required" });
  }
  return locked(async () => {
    const existing = findSession(req.params.experimentID, sessionId);
    if (existing) {
      if (metadata) existing.metadata = { ...existing.metadata, ...metadata };
      if (state) existing.state = state;
      existing.lastUpdate = new Date().toISOString();
    } else {
      const now = new Date().toISOString();
      db.data.sessionResults.push({
        experimentID: req.params.experimentID,
        sessionId,
        createdAt: now,
        data: [],
        state: state || "initiated",
        lastUpdate: now,
        metadata: metadata || {},
        isOnline: true,
      });
    }
    await db.write();
    return res.json({ success: true });
  }, res);
});

router.get("/api/participant-number/:experimentID", async (req, res) =>
  locked(
    () =>
      res.json({
        participantNumber: previewParticipantNumber(req.params.experimentID),
      }),
    res,
  ),
);

export default router;
