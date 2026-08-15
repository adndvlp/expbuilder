const SAFE_FIELDS = new Set([
  "attempt",
  "error",
  "eventId",
  "expectedEventCount",
  "experimentID",
  "lastSequence",
  "participantNumber",
  "result",
  "sequence",
  "sessionId",
  "status",
  "storedCount",
]);

function errorMessage(value) {
  if (value instanceof Error) return value.message;
  return typeof value === "string" ? value : String(value ?? "unknown error");
}

export function formatSessionLog(event, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
  };
  for (const [key, value] of Object.entries(details)) {
    if (!SAFE_FIELDS.has(key) || value === undefined) continue;
    entry[key] = key === "error" ? errorMessage(value) : value;
  }
  return entry;
}

export function logSessionEvent(level, event, details) {
  const entry = formatSessionLog(event, details);
  if (process.env.NODE_ENV === "test") return entry;
  const writer = level === "error"
    ? console.error
    : level === "warn"
      ? console.warn
      : console.info;
  writer("[session-persistence]", JSON.stringify(entry));
  return entry;
}
