import type { DocSection } from "./types";

export const NestedLoopsSection: DocSection = {
  id: "nested-loops",
  title: "Nested Loops",
  content: `# Nested Loops

A loop can contain other loops, creating nested structures (e.g. trial blocks that repeat within a larger block).

## Recursive Generation

\`generateTrialLoopCodes.ts\` handles the recursion:

\`\`\`js
function generateLoopCode(loop) {
const items = getLoopTimeline(loop.id); // trials and sub-loops

for (const item of items) {
  if (item.type === 'trial') {
    codes.push(generateTrialCode(item, /* isInLoop: true */));
  } else if (item.type === 'loop') {
    codes.push(generateLoopCode(item)); // recursion
  }
}

return wrapInLoopProcedure(codes, loop);
}
\`\`\`

## CSV Merge Across Levels

When a parent loop has a CSV, the data is inherited by its children:

\`\`\`js
// If the parent loop has a CSV with columns A, B, C
// and a child trial has columns D, E:
// → timeline_variables of the loop = [{ A, B, C, trial_D, trial_E }, ...]
\`\`\`

Each trial inside the loop uses \`jsPsych.timelineVariable()\` with names prefixed by the trial name (sanitized) to avoid collisions.

## Branching Variables in Nested Loops

Each loop level has its own namespace:

\`\`\`js
// Outer loop
window.loop_OUTER_NextTrialId = ...;
window.loop_OUTER_SkipRemaining = ...;

// Inner loop (inside the outer)
window.loop_INNER_NextTrialId = ...;
window.loop_INNER_SkipRemaining = ...;
\`\`\`

## on_timeline_finish in Nesting

When an inner loop activates branching, upon finishing its iteration, \`on_timeline_finish\` propagates the state to the parent loop:

\`\`\`js
// on_timeline_finish of the inner loop:
if (window.loop_INNER_BranchingActive) {
// Propagate to outer loop
window.loop_OUTER_NextTrialId = window.loop_INNER_NextTrialId;
window.loop_OUTER_SkipRemaining = true;
window.loop_OUTER_BranchingActive = true;
}
\`\`\`
`,
};
