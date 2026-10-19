import type { DocSection } from "./types";

export const ApiReferenceSection: DocSection = {
  id: "api-reference",
  title: "Internal APIs Reference",
  content: `# Internal APIs Reference

## window Globals

| Variable | Type | Mode | Description |
|---|---|---|---|
| \`window.JSPSYCH_FILE_UPLOAD_ENDPOINT\` | string | Both | Endpoint for FileUploadResponseComponent |
| \`window.JSPSYCH_SESSION_ID\` | string | Both | Current Session ID |
| \`window.JSPSYCH_LOCAL_KEYS\` | object | Local | Experiment-scoped storage keys |
| \`window._firebaseReady\` | boolean | Published | true when Firebase SDK loaded |

## Navigation coordinator

The generated runtime uses \`window.ExpBuilderNavigation\` for native timeline transitions, destination parameters and version 3 resume cursors. Configure navigation through trial conditions and explicit defaults. Each loop retains its own sampled row and repetition state inside this coordinator.

## localStorage Keys

| Key | Content | Lifecycle |
|---|---|---|
| \`expbuilder:local:<id>:session-id\` | Durable session UUID | Cleared only after confirmed completion |
| \`expbuilder:local:<id>:participant-number\` | Positive server-assigned number | Cleared only after confirmed completion |
| \`expbuilder:local:<id>:resume-trial\` | Versioned checkpoint with resolved branch/sequential route | Updated each trial; scoped by experiment |

## sessionStorage Keys

| Key | Content | Lifecycle |
|---|---|---|
| \`expbuilder:local:<id>:tab-id\` | Tab UUID | Created once per tab |
| \`expbuilder:local:<id>:tab-session-id\` | Session UUID owned by the tab | Cleared after confirmed completion |

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
