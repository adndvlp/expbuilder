import { createHash } from "node:crypto";

export function canonicalEventJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalEventJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalEventJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function validatePublicEvents(data, experiment) {
  if (data?.protocolVersion !== 1 || !Array.isArray(data.events) || !data.events.length || data.events.length > 100) {
    throw invalid("Expected between 1 and 100 events using protocolVersion 1");
  }
  const seen = new Set();
  return data.events.map(event => {
    const { eventId, sequence, payload, payloadHash, checkpoint } = event ?? {};
    if (typeof eventId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(eventId)
        || !Number.isSafeInteger(sequence) || sequence < 0
        || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw invalid("Invalid event identity, sequence or payload");
    }
    if (seen.has(eventId)) throw invalid("Duplicate event identity in request");
    seen.add(eventId);
    const json = canonicalEventJson(payload);
    if (Buffer.byteLength(json, "utf8") > 750_000) throw invalid("Event exceeds the payload limit", 413);
    const computedHash = createHash("sha256").update(json).digest("hex");
    if (payloadHash !== computedHash) throw invalid("Event payload hash does not match");
    if (experiment.useValidation && (!(experiment.allowJSON || experiment.allowCSV)
        || (experiment.requiredFields ?? []).some(key => !Object.hasOwn(payload, key)))) {
      throw invalid("Event is missing required fields or JSON/CSV reception is disabled");
    }
    if (checkpoint != null && (typeof checkpoint !== "object" || Array.isArray(checkpoint))) throw invalid("Invalid event checkpoint");
    return { eventId, sequence, payloadHash: computedHash, payload, ...(checkpoint != null && { checkpoint }) };
  });
}
