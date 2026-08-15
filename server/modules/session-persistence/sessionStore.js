import { db, ensureDbData } from "../../utils/db.js";

function sessionsFor(experimentID) {
  return db.data.sessionResults.filter(
    (session) => session.experimentID === experimentID,
  );
}

function participantBaseline(experimentID) {
  const sessions = sessionsFor(experimentID);
  const assigned = sessions
    .map((session) => Number(session.participantNumber))
    .filter((value) => Number.isInteger(value) && value > 0);
  return Math.max(sessions.length, 0, ...assigned);
}

export function findSession(experimentID, sessionId) {
  return db.data.sessionResults.find(
    (session) =>
      session.experimentID === experimentID && session.sessionId === sessionId,
  );
}

export function participantNumberFor(experimentID, session) {
  if (Number.isInteger(session.participantNumber) && session.participantNumber > 0) {
    return session.participantNumber;
  }
  const ordered = sessionsFor(experimentID).sort(
    (left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      return (Number.isFinite(leftTime) ? leftTime : 0) -
        (Number.isFinite(rightTime) ? rightTime : 0);
    },
  );
  return ordered.findIndex((candidate) => candidate.sessionId === session.sessionId) + 1;
}

export function nextParticipantNumber(experimentID) {
  ensureDbData();
  db.data.sessionCounters ||= {};
  const stored = Number(db.data.sessionCounters[experimentID]);
  const current =
    Number.isInteger(stored) && stored >= 0
      ? Math.max(stored, participantBaseline(experimentID))
      : participantBaseline(experimentID);
  const next = current + 1;
  db.data.sessionCounters[experimentID] = next;
  return next;
}

export function previewParticipantNumber(experimentID) {
  ensureDbData();
  db.data.sessionCounters ||= {};
  const stored = Number(db.data.sessionCounters[experimentID]);
  const current = Number.isInteger(stored) && stored >= 0 ? stored : 0;
  return Math.max(current, participantBaseline(experimentID)) + 1;
}

export function createSession(experimentID, sessionId, metadata, displayName) {
  const existing = findSession(experimentID, sessionId);
  if (existing) {
    return { session: existing, created: false };
  }

  const now = new Date().toISOString();
  const session = {
    experimentID,
    sessionId,
    ...(displayName ? { displayName } : {}),
    participantNumber: nextParticipantNumber(experimentID),
    createdAt: now,
    data: [],
    events: [],
    state: "initiated",
    lastUpdate: now,
    metadata: metadata || {},
  };
  db.data.sessionResults.push(session);
  return { session, created: true };
}

export function appendEvent(session, { eventId, sequence, response }) {
  if (!Array.isArray(session.data)) {
    return { conflict: "session data is invalid" };
  }
  if (
    (!Array.isArray(session.events) && session.data.length > 0) ||
    (Array.isArray(session.events) && session.events.length !== session.data.length)
  ) {
    return { conflict: "session does not have reliable sequence tracking" };
  }
  session.events ||= [];
  const duplicate = session.events.find((event) => event.eventId === eventId);
  if (duplicate) {
    const eventIndex = session.events.indexOf(duplicate);
    if (duplicate.sequence !== sequence) {
      return { conflict: "eventId already exists with another sequence" };
    }
    if (JSON.stringify(session.data[eventIndex]) !== JSON.stringify(response)) {
      return { conflict: "eventId already exists with another response" };
    }
    return { duplicate: true };
  }
  if (session.state === "completed") {
    return { conflict: "session is already completed" };
  }
  if (session.events.some((event) => event.sequence === sequence)) {
    return { conflict: "sequence already exists with another eventId" };
  }

  const insertionIndex = session.events.findIndex(
    (event) => event.sequence > sequence,
  );
  const index = insertionIndex === -1 ? session.events.length : insertionIndex;
  session.events.splice(index, 0, { eventId, sequence });
  session.data.splice(index, 0, response);
  session.state = "in-progress";
  session.lastUpdate = new Date().toISOString();
  return { duplicate: false };
}

export function sessionProgress(data, events) {
  const results = Array.isArray(data) ? data : [];
  const trackedEvents = Array.isArray(events) ? events : [];
  const validSequences = trackedEvents.every(
    (event) =>
      event &&
      Number.isSafeInteger(event.sequence) &&
      event.sequence >= 0 &&
      event.sequence < results.length,
  );
  const uniqueSequences = new Set(
    trackedEvents.map((event) => event?.sequence),
  );
  const sequenceTracked =
    (Array.isArray(events) &&
      trackedEvents.length === results.length &&
      uniqueSequences.size === trackedEvents.length &&
      validSequences) ||
    (!Array.isArray(events) && results.length === 0);
  const storedEventCount = sequenceTracked ? trackedEvents.length : results.length;
  const knownSequences = trackedEvents
    .map((event) => event?.sequence)
    .filter((sequence) => Number.isSafeInteger(sequence) && sequence >= 0);
  const lastSequence = Array.isArray(events) && knownSequences.length
    ? Math.max(...knownSequences)
    : storedEventCount - 1;
  return { storedEventCount, lastSequence, sequenceTracked };
}

export function missingSequences(session, expectedEventCount, lastSequence) {
  if (!Array.isArray(session.data)) return [0];
  if (!Array.isArray(session.events)) {
    return session.data.length === 0 && expectedEventCount === 0 ? [] : [0];
  }
  if (session.data.length !== session.events.length) return [0];
  const sequences = new Set(
    session.events
      .map((event) => event?.sequence)
      .filter((sequence) => Number.isSafeInteger(sequence) && sequence >= 0),
  );
  let nextExpected = 0;
  for (const sequence of Array.from(sequences).sort((left, right) => left - right)) {
    if (sequence > nextExpected) return [nextExpected];
    if (sequence === nextExpected) nextExpected += 1;
  }
  if (nextExpected <= lastSequence) return [nextExpected];
  if (sequences.size !== expectedEventCount) {
    return [lastSequence + 1];
  }
  return [];
}
