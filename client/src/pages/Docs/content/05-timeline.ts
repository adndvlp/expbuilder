import type { DocSection } from "./types";

export const TimelineSection: DocSection = {
  id: "timeline",
  title: "Timeline — Structure",
  content: `# Timeline — Structure

The timeline is built in \`generateTrialLoopCodes.ts\` and assembled at the end of the generated script.

## Timeline Push Order

\`\`\`mermaid
flowchart LR
  A["timeline = []"] --> B["1. Preload trial"]
  B --> C["2. Fullscreen trial"]
  C --> D["3. Trials / Loops"]
  D --> E["jsPsych.run(timeline)"]

  B1["jsPsychPreload with all uploaded files"] -.- B
  C1["jsPsychFullscreen · fullscreen_mode: true"] -.- C
  D1["Procedures, loops, nested loops"] -.- D
\`\`\`

\`\`\`js
const timeline = [];

// 1. Preload (only if files were uploaded from the Timeline panel)
if (uploadedFiles.length > 0) {
const preload_trial = {
  type: jsPsychPreload,
  auto_preload: false,
  images: allImageUrls,
  video: allVideoUrls,
  audio: allAudioUrls,
};
timeline.push(preload_trial);
}

// 2. Fullscreen (configurable in Canvas Styles)
const fullscreen_trial = {
type: jsPsychFullscreen,
fullscreen_mode: true,
};
timeline.push(fullscreen_trial);

// 3. Dynamically generated trials and loops
// ... (trial/loop code inserted here) ...

// 4. Run
jsPsych.run(timeline);
\`\`\`

## Why "procedure"?

In jsPsych, standalone trials inside a loop must be wrapped in a \`procedure\` object (or nested \`timeline\`). The Builder always wraps each trial in a procedure to:

1. **Support \`conditional_function\`** — skip/branch/jump mechanism between trials
2. **Support \`timeline_variables\`** — CSV data that parameterizes the trial
3. **Uniformity** — same format for trials inside and outside loops

## Structure of a Trial (procedure)

\`\`\`js
// Individual trial definition
const myTrial_timeline = {
type: jsPsychHtmlKeyboardResponse,

// Plugin parameters (with timeline variables if CSV is present)
stimulus: jsPsych.timelineVariable('stimulus'),
prompt: jsPsych.timelineVariable('prompt'),

// Metadata injected by the Builder
data: {
  trial_id: 123,              // Numeric ID (DB)
  builder_id: 123,            // Stable builder trial identity
  trial_name: "Encoding Task",
  isInLoop: false,
  branches: [],               // Target trial IDs for branching
  branchConditions: [],       // Active branch conditions on this trial
},

// Callbacks (generated if applicable)
on_start: function(trial) { /* params override + branch custom params */ },
on_finish: function(data)  { /* repeat/jump + branch conditions */ },
};

// Procedure wrapper
const myTrial_procedure = {
timeline: [myTrial_timeline],
timeline_variables: test_stimuli_myTrial, // CSV object array
randomize_order: false,
conditional_function: function() {
  // Skip/jump/branch logic (see Branching System)
},
};

timeline.push(myTrial_procedure);
\`\`\`

## Structure of a Loop

\`\`\`js
// Unified variables from all trials inside the loop
const loop_abc123_stimuli = [
{ trialA_stimulus: "img1.png", trialB_word: "hello" },
{ trialA_stimulus: "img2.png", trialB_word: "world" },
];

// Individual trials inside the loop (each with its conditional_function)
const trialA_timeline = { type: ..., data: { isInLoop: true, ... } };
const trialA_proc = {
timeline: [trialA_timeline],
conditional_function: function() { /* skip with loop vars */ }
};

// One iteration per CSV row
const loop_abc123_iteration = {
  timeline: [trialA_proc, trialB_proc],
  on_timeline_finish: function() {
    // Clear resolved local decisions; preserve pending trial routes.
  }
};

// Main loop
const loop_abc123 = {
timeline: [loop_abc123_iteration],
timeline_variables: loop_abc123_stimuli,
randomize_order: false,
repetitions: 3,

// If conditional loop:
loop_function: function(data) {
  // Evaluates loopConditions → true = repeat, false = exit
},

// Initialize trial routing state when entering the container
on_timeline_start: function() {
  loop_abc123_NextTrialId = null;
  loop_abc123_SkipRemaining = false;
},
on_timeline_finish: function() {
  // Acknowledge inherited trial execution and transport an unresolved exit
},
};

const loop_abc123_procedure = {
timeline: [loop_abc123],
conditional_function: function() { /* skip entire loop */ }
};

timeline.push(loop_abc123_procedure);
\`\`\`

## Branching Variables with Loop Scope

Each loop declares lexical variables to transport its contained trials' decisions. Structural destinations are actual trials, including trials in other scopes. Loops have no branch fields of their own:

| Variable | Scope | Purpose |
|---|---|---|
| \`loop_ID_NextTrialId\` | Inside loop ID | Branch target trial |
| \`loop_ID_SkipRemaining\` | Inside loop ID | Active skip flag |
| \`loop_ID_BranchingActive\` | Inside loop ID | Indicates ongoing branch |
| \`loop_ID_BranchCustomParameters\` | Inside loop ID | Active branch params |

Where \`ID\` is the sanitized loop ID. Grouping and ungrouping preserve the trial endpoints; a collapsed loop displays their projected connections. \`Move Item\` accepts trials only.
`,
};
