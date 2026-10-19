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

1. **Support \`conditional_function\`** — skip/branch/branching mechanism between trials
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
  defaultNextTrialId: null,    // End this route when no condition matches
},

// Callbacks (generated if applicable)
on_start: function(trial) { /* params override + branch custom params */ },
on_finish: function(data)  { /* choose a condition or explicit default; requestBranch */ },
};

// Procedure wrapper
const myTrial_procedure = {
timeline: [myTrial_timeline],
timeline_variables: test_stimuli_myTrial, // CSV object array
randomize_order: false,

};

timeline.push(myTrial_procedure);
\`\`\`

## Generated native timelines

The compiler registers each trial and loop definition with \`window.ExpBuilderNavigation\`. Every scope has an explicit \`entryItemId\`. A loop also declares \`nextItemId\`, the continuation in its parent's scope after completion.

The coordinator edits future native timeline entries when a trial selects a destination. It retains active common ancestors and closes abandoned descendants. Navigation follows explicit connections, including returns to an earlier trial or a fresh execution of the same trial.

CSV rows, sampling, repetitions and conditional cycles remain native jsPsych procedures. Ordinary default exits complete those procedures before continuing; matched conditional exits leave them immediately. A null trial default ends the current row or root route.

Grouping, ungrouping, expanding and collapsing preserve trial endpoints. A collapsed loop displays projected trial connections. \`Move Item\` accepts trials only.
`,
};
