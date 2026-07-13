import type { DocSection } from "./types";

export const CustomCodeSection: DocSection = {
  id: "custom-code",
  title: "Custom Code Injection",
  content: `# Custom Code Injection

## Per Trial: on_start / on_finish

Each trial can have custom JavaScript code in its callbacks. Edited from **⌨ Open Code Component** in the trial panel.

### Execution Order

\`\`\`js
on_start: function(trial) {
// 1. Conditional params override (evaluated against historical data)
// 2. Branch custom parameters (applied if there is an active branch)

// --- Your code here ---
// Access to: trial, jsPsych, trialSessionId, participantNumber

// 3. The trial renders after on_start
}

on_finish: function(data) {
// 1. Repeat conditions (evaluates whether to jump)

// --- Your code here ---
// Access to: data, jsPsych, trialSessionId, participantNumber

// 2. Branch conditions (evaluates where to jump)
}
\`\`\`

### Variables Available in Trial Custom Code

| Variable | Available in | Type | Description |
|---|---|---|---|
| \`trial\` | \`on_start\` | object | Trial parameters (mutable) |
| \`data\` | \`on_finish\` | object | Completed trial data |
| \`jsPsych\` | Both | object | Global jsPsych instance |
| \`trialSessionId\` | Both | string | Current session ID |
| \`participantNumber\` | Both | number | Participant number |
| \`window.branchingActive\` | Both | boolean | Active branch |
| \`window.nextTrialId\` | Both | string | Branch target trial |
| \`window.skipRemaining\` | Both | boolean | Skip flag |
| \`window.branchCustomParameters\` | \`on_start\` | object | Branch params |

> **Do not modify** \`window.nextTrialId\`, \`window.skipRemaining\`, \`window.branchingActive\`, or \`window.branchCustomParameters\` directly. They are managed by the branching system.

### Example: Conditional Logging

\`\`\`js
on_finish: function(data) {
if (data.rt > 2000) {
  console.warn('Slow response on trial ' + data.builder_id, data);
}
}
\`\`\`

### Example: Modifying Stimulus in on_start

\`\`\`js
on_start: function(trial) {
// Change text based on participant number (even/odd)
if (participantNumber % 2 === 0) {
  trial.stimulus = 'Condition A: ' + trial.stimulus;
} else {
  trial.stimulus = 'Condition B: ' + trial.stimulus;
}
}
\`\`\`

## Global Custom Code

Injected inside \`initJsPsych({})\`. See **initJsPsych — Customization** section.

## Full initJsPsych Override

Replaces the entire block. Ideal for full control of \`on_data_update\` or \`on_finish\` without the restrictions of the generated code.
`,
};
