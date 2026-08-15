import type { DocSection } from "./types";

export const ResumeSection: DocSection = {
  id: "resume",
  title: "Resume System",
  content: `# Resume System

Local Run Experiment can resume an incomplete session without mixing experiments or tabs.

## Scoped state

Every key begins with \`expbuilder:local:<experimentID>:\`. The last resumable trial is stored at \`resume-trial\`; the durable UUID is stored at \`session-id\`; each tab also has a private \`tab-id\` and \`tab-session-id\`.

\`\`\`js
localStorage.setItem(_sessionKeys.resumeTrial, JSON.stringify({
  branches: data.branches || [],
  branchConditions: data.branchConditions || [],
  trialData: data
}));
\`\`\`

## Validation on reload

\`\`\`mermaid
flowchart TD
  A["Reload experiment"] --> B{"Scoped candidate exists?"}
  B -->|no| C["Create new UUID session"]
  B -->|yes| D["GET exact session from db.json"]
  D -->|HTTP unavailable or invalid| E["Block safe startup; keep local data"]
  D -->|missing or completed| C
  D -->|valid and incomplete| F{"Active in another tab?"}
  F -->|yes| C
  F -->|no| G["Resume same UUID and outbox"]
  G --> H["Resolve scoped resume branch"]
\`\`\`

The browser never treats an unverifiable candidate as a new or successfully resumed session. This prevents pending IndexedDB records from becoming detached from their server identity.

## Branch resolution

\`_resolveResumeBranch()\` reconstructs the last builder state. Zero branches means there is no target; one branch jumps directly; multiple branches evaluate their conditions. Repeat/jump state uses \`_sessionKeys.jumpTrial\`, so two experiments on the same origin cannot consume each other's jump.

## Recovery and cleanup

The session outbox replays unresolved records after reload with the original \`eventId\` and \`sequence\`. Browser identity, resume state, and acknowledged IndexedDB records are cleared only after \`complete-session\` confirms the exact stored count and last sequence. Network failure, server rejection, or a missing sequence leaves everything recoverable.
`,
};
