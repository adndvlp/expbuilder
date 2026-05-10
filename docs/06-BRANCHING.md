# 06 - Branching & Conditions

The application has three distinct systems for conditional behavior:

## Overview

| System | When it runs | What it does | Can override params? | Target scope |
|--------|-------------|--------------|---------------------|--------------|
| **BranchConditions** | `on_finish` of current trial | Navigate to another trial | Yes | Only trials in `branches[]` |
| **RepeatConditions** | `on_finish` of current trial | Jump to any trial/loop | No | ANY trial/loop in experiment |
| **ParamsOverride** | `on_start` of current trial | Override own parameters | Yes (own params) | Based on previous trials' data |

---

## BranchConditions

### Concept
Branch conditions allow a trial to navigate to different subsequent trials based on the participant's response. The target must be in the trial's `branches[]` array (same scope — typically the same loop or timeline level).

### Data Structure
```typescript
type BranchCondition = {
  id: number;
  rules: Rule[];          // AND logic — ALL rules must match
  nextTrialId: number | string | null;  // Target (must be in branches[])
  customParameters?: Record<string, ColumnMappingEntry>;  // Params to override on target
};

type Rule = {
  column: string;   // Data column to check (e.g., "response", "rt")
  op: string;       // "==", "!=", ">", "<", ">=", "<=", "includes"
  value: string;    // Value to compare against
};
```

### UI Flow
1. In canvas, user connects trials with arrows → sets `branches[]`
2. User clicks "Branch" button → opens `BranchedTrial` modal
3. Modal shows conditions with rules table:
   - Each condition is an OR group (if any condition matches)
   - Each rule within a condition is AND (all must match)
4. Available columns come from trial data definitions (± `data` array)
5. Available target trials = only trials in `branches[]`
6. Parameter override available for branch targets (but NOT for jump targets)

### Conditional Parameters
When a branch target is in `branches[]`, its parameters can be overridden via `customParameters`. This is a `ColumnMappingEntry` map:
```typescript
customParameters: {
  "stimulus": { source: "typed", value: "new_stimulus.jpg" },
  "trial_duration": { source: "typed", value: 5000 }
}
```

### Generated Code (on_finish)
```javascript
on_finish: function(data) {
  // Branch condition 1
  if (data.response === 'yes' && data.rt < 1000) {
    jsPsych.data.get().push({ next_trial_params: {
      stimulus: 'happy_face.jpg',
      trial_duration: 3000
    }});
    return; // continues to next trial in timeline (the branch target)
  }
  // Branch condition 2
  if (data.response === 'no') {
    return; // continues to timeline default
  }
  // User custom code appended here
}
```

---

## RepeatConditions (Jump)

### Concept
Jump conditions allow a trial to jump to ANY trial/loop in the experiment (regardless of scope). This is for non-linear navigation (e.g., repeat a block, skip to end).

### Data Structure
```typescript
type RepeatCondition = {
  id: number;
  rules: Rule[];              // Same rule structure as BranchCondition
  jumpToTrialId: number | string | null;  // Target (any trial/loop)
  // NOTE: NO customParameters
};
```

### Key Difference from BranchConditions
- **No parameter override**: Jumps cannot customize target trial parameters
- **Any target**: Can jump anywhere in the experiment (not limited to `branches[]`)
- **Detection**: The UI auto-detects if a selected target is in `branches[]` or not

### UI
In the `BranchedTrial` modal, when a target trial is selected:
- If target is in `branches[]` → BranchCondition (with param override enabled)
- If target is NOT in `branches[]` → RepeatCondition/Jump (param override disabled)

### Separation Logic
```typescript
// In BranchedTrial/index.tsx::handleSaveConditions()
conditions.forEach(condition => {
  if (isInBranches(condition.nextTrialId)) {
    branchConditions.push({ ...condition });    // Branch: can override params
  } else if (condition.nextTrialId) {
    repeatConditions.push({                     // Jump: no params
      id: condition.id,
      rules: condition.rules,
      jumpToTrialId: condition.nextTrialId
    });
  }
});
```

### Generated Code (on_finish)
```javascript
on_finish: function(data) {
  // Jump condition
  if (data.response === 'retry') {
    jsPsych.endCurrentTimeline();  // returns to parent timeline
    return -1;                     // jump signal
  }
  // Branch conditions continue normally
}
```

---

## ParamsOverride

### Concept
ParamsOverride runs `on_start` and overrides the **current trial's own** parameters based on conditions evaluated on **previous trials' data**. This is distinct from BranchConditions which affect the _next_ trial.

### Data Structure
```typescript
type ParamsOverrideCondition = {
  id: number;
  rules: ParamsOverrideRule[];    // AND conditions (checking other trials)
  paramsToOverride: Record<string, ColumnMappingEntry>;  // Own params to change
};

type ParamsOverrideRule = {
  trialId: string | number;  // Which trial's data to check
  column: string;            // Which column in that trial's data
  op: string;                // Comparison operator
  value: string;             // Threshold
};
```

### Example
```
Trial A → Trial B (with paramsOverride)
If Trial A's response was 'yes', Trial B uses stimulus 'positive.jpg'
```

### UI
- Dedicated "Params Override" button in trial config
- Opens a full-screen modal (`ParamsOverride` component)
- Conditions reference data from **previous trials** in the same scope
- Parameter values are typed or CSV-based (ColumnMappingEntry)

### Generated Code (on_start)
```javascript
on_start: function(trial) {
  // Fetch data from referenced trials
  var trialData = jsPsych.data.get().filter({ trial_index: 0 }).values()[0];
  
  // Condition 1: if previous trial response was 'yes'
  if (trialData && trialData.response === 'yes') {
    trial.stimulus = 'happy_face.jpg';
    trial.trial_duration = 5000;
  }
  
  // User custom code appended here
}
```

---

## Rule System (Unified)

All three systems use the same `Rule` structure:

```typescript
type Rule = {
  column: string;    // Direct column name from trial data
  op: string;        // "==", "!=", ">", "<", ">=", "<=", "includes"
  value: string;     // Comparison value
};
```

### Column Naming Convention
- **Native plugins**: Simple names like `"response"`, `"rt"`, `"correct"`
- **Dynamic Plugin**: Prefixed names like `"ButtonResponseComponent_1_response"`, `"ImageComponent_1_stimulus"`
- **Legacy fields** (`prop`, `fieldType`, `componentIdx`) still exist for backward compatibility but are no longer actively used

### Condition Evaluation
- Within a condition: rules are ANDed (all must match)
- Across conditions: ORed (first matching condition wins)
- Conditions are evaluated in order

### Available Columns for Rules
The UI shows available data columns from:
1. **Trial data definitions** (`data` array): Columns that the trial generates
2. **Current trial's own data**: `response`, `rt`, `correct`, `trial_index`, etc.
3. **For ParamsOverride**: Columns from referenced previous trials (loaded dynamically)

---

## LoopConditions

Separate from branch/jump — these control whether a loop repeats.

```typescript
type LoopCondition = {
  id: number;
  rules: LoopConditionRule[];  // Reference trial + column + op + value
};

type LoopConditionRule = {
  trialId: string | number;  // Which trial inside the loop
  column: string;
  op: string;
  value: string;
};
```

When `isConditionalLoop` is true, the loop repeats as long as conditions are met:
- Checked at the end of each loop iteration
- Configurable through `ConditionalLoop` modal (nested in LoopsConfig)
- Overrides `repetitions` — loop doesn't stop at a fixed count

### Generated Code
```javascript
loop_function: function(data) {
  // Check conditions from trial data
  var lastTrialData = jsPsych.data.get().last(1).values()[0];
  return lastTrialData.response === 'repeat';  // true = repeat again
}
```

---

## Trial Availability Rules

When configuring branches/paramsOverride, a trial can only reference trials that come **before** it in the timeline:

### If trial is in main timeline
- Only trials/loops with lower indices are available

### If trial is inside a loop
- Trials from same loop that come before it (from `loopTimeline`)
- PLUS all trials from main timeline (to allow jumping out)
