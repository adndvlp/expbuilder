import { Parser } from "json2csv";

export function rowsWithSessionMetadata(doc, sessionId) {
  const metadata = doc.metadata || {};
  const paired = doc.data.map((row, index) => ({
    row,
    event: doc.events?.[index],
    sourceIndex: index,
  }));
  if (doc.events?.length === doc.data.length) {
    paired.sort((left, right) => left.event.sequence - right.event.sequence);
  }
  return paired.map(({ event, row, sourceIndex }) => ({
    ...row,
    session_event_id: event?.eventId || "",
    session_sequence: event?.sequence ?? sourceIndex,
    session_participant_number: doc.participantNumber || "",
    session_display_name: doc.displayName || "",
    session_browser: metadata.browser || "",
    session_browser_version: metadata.browserVersion || "",
    session_os: metadata.os || "",
    session_screen_resolution: metadata.screenResolution || "",
    session_language: metadata.language || "",
    session_started_at: metadata.startedAt || "",
    session_id: sessionId,
    session_created_at: doc.createdAt || "",
    session_state: doc.state || "",
  }));
}

export function toSessionCsv(doc, sessionId) {
  const dataWithMetadata = rowsWithSessionMetadata(doc, sessionId);
  const allFields = Array.from(
    new Set(dataWithMetadata.flatMap((row) => Object.keys(row))),
  );
  const parser = new Parser({ fields: allFields });
  return parser.parse(dataWithMetadata);
}
