import { withDbMutation, withDbRead } from "../utils/db.js";

const matchesSession = (session, experimentID, sessionId) =>
  session.experimentID === experimentID && session.sessionId === sessionId;

function participantNumber(data, experimentID, sessionId) {
  const sessions = data.sessionResults
    .filter((session) => session.experimentID === experimentID)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
  return sessions.findIndex((session) => session.sessionId === sessionId) + 1;
}

function sessionSummary(session) {
  const summary = { ...session };
  delete summary.data;
  return summary;
}

function cloneSession(session) {
  return {
    ...session,
    data: [...(session.data || [])],
    metadata: { ...(session.metadata || {}) },
  };
}

export function createSession(experimentID, sessionId, metadata = {}) {
  return withDbMutation((data) => {
    const exists = data.sessionResults.some((session) =>
      matchesSession(session, experimentID, sessionId),
    );
    if (exists) return { created: false };
    const timestamp = new Date().toISOString();
    data.sessionResults.push({
      experimentID,
      sessionId,
      createdAt: timestamp,
      data: [],
      state: "initiated",
      lastUpdate: timestamp,
      metadata,
    });
    return {
      created: true,
      participantNumber: participantNumber(data, experimentID, sessionId),
    };
  });
}

export function appendSessionResult(experimentID, sessionId, response) {
  return withDbMutation((data) => {
    const session = data.sessionResults.find((entry) =>
      matchesSession(entry, experimentID, sessionId),
    );
    if (!session) return { found: false };
    session.data.push(response);
    session.state = "in-progress";
    session.lastUpdate = new Date().toISOString();
    return {
      found: true,
      participantNumber: participantNumber(data, experimentID, sessionId),
    };
  });
}

export function listSessions(experimentID) {
  return withDbRead((data) =>
    data.sessionResults
      .filter((session) => session.experimentID === experimentID)
      .map(sessionSummary)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)),
  );
}

export function getSession(experimentID, sessionId) {
  return withDbRead((data) => {
    const session = data.sessionResults.find((entry) =>
      matchesSession(entry, experimentID, sessionId),
    );
    return session ? cloneSession(session) : null;
  });
}

export function completeSession(experimentID, sessionId) {
  return withDbMutation((data) => {
    const session = data.sessionResults.find((entry) =>
      matchesSession(entry, experimentID, sessionId),
    );
    if (!session) return false;
    session.state = "completed";
    session.lastUpdate = new Date().toISOString();
    return true;
  });
}

export function saveOnlineSession(experimentID, sessionId, metadata, state) {
  return withDbMutation((data) => {
    const session = data.sessionResults.find((entry) =>
      matchesSession(entry, experimentID, sessionId),
    );
    const timestamp = new Date().toISOString();
    if (session) {
      if (metadata) session.metadata = { ...session.metadata, ...metadata };
      if (state) session.state = state;
      session.lastUpdate = timestamp;
      return;
    }
    data.sessionResults.push({
      experimentID,
      sessionId,
      createdAt: timestamp,
      data: [],
      state: state || "initiated",
      lastUpdate: timestamp,
      metadata: metadata || {},
      isOnline: true,
    });
  });
}

export function updateSessionState(
  experimentID,
  sessionId,
  { state, metadata } = {},
) {
  return withDbMutation((data) => {
    const session = data.sessionResults.find((entry) =>
      matchesSession(entry, experimentID, sessionId),
    );
    if (!session) return false;
    if (state) session.state = state;
    if (metadata) session.metadata = { ...session.metadata, ...metadata };
    session.lastUpdate = new Date().toISOString();
    return true;
  });
}

export function removeSession(experimentID, sessionId) {
  return withDbMutation((data) => {
    const sessionIndex = data.sessionResults.findIndex((entry) =>
      matchesSession(entry, experimentID, sessionId),
    );
    if (sessionIndex === -1) return { found: false };
    data.sessionResults.splice(sessionIndex, 1);
    const files = data.participantFiles.filter(
      (file) =>
        file.experimentID === experimentID && file.sessionId === sessionId,
    );
    data.participantFiles = data.participantFiles.filter(
      (file) =>
        !(file.experimentID === experimentID && file.sessionId === sessionId),
    );
    const experiment = data.experiments.find(
      (entry) => entry.experimentID === experimentID,
    );
    return {
      found: true,
      experimentName: experiment?.name || experimentID,
      files: files.map((file) => ({ ...file })),
    };
  });
}

export function renameSession(experimentID, oldSessionId, newSessionId) {
  return withDbMutation((data) => {
    const session = data.sessionResults.find((entry) =>
      matchesSession(entry, experimentID, oldSessionId),
    );
    if (!session) return "missing";
    const conflict = data.sessionResults.some((entry) =>
      matchesSession(entry, experimentID, newSessionId),
    );
    if (conflict) return "conflict";
    session.sessionId = newSessionId;
    for (const file of data.participantFiles) {
      if (file.experimentID === experimentID && file.sessionId === oldSessionId) {
        file.sessionId = newSessionId;
      }
    }
    return "renamed";
  });
}

export function nextParticipantNumber(experimentID) {
  return withDbRead(
    (data) =>
      data.sessionResults.filter(
        (session) => session.experimentID === experimentID,
      ).length + 1,
  );
}
