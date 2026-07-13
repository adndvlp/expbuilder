import type { DocSection } from "./types";

export const SurveyComponentSection: DocSection = {
  id: "survey-component",
  title: "Survey Component (SurveyJS)",
  content: `# Survey Component (SurveyJS)

The \`SurveyComponent\` integrates the **SurveyJS** survey engine within the DynamicPlugin. It allows creating complex surveys with multiple question types.

## Supported Question Types

| Type | Description |
|---|---|
| \`text\` | Free text (single line) |
| \`comment\` | Multiline text |
| \`radiogroup\` | Single selection (radio buttons) |
| \`checkbox\` | Multiple selection (checkboxes) |
| \`dropdown\` | Dropdown menu |
| \`rating\` | Rating scale (stars, numbers, etc.) |
| \`boolean\` | Yes/No |
| \`imagepicker\` | Image selection |
| \`ranking\` | Sort items by preference |
| \`matrix\` | Question matrix (single/multiple/dropdown) |

## Survey Configuration

Edited visually in the **SurveyEditor** of the Trial Designer. The config is serialized as SurveyJS JSON:

\`\`\`json
{
"title": "Customer Satisfaction",
"description": "Please answer the following questions",
"elements": [
  {
    "type": "radiogroup",
    "name": "question1",
    "title": "How satisfied are you?",
    "choices": ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied"]
  },
  {
    "type": "rating",
    "name": "question2",
    "title": "Rate our service",
    "rateType": "stars",
    "rateMax": 5
  }
]
}
\`\`\`

## Theme Customization

Survey theme colors can be customized from the SurveyEditor:

| CSS Variable | Description |
|---|---|
| \`--sjs-primary-backcolor\` | Primary color |
| \`--sjs-primary-forecolor\` | Text color on primary |
| \`--sjs-font-surveytitle-color\` | Title color |
| \`--sjs-font-pagetitle-color\` | Page title color |
| \`--sjs-font-questiontitle-color\` | Question title color |

## Data Format

Each question generates a property in the response object:

\`\`\`js
// SurveyComponent with name: "rating" and question "question1"
{
SurveyComponent_1_response: {
  question1: "Satisfied",
  question2: 4
}
}
\`\`\`

To access a specific response in branching conditions:

\`\`\`js
// In evaluateCondition, the nested property is extracted:
let propValue = data["SurveyComponent_1_response"];
if (typeof propValue === "object" && propValue !== null) {
propValue = propValue["question1"]; // access specific question
}
\`\`\`

## Validation

SurveyJS handles its own validation (required, regular expressions, numeric ranges). If \`require_response\` is active, the component prevents advancing until the survey is valid.
`,
};
