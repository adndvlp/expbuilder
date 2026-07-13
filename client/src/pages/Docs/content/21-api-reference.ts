import type { DocSection } from "./types";

export const ApiReferenceSection: DocSection = {
  id: "api-reference",
  title: "Internal APIs Reference",
  content: `# Internal APIs Reference

## window Globals

| Variable | Type | Mode | Description |
|---|---|---|---|
| \`window.skipRemaining\` | boolean | Both | Activates trial skip until nextTrialId is found |
| \`window.nextTrialId\` | string | null | Both | Target trial of the active branch |
| \`window.branchingActive\` | boolean | Both | Indicates branch in progress |
| \`window.branchCustomParameters\` | object | null | Both | Params to inject into target trial |
| \`window.JSPSYCH_FILE_UPLOAD_ENDPOINT\` | string | Both | Endpoint for FileUploadResponseComponent |
| \`window.JSPSYCH_SESSION_ID\` | string | Both | Current Session ID |
| \`window._socketReady\` | boolean | Local | true when Socket.IO loaded |
| \`window._firebaseReady\` | boolean | Published | true when Firebase SDK loaded |

## Loop Scope Variables

| Variable | Scope |
|---|---|
| \`window.loop_ID_NextTrialId\` | Loop with uuid \`ID\` |
| \`window.loop_ID_SkipRemaining\` | Loop with uuid \`ID\` |
| \`window.loop_ID_BranchingActive\` | Loop with uuid \`ID\` |
| \`window.loop_ID_BranchCustomParameters\` | Loop with uuid \`ID\` |

## localStorage Keys

| Key | Content | Lifecycle |
|---|---|---|
| \`jsPsych_currentSessionId\` | Current Session ID | Created at start, cleared in on_finish |
| \`jsPsych_participantNumber\` | Participant number | Created on assignment, cleared in on_finish |
| \`jsPsych_resumeTrial\` | \`{ branches, branchConditions, trialData }\` | Updated each trial, cleared in on_finish |
| \`jsPsych_jumpToTrial\` | builder_id of target trial | Created by repeat/jump, cleared when consumed |

## sessionStorage Keys

| Key | Content | Lifecycle |
|---|---|---|
| \`jsPsych_jumpReload\` | \`"1"\` | Written before reload, cleared at start |

## Template Markers

| Marker | Location | Purpose |
|---|---|---|
| \`// __INIT_JSPSYCH_START__\` | Start of initJsPsych block | Delimits replaceable zone |
| \`// __INIT_JSPSYCH_END__\` | End of initJsPsych block | Delimits replaceable zone |

## Express Endpoints (local mode)

| Method | Route | Body / Response |
|---|---|---|
| POST | \`/api/append-result/:id\` | \`{ sessionId, metadata }\` → \`{ participantNumber }\` |
| PUT | \`/api/append-result/:id\` | \`{ sessionId, response }\` → \`{ success }\` |
| POST | \`/api/complete-session/:id\` | \`{ sessionId }\` → \`{ success }\` |
| POST | \`/api/participant-files/:id\` | FormData with file → \`{ url }\` |
| PATCH | \`/api/rename-session/:id\` | \`{ oldId, newId }\` → \`{ success }\` |
| GET | \`/api/session-name-config/:id\` | → \`{ tokens, separator }\` |

## Firebase Realtime Database Paths (published mode)

| Path | Content |
|---|---|
| \`/experiments/:id/sessions/:sid/state\` | \`"pending"|"in-progress"|"completed"|"disconnected"\` |
| \`/experiments/:id/sessions/:sid/connected\` | boolean |
| \`/experiments/:id/sessions/:sid/participantNumber\` | number |
| \`/experiments/:id/sessions/:sid/startedAt\` | TIMESTAMP |
| \`/experiments/:id/sessions/:sid/finishedAt\` | TIMESTAMP |
| \`/experiments/:id/sessions/:sid/lastUpdate\` | TIMESTAMP |
`,
};
