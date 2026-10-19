import type { DocSection } from "./types";

export const NestedLoopsSection: DocSection = {
  id: "nested-loops",
  title: "Nested Loops",
  content: `# Nested Loops

A loop can contain trials and other loops. Each item has one direct owner; \`parentLoopId\` and the container's ordered member list describe containment.

## Recursive Generation

The compiler registers each loop's definition, explicit entry and structural continuation. The navigation coordinator creates native jsPsych procedures as those loops are entered. Each procedure owns timeline variables, repetitions, sampling and its active row's future entries.

## CSV and Repetition

Trials using their owner's CSV read the current loop row. Child mappings are merged into that row under scoped variable names. A fixed child mapping is reused for all owner rows. Nested containers keep their own row iteration and repetition settings.

## Trial Routing Across Scopes

Every structural edge connects actual trials. Grouping, ungrouping, expanding and collapsing preserve those IDs and their conditions and parameters. A collapsed container can display a projected edge to a hidden trial; the container is never the persisted branch endpoint.

The coordinator retains the active common ancestor when selecting a destination. It aborts abandoned descendant procedures and creates future entries for the target's remaining ancestry. Selecting a trial inside an active ancestor preserves that ancestor's CSV row and repetition.

## Completing a Container

Each new row starts at its explicit entry. A selected middle-of-loop destination applies to the first entered row; subsequent rows use the regular entry. Destination parameters are consumed once.

A matched conditional exit leaves the affected loops immediately. An ordinary default exit is deferred until their rows, repetitions and conditional cycles finish. If the last row has no deferred exit, the loop's explicit structural continuation is used. A previous row's decision does not leak into another row.

Resume restores the version 3 cursor, sampled order, row, repetition and future entries without replaying an exited procedure.

## Moving Items

\`Move Item\` accepts trials only. Loops are excluded as movable sources and destinations. Creating and ungrouping nested containers remains supported.
`,
};
