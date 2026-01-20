# ParamsOverride Refactoring Documentation

## Overview

The ParamsOverride component has been modernized and refactored to match the current state of BranchedTrial component, with improved modularity, better support for dynamic plugins, and proper integration of ParameterInput.

## File Structure

```
ParamsOverride/
├── index.tsx                    # Main component
├── types.ts                     # TypeScript type definitions
├── useParamsOverride.ts         # Custom hook for state management
├── ConditionActions.ts          # Pure functions for condition manipulation
├── ConditionBlock.tsx           # Component for rendering a condition block
├── RuleRow.tsx                  # Component for rendering rule rows
└── ParameterOverrideRow.tsx     # Component for rendering parameter override rows
```

## Key Improvements

### 1. **Modular Architecture**

- Separated concerns into multiple files
- Each file has a single, clear responsibility
- Easier to maintain and test

### 2. **Dynamic Plugin Support**

- Full support for `plugin-dynamic` trials
- Handles field types (components/response_components)
- Component selection and property mapping
- Survey JSON question selection
- Button response component support

### 3. **ParameterInput Integration**

- Uses the shared `ParameterInput` component for consistent parameter editing
- Supports all parameter types (boolean, number, string, arrays, etc.)
- Maintains consistency with other parts of the application

### 4. **Modern Styling**

- Matches BranchedTrial styling
- Gradient buttons
- Hover effects
- Better visual hierarchy

### 5. **Type Safety**

- Proper TypeScript types throughout
- No `any` types (replaced with `unknown` where needed)
- Better type inference
- ESLint compliant

## Component Breakdown

### `index.tsx`

Main component that orchestrates all sub-components. Handles:

- State management delegation to `useParamsOverride` hook
- Action handling through `ConditionActions`
- Rendering logic for empty states and condition blocks

### `types.ts`

Type definitions re-exported from parent types for consistency.

### `useParamsOverride.ts`

Custom hook that encapsulates all state management logic:

- Loading trial data and parameters
- Managing conditions state
- Finding trials by ID
- Determining available trials
- CSV column management
- Save functionality

### `ConditionActions.ts`

Pure functions for condition manipulation:

- `addCondition`
- `removeCondition`
- `addRuleToCondition`
- `removeRuleFromCondition`
- `updateRule`
- `addParameterToOverride`
- `removeParameterFromOverride`
- `updateParameterOverride`

### `ConditionBlock.tsx`

Renders a complete condition block with:

- Header with condition number and remove button
- Rules table
- Parameter override rows
- Add rule/parameter buttons

### `RuleRow.tsx`

Renders a single rule row with:

- Trial selection
- Field type/component/property selectors (for dynamic plugins)
- Data field selector (for normal plugins)
- Operator selection
- Value input with smart dropdowns for survey questions
- Remove button

### `ParameterOverrideRow.tsx`

Renders parameter override controls:

- Parameter selection dropdown
- Source selection (None/Type value/CSV column)
- Value input using ParameterInput component

## Usage

The component is used within the ParamsOverride tab of a trial configuration modal:

```tsx
<ParamsOverride selectedTrial={selectedTrial} />
```

## Dynamic Plugin Handling

For dynamic plugins, the component intelligently handles:

1. Field type selection (Stimulus/Response)
2. Component selection from trial's column mapping
3. Property selection based on component type:
   - Survey components: Select question from survey_json
   - Button components: Select "response" property
   - Other components: Free text input

## Normal Plugin Handling

For normal plugins, it provides:

1. Trial selection from trials that come before
2. Data field selection from the trial's plugin
3. Operator selection
4. Value input

## CSV Column Integration

Supports using CSV columns for parameter override values, allowing dynamic parameter setting based on trial data.

## Save Functionality

- Auto-saves to backend using `updateTrial` API
- Shows visual feedback with save indicator
- Updates local state to reflect changes immediately

## Browser Compatibility

Works in all modern browsers that support:

- ES6+
- React Hooks
- CSS custom properties
