import type { DocSection } from "./types";

export const ResumeSection: DocSection = {
  id: "resume",
  title: "Resume",
  content: `# Resume

Resume restores the current version 3 checkpoint in the same experiment revision. The checkpoint records the selected destination, the remaining native timeline entries, parameters that have not yet been applied, and the sampled order, row, repetition and conditional-cycle results of active loops.

A selected route is saved after the source result. Resuming does not reevaluate that response and does not replay timelines that were exited. When the destination enters a new loop, its first row starts at that trial; subsequent rows start at the loop's explicit entry.

The source result must receive durable acknowledgement before execution continues. This rule is shared by local and public experiments. Ordinary navigation stays in the same document; a page reload restores the saved cursor.

A damaged checkpoint, an unknown destination, or a different experiment revision stops execution with a runtime error. Earlier checkpoint formats are not converted.
`,
};
