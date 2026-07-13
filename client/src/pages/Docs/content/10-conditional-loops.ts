import type { DocSection } from "./types";

export const ConditionalLoopsSection: DocSection = {
  id: "conditional-loops",
  title: "Conditional Loops (While)",
  content: `# Conditional Loops (While)

A **conditional loop** repeats its content as long as a condition is met, similar to a \`while\` in programming.

Configured in **Builder → Loop → Conditional Loop Settings**.

## loop_function

The generated code includes a \`loop_function\` that jsPsych evaluates after each iteration:

\`\`\`js
loop_function: function(data) {
// data = latest data generated in this loop iteration
const loopConditions = [
  {
    rules: [
      { column: "ButtonResponseComponent_1_response", op: "!=", value: "Done" }
    ]
  }
];

// OR between conditions, AND between rules
for (const condition of loopConditions) {
  const allMatch = condition.rules.every(rule => {
    let propValue = data[rule.column];
    // ... same evaluation as branch conditions ...
  });
  if (allMatch) return true; // repeat the loop
}

return false; // exit the loop
}
\`\`\`

## Flow

\`\`\`mermaid
flowchart TD
  A["Loop start"] --> B["on_timeline_start: reset loop vars"]
  B --> C["Run iteration"]
  C --> D["loop_function(data)"]
  D -->|true| E["on_timeline_finish"]
  E --> C
  D -->|false| F["on_timeline_finish final"]
  F --> G["Continue timeline"]
\`\`\`

## Interaction with Branching Inside the Loop

Branching code inside a conditional loop uses loop-scoped variables:

\`\`\`js
// on_finish of a trial inside the conditional loop:
if (allMatch && rule.nextTrialId) {
window.loop_LOOPID_NextTrialId = rule.nextTrialId;
window.loop_LOOPID_SkipRemaining = true;
window.loop_LOOPID_BranchingActive = true;
}

// on_timeline_finish of the loop:
// Syncs the loop state to the global scope so branching continues after exiting
if (window.loop_LOOPID_BranchingActive) {
window.skipRemaining = true;
window.nextTrialId = window.loop_LOOPID_NextTrialId;
window.branchingActive = true;
}
\`\`\`

## Limitations

- Loop conditions only access data from the **current iteration** (not accumulated from previous iterations)
- Loop conditions are evaluated with the same operators as branching (\`==\`, \`!=\`, \`>\`, \`<\`, \`>=\`, \`<=\`)
- For accumulated data across iterations, use \`jsPsych.data.get().last(N)\` in custom code
`,
};
