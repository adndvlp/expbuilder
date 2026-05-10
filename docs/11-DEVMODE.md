# 11 - DevMode & Code Components

The DevMode system allows developers to inject custom JavaScript code at the experiment level, customize jsPsych initialization, and control save/development behavior.

## DevModeContext (`contexts/DevModeContext.ts`)

```typescript
type DevModeContextType = {
  isDevMode: boolean;       // Developer toolbar and logging enabled
  setDevMode: (v) => void;
  isSaveMode: boolean;      // Whether results are saved to DB
  setSaveMode: (v) => void;
  
  code: string;             // Full generated experiment code (read-only preview)
  setCode: (v) => void;
  
  customCode: string;       // Custom code injected into the experiment
  setCustomCode: (v) => void;
  
  customInitJsPsychParams: CustomInitJsPsychParams;  // Override jsPsych init
  setCustomInitJsPsychParam: (
    variant: "local" | "public",
    param: string,
    value: string
  ) => void;
  
  customPreInitCode: CustomPreInitCode;  // Code run BEFORE jsPsych.initJsPsych()
  setCustomPreInitCode: (variant: "local" | "public", value: string) => void;
};
```

### CustomInitJsPsychParams

Overrides for `jsPsych.initJsPsych()` parameters, separate for local and public builds:

```typescript
type CustomInitJsPsychParams = {
  local: Record<string, string>;   // e.g., { "show_progress_bar": "true" }
  public: Record<string, string>;  // Same structure, for published experiments
};
```

### CustomPreInitCode

JavaScript code that runs **before** `jsPsych.initJsPsych()` is called:

```typescript
type CustomPreInitCode = {
  local: string;   // For local experiments
  public: string;  // For published experiments
};
```

---

## DevModeProvider (`providers/DevModeProvider.tsx`)

### Data Flow

```
DevModeProvider mounts
  ↓
GET /api/load-config/:experimentID
  ↓
Restores saved state:
  - generatedCode → code (read-only)
  - customCode → customCode
  - customInitJsPsychParams → customInitJsPsychParams
  - customPreInitCode → customPreInitCode
  - isDevMode → isDevMode
  - isSaveMode → isSaveMode
  ↓
Any state change → debounce 1s → 
  POST /api/save-config/:experimentID
  body: {
    config: { generatedCode, customCode, customInitJsPsychParams, customPreInitCode },
    isDevMode, isSaveMode
  }
```

### Persistence

All state is saved to `db.data.configs[]` via the config API:

```typescript
// ConfigDoc structure
type ConfigDoc = {
  experimentID: string;
  data: {
    generatedCode: string;              // Full experiment JS code
    customCode: string;                 // User's custom injected code
    customInitJsPsychParams: {          // jsPsych.initJsPsych overrides
      local: Record<string, string>;
      public: Record<string, string>;
    };
    customPreInitCode: {               // Pre-init code
      local: string;
      public: string;
    };
  };
  isDevMode: boolean;
  isSaveMode: boolean;
};
```

---

## DevMode Toggle Behavior

### When `isDevMode = true`
- Developer toolbar is visible during experiment run
- Trial boundaries are shown
- Console logging is more verbose
- Running experiments are tracked in configs

### When `isSaveMode = false`
- Trial results are NOT saved to the database
- Participant number still increments (for display purposes)
- Useful for testing without generating data

---

## Code Components (Custom Code Injection)

### `customCode`
Generic custom code that gets injected into the experiment. This is separate from the trial-level code injection hooks (`initialize`, `on_start`, `on_load`, `on_finish`).

### `customPreInitCode`
Code that runs **before** `jsPsych.initJsPsych()` is called. Useful for:
- Setting global variables
- Initializing external libraries
- Configuring hardware/API connections
- Setting up custom data collection

Separate variants for `local` and `public` allow different configurations for development vs published experiments.

### `customInitJsPsychParams`
Direct overrides to the parameters passed to `jsPsych.initJsPsych()`. These are merged with the default parameters (which include `display_element`, `on_finish`, etc.).

Example overrides:
```typescript
// local variant
{ "show_progress_bar": "true", "exclusions": "{}" }

// public variant (different settings for production)
{ "show_progress_bar": "false" }
```

### Integration with Code Generation

When generating the experiment code for execution or publishing:
1. Default jsPsych init params are generated
2. `customInitJsPsychParams[local|public]` overrides are merged in
3. `customPreInitCode[local|public]` is injected before `initJsPsych()` call
4. `customCode` is injected at the end of the experiment script
5. Individual trial code injection hooks (`customInitialize`, `customOnStart`, `customOnLoad`, `customOnFinish`) are applied per-trial

### Execution order in generated code:

```javascript
// 1. Custom pre-init code runs first
{ customPreInitCode.local }

// 2. jsPsych.initJsPsych with merged params
var jsPsych = initJsPsych({
  display_element: document.getElementById('jspsych-target'),
  // ...default params
  // ...customInitJsPsychParams.local overrides
});

// 3. Experiment timeline
var timeline = [ /* trial configs */ ];

// 4. Experiment runs
jsPsych.run(timeline);

// 5. Custom code injected at end
{ customCode }
```

---

## UI Location

DevMode settings are typically rendered in the builder's configuration panel alongside other experiment-level controls. The user can:
- Toggle DevMode on/off
- Toggle SaveMode on/off
- Edit custom code in a code editor
- Configure custom init params as key-value pairs
- Edit pre-init code in a code editor
- View the generated experiment code (read-only preview)
