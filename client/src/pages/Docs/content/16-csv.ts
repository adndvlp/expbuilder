import type { DocSection } from "./types";

export const CsvSection: DocSection = {
  id: "csv",
  title: "Column Mapping / CSV",
  content: `# Column Mapping / CSV

The **Column Mapping** is the system that connects external data (CSV) with trial parameters. It is the bridge between your data and \`jsPsych.timelineVariable()\`.

## The source/value Wrapper

Each trial parameter is stored in this format:

\`\`\`json
{
"source": "typed",
"value": "Hello World"
}
\`\`\`

| source | Meaning | Example |
|---|---|---|
| \`"typed"\` | Fixed value written directly | \`{ source: "typed", value: "Hello" }\` |
| \`"csv"\` | Reference to a CSV column | \`{ source: "csv", value: "stimulus_column" }\` |
| \`"none"\` | No value (use plugin default) | \`{ source: "none", value: null }\` |

## Generated Code

\`\`\`js
// CSV uploaded with columns: stimulus, correct_key, condition
// Column mapping: stimulus → csv:stimulus, correct_choice → csv:correct_key

const test_stimuli_myTrial = [
{ stimulus: "img/a.png", correct_key: "f", condition: "A" },
{ stimulus: "img/b.png", correct_key: "j", condition: "B" },
];

const myTrial_timeline = {
type: jsPsychImageKeyboardResponse,
stimulus: jsPsych.timelineVariable('stimulus'),
correct_choice: jsPsych.timelineVariable('correct_key'),
data: {
  builder_id: "uuid-abc",
  condition: jsPsych.timelineVariable('condition'),
},
};

const myTrial_procedure = {
timeline: [myTrial_timeline],
timeline_variables: test_stimuli_myTrial,
randomize_order: false,
};
\`\`\`

## Parsing

Supports two formats:

| Format | Library | Notes |
|---|---|---|
| \`.csv\` | PapaParse | Delimiter: auto-detected |
| \`.xlsx\` | ExcelJS | First row = headers |

Column names are **case-sensitive** and are sanitized (spaces → \`_\`).

## Media File Mapping

If a column contains file names, they are resolved as URLs:

\`\`\`js
// Uploaded file: "face_neutral.png"
// In CSV column: "face_neutral.png"
// Generated:
//   Local:  "/api/files/:experimentID/face_neutral.png"
//   Public: "./assets/face_neutral.png" (base64 baked-in)
\`\`\`

Mapping is done by \`mapFileToUrl.ts\`, which searches for the file name in the Timeline's uploaded file list.

## Column Mapping in DynamicPlugin

For trials using DynamicPlugin, column mapping includes the properties of each component:

\`\`\`json
{
"components": {
  "source": "typed",
  "value": [
    { "type": "TextComponent", "text": { "source": "csv", "value": "stimulus_text" } }
  ]
},
"response_components": {
  "source": "typed",
  "value": [
    { "type": "ButtonResponseComponent", "choices": { "source": "csv", "value": "options" } }
  ]
}
}
\`\`\`
`,
};
