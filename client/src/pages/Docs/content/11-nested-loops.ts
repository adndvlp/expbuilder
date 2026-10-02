import type { DocSection } from "./types";

export const NestedLoopsSection: DocSection = {
  id: "nested-loops",
  title: "Nested Loops",
  content: `# Nested Loops

A loop can contain trials and other loops. Each item has one direct owner; \`parentLoopId\` and the container's ordered member list describe containment.

## Recursive Generation

The compiler loads each loop scope and generates its members recursively. Both the client and agent generators produce an iteration procedure inside each container:

\`\`\`js
const inner_iteration = {
  timeline: [trialA_wrapper, trialB_wrapper],
  on_timeline_finish: function() {
    // Clear decisions resolved in this row; retain pending trial routes.
  }
};
const inner_procedure = {
  timeline: [inner_iteration],
  timeline_variables: stimuli_inner,
  repetitions: 2,
  randomize_order: false
};
\`\`\`

## CSV and Repetition

Trials using their owner's CSV read the current loop row. Child mappings are merged into that row under scoped variable names. A fixed child mapping is reused for all owner rows. Nested containers keep their own row iteration and repetition settings.

## Trial Routing Across Scopes

Every structural edge connects actual trials. Grouping, ungrouping, expanding and collapsing preserve those IDs and their conditions and parameters. A collapsed container can display a projected edge to a hidden trial; the container is never the persisted branch endpoint.

Each scope keeps lexical variables such as:

\`\`\`js
let loop_OUTER_NextTrialId = null;
let loop_OUTER_SkipRemaining = false;
let loop_OUTER_BranchCustomParameters = null;
let loop_INNER_NextTrialId = null;
let loop_INNER_SkipRemaining = false;
let loop_INNER_BranchCustomParameters = null;
\`\`\`

These variables transport decisions made by contained trials. Loops do not own \`branches\` or \`branchConditions\`.

## Completing a Container

At each row boundary, resolved local decisions are cleared. An exit keeps the exact target trial and payload while leaving the nested container. Finishing a container propagates only an unresolved trial route to its parent or root; it never selects a branch of its own.

Incoming routes retain the original inherited trial ID and record when it executed. This acknowledges the target once across repeated rows, including when it immediately selects another trial branch. A target can be a non-first trial inside a sibling or nested loop.

## Moving Items

\`Move Item\` accepts trials only. Loops are excluded as movable sources and destinations. Creating and ungrouping nested containers remains supported.
`,
};
