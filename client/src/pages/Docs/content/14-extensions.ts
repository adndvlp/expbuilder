import type { DocSection } from "./types";

export const ExtensionsSection: DocSection = {
  id: "extensions",
  title: "Extensions",
  content: `# Extensions

jsPsych extensions add cross-cutting functionality to trials. They are configured per trial from the configuration panel.

Code generated from \`utils/generateExtensionCode.ts\`.

## Mouse Tracking

Records the cursor position during the trial.

\`\`\`js
// In initJsPsych:
extensions: [
{ type: jsPsychExtensionMouseTracking }
],

// In the trial:
extensions: [
{ type: jsPsychExtensionMouseTracking,
  params: { targets: ["#target"] } }
],
\`\`\`

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`targets\` | string[] | \`["#target"]\` | CSS selectors of elements to track |
| \`events\` | string[] | \`["mousemove"]\` | Events to record |

Generated data: \`mouse_tracking_data\` — array of \`{ x, y, t, event }\`.

## Record Video

Records the webcam during the trial.

\`\`\`js
// In initJsPsych:
extensions: [
{ type: jsPsychExtensionRecordVideo }
],

// In the trial:
extensions: [
{ type: jsPsychExtensionRecordVideo }
],
\`\`\`

Generated data: \`record_video_data\` — base64 string of the recorded video.

## WebGazer (Eye Tracking)

\`\`\`js
// In initJsPsych:
extensions: [
{ type: jsPsychExtensionWebgazer }
],

// In the trial — targets are auto-detected from visual components:
extensions: [
{ type: jsPsychExtensionWebgazer,
  params: {
    targets: ["#ImageComponent_1", "#TextComponent_1"]
  }
}
],
\`\`\`

Targets are automatically generated from the visual components of the DynamicPlugin (ImageComponent, TextComponent, VideoComponent, HtmlComponent).

Generated data: \`webgazer_data\` — array of \`{ x, y, t }\` + \`webgazer_targets\`.

See the **WebGazer (Eye Tracking)** section for the calibration sequence.
`,
};
