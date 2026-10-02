import type { DocSection } from "./types";

export const BranchingSection: DocSection = {
  id: "branching",
  title: "Branching System",
  content: `# Branching System

Branching allows the experiment flow to change based on the participant's responses. Every structural connection is trial → trial. Loops contain trials and nested loops; they never own \`branches\` or \`branchConditions\`, and their IDs cannot be branch targets. Grouping or ungrouping a trial preserves its connections. A collapsed loop can visually represent connections to its hidden trials without changing their IDs.

## Routing State

\`\`\`js
window.skipRemaining          // boolean — skip trials until finding the target
window.nextTrialId            // string | number | null — target trial for the branch
window.branchingActive         // boolean — indicates a branch is in progress
window.branchCustomParameters  // object | null — params to inject into the target trial
\`\`\`

Trials at the root use these globals. Trials inside a loop use lexical variables for their owner scope. A pending decision carries the actual target trial ID and its parameters through the enclosing containers.

## Full Flow (Root Trials)

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
  const branches = [20, 30];
  const branchConditions = [{
    id: 1,
    nextTrialId: 30,
    rules: [
      { column: "response", op: "==", value: "f" },
      { column: "rt", op: "<", value: "1000" }
    ],
    customParameters: {
      stimulus: { source: "typed", value: "feedback.png" }
    }
  }];

  const decision = window.ExpBuilderBranching.decide(
    data, branches, branchConditions
  );
  if (decision.targetId !== null && decision.targetId !== undefined) {
    window.nextTrialId = decision.targetId;
    window.skipRemaining = true;
    window.branchingActive = true;
    window.branchCustomParameters = decision.customParameters;
  }
}
\`\`\`

Conditions use AND between rules; the first matching condition wins. With no match, the first trial in \`branches\` is the default. For a trial inside a loop, the generated assignments use that scope's variables instead of root globals.

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

Allows restarting the experiment from a compiled execution address:

\`\`\`js
// on_finish of the source trial:
window.ExpBuilderNavigation.requestJump(
  targetTrialId,
  { sourceId, conditionId, sourceSessionId: trialSessionId },
  data,
  () => jsPsych.pauseExperiment(),
);

// Scope wrappers inspect without consuming; real entries consume once.
const canInclude = window.ExpBuilderNavigation.allowsItem(itemId, itemKind);
const canEnter = window.ExpBuilderNavigation.enterItem(itemId, itemKind);
\`\`\`

The versioned request contains the target kind, owner and ordered
\`enterLoopIds\`. Reload waits until the source trial is durably acknowledged.
Local Run stores this state under \`expbuilder:local:<id>:jump-request\`;
published runtimes retain the current global storage default.

Repeat/jump navigation uses compiled addresses and can restart at a previous target. Structural branches retain their saved trial destinations across scopes, including entering or leaving nested loops.

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
}
}
\`\`\`

## 6. Conditional Function (procedure)

Root trial procedures use a \`conditional_function\` to determine whether they run or are skipped:

\`\`\`js
conditional_function: function() {
const currentId = 123;

// Priority 1: pending jump/repeat address
const navigationDecision =
  window.ExpBuilderNavigation.enterItem(currentId, 'trial');
if (navigationDecision !== null) {
  return navigationDecision;
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

Loop wrappers admit a nested container only when it contains the actual trial target. Row cleanup clears resolved local decisions and keeps pending exits with their parameters. Inherited target execution is acknowledged once, including when that target creates another trial branch.

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
