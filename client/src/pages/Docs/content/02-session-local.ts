import type { DocSection } from "./types";

export const SessionLocalSection: DocSection = {
  id: "session-local",
  title: "Session — Local Mode",
  content: `# Session — Local Mode

Generated from \`ExperimentCode/LocalConfiguration.ts\`.

## Session Name (dynamic tokens)

The \`sessionId\` can be a random UUID or a structured name configurable in **Builder → Settings → Session Name**.

| Token | Description | Formats / Options |
|---|---|---|
| \`date\` | Current date | \`YYYYMMDD\`, \`DD-MM-YYYY\`, \`MM-DD-YYYY\`, \`YYYY-MM-DD\` |
| \`time\` | Current time | \`HHmmss\`, \`HH-mm\`, \`HH-mm-ss\` |
| \`randomAlpha\` | Random alphanumeric | Configurable length (default: 6) |
| \`customText\` | Fixed text defined by the researcher | Any string |
| \`counter\` | Auto-incremental participant number | Configurable padding (e.g. \`003\`) |

\`\`\`js
// Generated in the HTML:
const _SESSION_NAME_TOKENS = [
{ type: "date", dateFormat: "YYYYMMDD" },
{ type: "counter", counterDigits: 3 }
];
const _SESSION_NAME_SEPARATOR = "_";

function _generateSessionName(participantNumber) {
// "date" → current date formatted
// "counter" → participantNumber with 3-digit padding
// Result: "20260506_003"
}
\`\`\`

If no token guarantees uniqueness (\`randomAlpha\` or \`counter\`), a random 6-character suffix is automatically added to avoid collisions.

## Session Start Flow

\`\`\`mermaid
sequenceDiagram
  participant P as Browser
  participant LS as localStorage
  participant API as Express API
  participant S as Socket.IO

  P->>LS: read jsPsych_currentSessionId
  alt sessionId exists
      Note over P: isResuming = true
  else does not exist
      P->>P: generate sessionId (UUID or session name)
  end

  P->>P: window.JSPSYCH_SESSION_ID = sessionId
  P->>API: POST /api/append-result/:id (create session)
  API-->>P: { participantNumber }
  Note over P: If counter token: rename session

  P->>S: load /socket.io/socket.io.js
  P->>S: emit "join-experiment"
  Note over P: _hideLoading() → experiment starts
\`\`\`

## Socket.IO

The Socket.IO script is loaded dynamically with polling until available:

\`\`\`js
const socketScript = document.createElement('script');
socketScript.src = '/socket.io/socket.io.js';
socketScript.onload = () => { window._socketReady = true; };
document.head.appendChild(socketScript);

function waitForSocket() {
return new Promise(resolve => {
  const interval = setInterval(() => {
    if (window._socketReady && typeof io !== 'undefined') {
      clearInterval(interval);
      resolve();
    }
  }, 50);
});
}

// On connection, the session event is emitted:
const socket = io();
socket.emit('join-experiment', {
experimentID,
sessionId: trialSessionId,
state: isResuming ? 'resumed' : 'initiated',
metadata, // { browser, os, screenWidth, ... }
});
\`\`\`

Socket.IO is used for real-time tracking from the Builder Dashboard (view connected participants, progress, etc.). **It is not used for data persistence.**

## Data Persistence (local)

Each trial is saved via \`PUT\`:

\`\`\`js
const pendingDataSaves = []; // tracks in-flight fetches

on_data_update: function(data) {
const savePromise = fetch("/api/append-result/" + experimentID, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId: trialSessionId, response: data }),
}).finally(() => {
  const i = pendingDataSaves.indexOf(savePromise);
  if (i > -1) pendingDataSaves.splice(i, 1);
});
pendingDataSaves.push(savePromise);
}
\`\`\`

When the experiment finishes, it waits for all \`pendingDataSaves\` to complete before marking the session as finished:

\`\`\`js
on_finish: async function() {
_showLoading('Saving your data…');
await Promise.all(pendingDataSaves);
await fetch("/api/complete-session/" + experimentID, { method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId: trialSessionId }),
});
_showSuccess();
}
\`\`\`

## System Metadata

Automatically collected at the start of each session:

\`\`\`js
const metadata = getMetadata();
// {
//   browser: "Chrome", browserVersion: "125.0",
//   os: "Windows", screenWidth: 1920, screenHeight: 1080,
//   screenResolution: "1920x1080", viewportWidth: 1536,
//   viewportHeight: 792, language: "en-US",
//   userAgent: "Mozilla/5.0 ...", startedAt: 1715030400000
// }
\`\`\`

## File Upload

\`\`\`js
window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '/api/participant-files/' + experimentID;
\`\`\`

The DynamicPlugin's \`FileUploadResponseComponent\` automatically uses this endpoint for participants to upload files during the experiment.
`,
};
