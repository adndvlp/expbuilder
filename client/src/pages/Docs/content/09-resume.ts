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
  G -->|yes: targetId| H["localStorage.setItem('jsPsych_jumpToTrial', targetId)"]
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
const comingFromJumpReload = sessionStorage.getItem('jsPsych_jumpReload') === '1';
sessionStorage.removeItem('jsPsych_jumpReload');

if (comingFromJumpReload && existingJump) {
// The jump was processed in the previous cycle but not consumed
// → full reset, start new session
localStorage.removeItem('jsPsych_jumpToTrial');
localStorage.removeItem('jsPsych_resumeTrial');
localStorage.removeItem('jsPsych_currentSessionId');
localStorage.removeItem('jsPsych_participantNumber');
}
\`\`\`

## Cleanup on Finish

\`\`\`js
on_finish: async function() {
// Clean up resume state
localStorage.removeItem('jsPsych_resumeTrial');
localStorage.removeItem('jsPsych_currentSessionId');
localStorage.removeItem('jsPsych_participantNumber');
// Do NOT clean jsPsych_jumpToTrial here (it's cleaned when consumed)
}
\`\`\`
`,
};
