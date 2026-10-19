import type { DocSection } from "./types";

export const ConditionalLoopsSection: DocSection = {
  id: "conditional-loops",
  title: "Conditional Loops (While)",
  content: `# Conditional Loops (While)

A conditional loop repeats its content while its configured conditions match. Configure it in **Builder → Loop → Conditional Loop Settings**.

## loop_function

jsPsych evaluates \`loop_function\` after completing the container's row pass. It receives a DataCollection for that pass and reads the referenced trial's latest row:

\`\`\`js
loop_function: function(data) {
  const loopConditions = [{
    id: 1,
    rules: [{
      trialId: 20,
      column: "ButtonResponseComponent_1_response",
      op: "!=",
      value: "Done"
    }]
  }];
  return loopConditions.some(condition =>
    window.ExpBuilderBranching.evaluateReferencedCondition(
      data.values(), condition
    )
  );
}
\`\`\`

Rules within a condition use AND; conditions use OR. Conditional repetition uses \`loop_function\`; fixed repetition uses \`repetitions\`.

## Flow

\`\`\`mermaid
flowchart TD
  A["Container start: initialize routing state"] --> B["Run one CSV row"]
  B --> C["Row finish: clear resolved local decisions"]
  C --> D{"More rows?"}
  D -->|yes| B
  D -->|no| E["loop_function(data)"]
  E -->|true| B
  E -->|false| F["Container finish: transport pending trial exit"]
  F --> G["Continue timeline"]
\`\`\`

## Trial Branches Inside the Loop

Only trials evaluate \`branches\` and \`branchConditions\`. Their targets remain trial IDs, including targets outside the loop. The scope keeps lexical routing variables for these decisions.

A pending exit transports its concrete target and custom parameters to the enclosing scope. A decision resolved inside the loop is cleared at the row boundary so later rows can run. When a route enters a trial inside a repeated container, the inherited target is acknowledged once.

Loops have no branch decision or fallback destination of their own. \`loopConditions\` continue to control repetition.

## Data Used by Conditions

- Conditions reference trial data generated in the current container pass.
- Comparison operators match the trial condition evaluator.
- Custom code can query accumulated data through \`jsPsych.data.get()\`.
`,
};
