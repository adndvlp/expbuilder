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
| \`window.JSPSYCH_LOCAL_KEYS\` | object | Local | Experiment-scoped storage keys |
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
| \`expbuilder:local:<id>:session-id\` | Durable session UUID | Cleared only after confirmed completion |
| \`expbuilder:local:<id>:participant-number\` | Positive server-assigned number | Cleared only after confirmed completion |
| \`expbuilder:local:<id>:resume-trial\` | Versioned checkpoint with resolved branch/sequential route | Updated each trial; scoped by experiment |
| \`expbuilder:local:<id>:jump-request\` | Versioned compiled address, cursor, progress and source identity | Cleared when the target is consumed or navigation is invalidated |

## sessionStorage Keys

| Key | Content | Lifecycle |
|---|---|---|
| \`expbuilder:local:<id>:tab-id\` | Tab UUID | Created once per tab |
| \`expbuilder:local:<id>:tab-session-id\` | Session UUID owned by the tab | Cleared after confirmed completion |
| \`expbuilder:local:<id>:jump-reload\` | \`"1"\` | Written before reload, cleared at start |

## Template Markers

| Marker | Location | Purpose |
|---|---|---|
| \`// __INIT_JSPSYCH_START__\` | Start of initJsPsych block | Delimits replaceable zone |
| \`// __INIT_JSPSYCH_END__\` | End of initJsPsych block | Delimits replaceable zone |

## Express Endpoints (local mode)

| Method | Route | Body / Response |
|---|---|---|
| POST | \`/api/append-result/:id\` | \`{ sessionId, metadata?, displayName? }\` → \`{ success, id, participantNumber, created }\` |
| PUT | \`/api/append-result/:id\` | \`{ sessionId, eventId, sequence, response }\` → matching ACK + \`storedCount\` |
| GET | \`/api/session-results/:id?sessionId=:sid\` | Validate/query one persisted session |
| GET | \`/api/session-result/:id/:sid\` | Read one session including \`data\`; internal delivery events are omitted |
| POST | \`/api/complete-session/:id\` | \`{ sessionId, expectedEventCount, lastSequence }\` → matching count/sequence |
| POST | \`/api/participant-files/:id\` | \`{ sessionId, files: [{ name, data, type?, size? }] }\` |
| PATCH | \`/api/rename-session/:id\` | \`{ sessionId, displayName }\`; identity is unchanged |
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
