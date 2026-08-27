import type { DocSection } from "./types";

export const ResumeSection: DocSection = {
  id: "resume",
  title: "Resume System",
  content: `# Resume System

Allows the participant to close the browser and resume where they left off.

## Per-Trial Persistence

On each \`on_data_update\` of a trial with \`builder_id\`:

\`\`\`js
localStorage.setItem('jsPsych_resumeTrial', JSON.stringify({
branches: data.branches || [],
branchConditions: data.branchConditions || [],
trialData: data,
}));
\`\`\`

## Resolution on Reload

\`\`\`mermaid
flowchart TD
  A["Reload experiment"] --> B{"sessionId in localStorage?"}
  B -->|no| C["Start new session"]
  B -->|yes| D["isResuming = true"]
  D --> E["Read jsPsych_resumeTrial"]
  E --> F["_resolveResumeBranch()"]
  F --> G{"Branch resolved?"}
  G -->|branch| H["Activate the resolved branch route"]
  G -->|sequential| K["Activate the compiled address cursor"]
  G -->|no: null| I["Experiment already completed — start new one"]
  G -->|error| J["Corrupt data — clean reset"]
\`\`\`

## Branch Resolution

\`_resolveResumeBranch(resumeRaw)\` reconstructs the last state:

\`\`\`js
// 1. If 0 branches → experiment finished normally
// 2. If 1 branch → jump to that trial (without evaluating conditions)
// 3. If 2+ branches → evaluate branch conditions:
//    - Build column names (DynamicPlugin support)
//    - Evaluate rules with operators (==, !=, >, <, >=, <=)
//    - Arrays: includes()
//    - Survey: extract nested property
//    - No match → first branch by default
\`\`\`

## Anti-Loop Guard

Prevents a jump/reload from getting stuck in an infinite cycle:

\`\`\`js
// On startup:
const startup = window.ExpBuilderNavigation.consumeReloadMarker();
if (startup.status === 'stalled') {
  // The same cursor progress was observed on two marked reloads.
  // Only jump-owned keys are invalidated and execution is blocked safely.
}
\`\`\`

## Cleanup on Finish

\`\`\`js
on_finish: async function() {
window.ExpBuilderNavigation.clearTransientState();
localStorage.removeItem('jsPsych_currentSessionId');
localStorage.removeItem('jsPsych_participantNumber');
}
\`\`\`
`,
};
