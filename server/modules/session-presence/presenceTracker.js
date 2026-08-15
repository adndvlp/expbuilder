import { db, ensureDbData } from "../../utils/db.js";
import { withDbLock } from "../session-persistence/dbQueue.js";
import { findSession } from "../session-persistence/sessionStore.js";

const PRESENCE_STATES = new Set([
  "initiated",
  "resumed",
  "in-progress",
  "completed",
]);

function validIdentity(experimentID, sessionId) {
  return (
    typeof experimentID === "string" &&
    experimentID.length > 0 &&
    typeof sessionId === "string" &&
    sessionId.length > 0
  );
}

export function createPresenceTracker(io) {
  const connections = new Map();

  function sessionsForExperiment(experimentID) {
    const latestBySession = new Map();
    for (const presence of connections.values()) {
      if (presence.experimentID !== experimentID) continue;
      const existing = latestBySession.get(presence.sessionId);
      if (!existing || presence.lastUpdate > existing.lastUpdate) {
        const publicPresence = { ...presence };
        delete publicPresence.experimentID;
        latestBySession.set(presence.sessionId, publicPresence);
      }
    }
    return Array.from(latestBySession.values());
  }

  function emitExperiment(experimentID) {
    io.to(experimentID).emit("session-update", {
      experimentID,
      sessions: sessionsForExperiment(experimentID),
    });
  }

  async function sessionExists(experimentID, sessionId) {
    return withDbLock(async () => {
      await db.read();
      ensureDbData();
      return Boolean(findSession(experimentID, sessionId));
    });
  }

  async function join(socket, payload, acknowledge = () => undefined) {
    const { experimentID, metadata, sessionId, state } = payload || {};
    if (!validIdentity(experimentID, sessionId)) {
      acknowledge({ success: false, error: "Invalid experiment or session" });
      return;
    }
    if (state !== undefined && !PRESENCE_STATES.has(state)) {
      acknowledge({ success: false, error: "Invalid presence state" });
      return;
    }
    let persisted;
    try {
      persisted = await sessionExists(experimentID, sessionId);
    } catch {
      acknowledge({ success: false, error: "Session could not be validated" });
      return;
    }
    if (!persisted) {
      acknowledge({ success: false, error: "Session not found" });
      return;
    }

    socket.join(experimentID);
    const connectedAt = new Date().toISOString();
    connections.set(socket.id, {
      experimentID,
      sessionId,
      state: state || "initiated",
      socketId: socket.id,
      connectedAt,
      lastUpdate: connectedAt,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });
    emitExperiment(experimentID);
    acknowledge({ success: true, connectedAt });
  }

  function update(socketId, payload, acknowledge = () => undefined) {
    const { experimentID, sessionId, state } = payload || {};
    if (!validIdentity(experimentID, sessionId) || !PRESENCE_STATES.has(state)) {
      acknowledge({ success: false, error: "Invalid presence update" });
      return;
    }
    const session = connections.get(socketId);
    if (
      !session ||
      session.experimentID !== experimentID ||
      session.sessionId !== sessionId
    ) {
      acknowledge({ success: false, error: "Active session not found" });
      return;
    }
    session.state = state;
    session.lastUpdate = new Date().toISOString();
    emitExperiment(experimentID);
    acknowledge({ success: true });
  }

  function disconnect(socketId) {
    const presence = connections.get(socketId);
    if (!presence) return;
    connections.delete(socketId);
    emitExperiment(presence.experimentID);
  }

  function listen(socket, experimentID, acknowledge = () => undefined) {
    if (typeof experimentID !== "string" || experimentID.length === 0) {
      acknowledge({ success: false, error: "Invalid experiment" });
      return;
    }
    socket.join(experimentID);
    const sessions = sessionsForExperiment(experimentID);
    if (sessions.length > 0) {
      socket.emit("session-update", {
        experimentID,
        sessions,
      });
    }
    acknowledge({ success: true });
  }

  return { disconnect, join, listen, update };
}
