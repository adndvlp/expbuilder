import type { DocSection } from "./types";

export const InitJspsychSection: DocSection = {
  id: "init-jspsych",
  title: "initJsPsych — Customization",
  content: `# initJsPsych — Customization

The \`initJsPsych\` block is generated automatically but can be partially or fully customized.

## Generated Block

\`\`\`js
// __INIT_JSPSYCH_START__
const jsPsych = initJsPsych({
show_progress_bar: true, // if enabled in Canvas Styles

// Configured extensions
extensions: [
  { type: jsPsychExtensionMouseTracking },
  { type: jsPsychExtensionWebgazer },
],

on_data_update: function(data) { /* data persistence */ },
on_finish: async function() { /* cleanup + redirect */ },

// Global Custom Code injected here if configured
});
// __INIT_JSPSYCH_END__
\`\`\`

## How to Customize

**Builder → Global Code → initJsPsych → Open initJsPsych**

| Tab | Effect |
|---|---|
| Local Config | Replaces the entire block in **local preview** |
| Local (generated) | Read-only — shows the code Builder generates |
| Public Config | Replaces the entire block in **published experiment** |
| Public (generated) | Read-only — shows the code Builder generates |

If you write the same content as the generated one, the override is deleted (not stored).

**Important**: The \`// __INIT_JSPSYCH_START__\` and \`// __INIT_JSPSYCH_END__\` markers **must be preserved** in your custom code for the substitution to work.

## Global Custom Code (Extra Options)

From **Builder → Global Code → Custom Code**, code can be injected **inside** \`initJsPsych({})\` without replacing the entire block:

\`\`\`js
const jsPsych = initJsPsych({
// ... generated code ...

// --- Global Custom Code ---
display_element: 'my-custom-container',
on_interaction_data_update: function(data) { /* extra tracking */ },
override_safe_mode: true,
});
\`\`\`

Useful for adding jsPsych options not exposed in the Builder UI.

## Progress Bar

Enabled from **Canvas Styles → Progress bar**:

\`\`\`js
const jsPsych = initJsPsych({
show_progress_bar: true,
// The bar updates automatically with the number of trials in the timeline
});
\`\`\`
`,
};
