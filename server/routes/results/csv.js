import { Parser } from "json2csv";

export function rowsWithSessionMetadata(doc, sessionId) {
  const metadata = doc.metadata || {};
  return doc.data.map((row) => ({
    ...row,
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
