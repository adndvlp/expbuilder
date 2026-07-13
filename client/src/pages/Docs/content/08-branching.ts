import type { DocSection } from "./types";

export const BranchingSection: DocSection = {
  id: "branching",
  title: "Branching System",
  content: `# Branching System

Branching allows the experiment flow to change based on the participant's responses. There are **five mechanisms** that interact with each other.

## Branching Globals

\`\`\`js
window.skipRemaining          // boolean — skip trials until finding the target
window.nextTrialId            // string | number | null — target trial for the branch
window.branchingActive         // boolean — indicates a branch is in progress
window.branchCustomParameters  // object | null — params to inject into the target trial
\`\`\`

## Full Flow

\`\`\`mermaid
sequenceDiagram
  participant T1 as Trial A (source)
  participant W as window globals
  participant T2 as Trial B (intermediate procedures)
  participant T3 as Trial C (target)

  T1->>T1: on_finish: evaluate branchConditions
  T1->>W: window.nextTrialId = "C"
  T1->>W: window.skipRemaining = true
  T1->>W: window.branchingActive = true
  T1->>W: window.branchCustomParameters = {...}

  loop Each next procedure
      T2->>T2: conditional_function()
      alt window.skipRemaining && id !== nextTrialId
          T2-->>T2: return false (skip)
      else id === nextTrialId
          T2->>W: window.skipRemaining = false
          T2->>W: window.nextTrialId = null
          T2-->>T2: return true (run)
      end
  end

  T3->>T3: on_start: apply branchCustomParameters
\`\`\`

## 1. Branch Conditions (on_finish)

Evaluated when a trial ends. If a condition is met, the experiment jumps to the target trial:

\`\`\`js
on_finish: function(data) {
const branchConditions = [
  {
    tags: ["target-trial-uuid"],
    rules: [
      { column: "response", op: "==", value: "f" },
      { column: "rt", op: "<", value: 1000 }
    ]
  }
];

// OR between conditions, AND between rules of each condition
for (const condition of branchConditions) {
  const allMatch = condition.rules.every(rule => {
    let propValue = data[rule.column];
    if (Array.isArray(propValue)) return propValue.includes(rule.value);
    if (typeof propValue === "number" || typeof rule.value === "number") {
      return compareNumeric(propValue, rule.op, Number(rule.value));
    }
    return compareString(String(propValue), rule.op, String(rule.value));
  });

  if (allMatch) {
    window.nextTrialId = condition.nextTrialId;
    window.skipRemaining = true;
    window.branchingActive = true;
    window.branchCustomParameters = condition.customParameters;
    break;
  }
}

// No match → auto-branch to the first trial in the list by default
if (!window.skipRemaining && branches.length > 0) {
  window.nextTrialId = branches[0];
  window.skipRemaining = true;
  window.branchingActive = true;
}
}
\`\`\`

## 2. Comparison Operators

| Operator | Description | Example |
|---|---|---|
| \`==\` | Equal (string or number) | \`response == "f"\` |
| \`!=\` | Not equal | \`response != "j"\` |
| \`>\` | Greater than (numeric) | \`rt > 500\` |
| \`<\` | Less than (numeric) | \`rt < 2000\` |
| \`>=\` | Greater than or equal | \`slider_value >= 50\` |
| \`<=\` | Less than or equal | \`slider_value <= 25\` |

If the value is an array (checkbox/multi-select response), \`includes()\` is used instead of direct comparison.

## 3. Column Names for Conditions

| Trial type | Column name | Example |
|---|---|---|
| Standard plugin | Field name in data | \`response\`, \`rt\`, \`correct\` |
| DynamicPlugin — button (idx 1) | \`ButtonResponseComponent_1_response\` | \`"Yes"\` |
| DynamicPlugin — slider (idx 2) | \`SliderResponseComponent_2_response\` | \`65\` |
| DynamicPlugin — survey | \`SurveyComponent_1_response\` (object) | Access \`.questionName\` |
| Custom (data injection) | Any field in \`data\` | \`condition\`, \`block\` |

## 4. Repeat / Jump Conditions

Allows restarting the experiment from a specific trial (via \`localStorage\`):

\`\`\`js
// on_finish of the source trial:
localStorage.setItem('jsPsych_jumpToTrial', String(targetTrialId));
document.getElementById('jspsych-container').innerHTML = '';
setTimeout(() => jsPsych.run(timeline), 100);

// In conditional_function of each procedure:
const jumpTo = localStorage.getItem('jsPsych_jumpToTrial');
if (jumpTo) {
if (String(currentId) === String(jumpTo)) {
  localStorage.removeItem('jsPsych_jumpToTrial');
  return true;  // run this trial
}
return false;   // skip
}
\`\`\`

**Key difference**: Jump can skip to **any** trial (even previous ones). Branch only jumps forward within the same scope.

## 5. Custom Params on Branch

When a branch includes \`customParameters\`, they are injected into the target trial before rendering:

\`\`\`js
on_start: function(trial) {
// 1. Conditional params override (based on previous trial data)
// ... (see section below)

// 2. Branch custom parameters (HIGHER priority — overrides the override)
if (window.branchCustomParameters) {
  // Supports nesting in DynamicPlugin:
  // "fieldType::componentName::property"
  // "fieldType::componentName::survey_json::questionName"
  Object.assign(trial, window.branchCustomParameters);
  window.branchCustomParameters = null;
  window.branchingActive = false;
}
}
\`\`\`

## 6. Conditional Function (procedure)

Each procedure has a \`conditional_function\` that determines whether it runs or is skipped:

\`\`\`js
conditional_function: function() {
const currentId = 123;

// Priority 1: pending jump/repeat (localStorage)
const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
if (jumpToTrial) {
  if (String(currentId) === String(jumpToTrial)) {
    localStorage.removeItem('jsPsych_jumpToTrial');
    return true;
  }
  return false;
}

// Priority 2: active branching (window globals)
if (window.skipRemaining) {
  if (String(currentId) === String(window.nextTrialId)) {
    window.skipRemaining = false;
    window.nextTrialId = null;
    return true;
  }
  return false;
}

return true; // run normally
}
\`\`\`

## 7. Params Override (conditional, on_start)

Modifies trial parameters based on responses from **previous trials**:

\`\`\`js
on_start: function(trial) {
const overrides = [
  {
    rules: [
      { trialId: 10, column: "response", op: "==", value: "angry" }
    ],
    paramsToOverride: {
      "stimulus": { source: "typed", value: "angry_face.png" },
      "components::TextComponent::text": { source: "typed", value: "Mood: Angry" },
      "response_components::SurveyComponent::survey_json::mood_q": { source: "typed", value: "upset" }
    }
  }
];

const allData = jsPsych.data.get().values();
for (const condition of overrides) {
  const allMatch = condition.rules.every(rule => {
    const trialData = allData.filter(d => String(d.trial_id) === String(rule.trialId));
    // ... evaluate rule ...
  });
  if (allMatch) {
    // Apply each override. Key format:
    // "paramName" → trial[paramName] = value
    // "components::ComponentName::propName" → trial.components[compIdx][propName] = value
    // "response_components::SurveyComponent::survey_json::qName" → nested
    break;
  }
}
}
\`\`\`
`,
};
