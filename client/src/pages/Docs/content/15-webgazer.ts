import type { DocSection } from "./types";

export const WebgazerSection: DocSection = {
  id: "webgazer",
  title: "WebGazer (Eye Tracking)",
  content: `# WebGazer (Eye Tracking)

The eye tracking module generates a sequence of 4 phases that are inserted at the beginning of the timeline. Configured from **Builder → Trial Config → WebGazer**.

Code generated from \`Webgazer/generatePhaseCode.ts\`.

## Phase Sequence

\`\`\`mermaid
flowchart TD
  A["1. Init Camera"] --> B["2. Calibrate"]
  B --> C["3. Validate"]
  C --> D{"Sufficient accuracy?"}
  D -->|"meanError < threshold"| E["Experiment timeline"]
  D -->|"meanError >= threshold"| F["4. Recalibrate"]
  F --> B
\`\`\`

## Phase 1: Init Camera

\`\`\`js
{
type: jsPsychWebgazerInitCamera,
instructions: "Position your face...",
}
\`\`\`

## Phase 2: Calibrate

\`\`\`js
{
type: jsPsychWebgazerCalibrate,
calibration_points: [[25,25],[75,25],[50,50],[25,75],[75,75]],
calibration_mode: 'click',  // 'click' | 'view'
repetitions_per_point: 1,
}
\`\`\`

## Phase 3: Validate

\`\`\`js
{
type: jsPsychWebgazerValidate,
validation_points: [[25,25],[75,25],[50,50],[25,75],[75,75]],
roi_radius: 200,
time_to_saccade: 1000,
validation_duration: 2000,
show_validation_progress: true,
}
\`\`\`

## Phase 4: Recalibrate (conditional)

\`\`\`js
{
timeline: [calibrate_trial, validate_trial],
conditional_function: function() {
  const lastValidation = jsPsych.data.get()
    .filter({ trial_type: 'webgazer-validate' }).last(1).values()[0];
  const percentInRoi = lastValidation?.percent_in_roi || [];
  const meanError = percentInRoi.length > 0
    ? percentInRoi.reduce((a, b) => a + b, 0) / percentInRoi.length
    : 100;
  return meanError < MINIMUM_PERCENT_ACCEPTABLE;
},
loop_function: function(data) {
  return currentAttempts < maxAttempts && !thresholdMet;
}
}
\`\`\`

## Predefined Calibration Points

| Preset | Points |
|---|---|
| 5 points | Corners + center |
| 9 points | 3×3 grid |
| 13 points | Grid with intermediate points |

## CSV and WebGazer

Each phase can have its own column mapping to vary instructions per trial:

\`\`\`js
const test_stimuli_calibrate = [
{ instructions: "Look at the dot and click", choices: ["Continue"] },
];

const calibrate_timeline = {
type: jsPsychWebgazerCalibrate,
instructions: jsPsych.timelineVariable('instructions'),
};
\`\`\`

## Output Data

| Phase | Data |
|---|---|
| Init Camera | \`webgazer_init_camera_data\` |
| Calibrate | \`webgazer_calibrate_data\` (matrix of points) |
| Validate | \`webgazer_validate_data\` + \`percent_in_roi\` |
`,
};
