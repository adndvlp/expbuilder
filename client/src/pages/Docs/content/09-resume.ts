import type { DocSection } from "./types";

export const ResumeSection: DocSection = {
  id: "resume",
  title: "Resume System",
  content: `# Resume System

Local Run Experiment can resume an incomplete session without mixing experiments or tabs.

## Scoped state

Every key begins with \`expbuilder:local:<experimentID>:\`. The last resumable trial is stored at \`resume-trial\`; the durable UUID is stored at \`session-id\`; each tab also has a private \`tab-id\` and \`tab-session-id\`.

\`\`\`js
localStorage.setItem(
  _sessionKeys.resumeTrial,
  JSON.stringify(_createResumeCheckpoint(data)),
);
\`\`\`

## Validation on reload

\`\`\`mermaid
flowchart TD
  A["Reload experiment"] --> B{"Claimable scoped candidate?"}
  B -->|no jump pending| C["Create new UUID session"]
  B -->|jump pending| E["Block: original session required"]
  B -->|yes| D["GET exact session from db.json"]
  D -->|unavailable or inconsistent| E
  D -->|missing/completed and no jump| C
  D -->|missing/completed with jump| E
  D -->|valid and incomplete| G["Resume same UUID and outbox"]
  G --> H["Activate stored branch/sequential route"]
\`\`\`

The browser never treats an unverifiable candidate as a new or successfully resumed session. This prevents pending IndexedDB records from becoming detached from their server identity.

## Branch resolution

\`_createResumeCheckpoint()\` stores a versioned, already-resolved route: either
\`branch\`, \`sequential\`, or no next target. On reload,
\`_resolveResumeBranch()\` accepts only that versioned format; it does not
re-evaluate an unversioned legacy payload. Repeat/jump state uses the scoped
\`_sessionKeys.jumpRequest\`, so two local experiments on the same origin cannot
consume each other's jump.

The navigation coordinator consumes the reload marker once and tracks progress
through nested loop addresses. An invalid or stalled jump is not allowed to
silently create another session: continuation requires the original verified
UUID.

## Recovery and cleanup

The session outbox replays unresolved records after reload with the original \`eventId\` and \`sequence\`. Browser identity, resume state, and acknowledged IndexedDB records are cleared only after \`complete-session\` confirms the exact stored count and last sequence. Network failure, server rejection, or a missing sequence leaves everything recoverable.
`,
};
