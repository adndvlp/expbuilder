# 13 - Code Generation System

This document covers the complete code generation ecosystem — every component that produces JavaScript for experiments, from user code injection to full experiment compilation.

---

## Architecture Map

```
User Code Input                           Code Generation                     Output
─────────────────────────────────     ────────────────────────────────     ──────
                                                                            
GlobalCustomCode.tsx                  DevModeProvider                       initJsPsych
  ├─ initJsPsych params (L/P)   →      → customInitJsPsychParams            params + 
  └─ preInit code (L/P)         →      → customPreInitCode                 pre-init code

TrialCodeInjection/index.tsx          TrialsConfig                         on_start /
  ├─ on_start user code         →      → saveField("customOnStart", ...)    on_load /
  ├─ on_load user code          →      → saveField("customOnLoad", ...)     on_finish /
  ├─ on_finish user code        →      → saveField("customOnFinish", ...)   initialize
  └─ initialize user code       →      → saveField("customInitialize", ...) code blocks

PluginEditor.tsx                     PluginsProvider                       custom plugin
  └─ plugin JS code             →      → POST /api/save-plugin/:index       .js files

generatePhaseCode.ts (WebGazer)       Webgazer component                   4-phase trial
  └─ 4 phases + recalibrate     →      → trialCode saved to DB             code

TrialCode/                                                                   
  └─ TrialCodeGenerators/              useTrialCode()                       per-trial
      ├─ onStartGenerator       →      → generateOnStartCode()             timeline
      ├─ onFinishGenerator      →      → generateOnFinishCode()            objects
      ├─ initializeGenerator    →      → generateInitializeCode()
      ├─ onLoadGenerator        →      → generateOnLoadCode()
      ├─ branchConditionsGen    →      → branching logic
      ├─ paramsOverrideGen      →      → param overrides
      ├─ repeatConditionsGen    →      → jump logic
      ├─ branchCustomParamsGen  →      → branch param overrides
      └─ conditionalFunctionGen →      → conditional loops

generateTrialLoopCodes.ts             useTrialCode() + useLoopCode()       all trial +
  └─ generateAllCodes()         →      → iterates timeline                 loop code

useLoopCode/index.ts                  generateLoopCode()                   loop
  └─ BranchingLogicCode.ts      →      → wrappers, flags, conditional_fn   structure
  └─ BranchesCode.ts            →      → on_finish, repeat/jump

generateExtensionCode.ts              useTrialCode()                       extension
  └─ generateExtensionCode()    →      → mouse-tracking/webgazer config    configs

ExperimentCode/                       LocalConfiguration.ts                full HTML
  ├─ ExperimentBase.ts          →      → jsPsych.run(timeline)             <script>
  ├─ LocalConfiguration.ts      →      → session + socket + Express
  ├─ PublicConfiguration.ts     →      → Firebase + IndexedDB + CAPTCHA
  ├─ CaptchaCode.ts             →      → _showCaptchaGate()
  ├─ ResumeCode.ts              →      → _resolveResumeBranch()
  └─ LoadingOverlay.ts          →      → _showLoading()/_hideLoading()
```

---

## Layer 1: User Code Editors

### GlobalCustomCode.tsx

The top-level UI for editing `initJsPsych()` parameters (both local and public variants) and pre-init code. Uses Monaco Editor with full jsPsych type context.

**What it edits:**
- `customInitJsPsychParams.local` / `.public` — 14 jsPsych init params (on_finish, on_data_update, on_trial_start, etc.)
- `customPreInitCode.local` / `.public` — raw JS that runs before `initJsPsych()` is called

**Key behavior:**
- **Builder-managed params** (`on_finish`, `on_data_update`, `on_trial_start`): user code is appended to builder-generated code. Right panel shows the full merged output. Tab header shows "bld" badge.
- **Value params** (display_element, experiment_width, etc.): user value replaces or augments the key in `initJsPsych({})`.
- **Split view**: left = editable user code, right = readonly preview of complete generated code block.
- **Local/Public variants**: L/P toggle for each param, stored separately.
- **Persistence**: auto-saves via `DevModeProvider` → `POST /api/save-config`.

### CodeEditorModal.tsx

Reusable modal component with Monaco Editor, used by trial code injection and other editors.

**Modes:**
- **Single editor**: one read/write Monaco instance
- **Multi-tab**: VS Code-style tab strip with per-tab editors
- **Split view**: left = editable user code, right = readonly computed preview (for builder-managed params)

**Features:**
- Debounced onChange (1 second) to avoid spamming saves
- Light/dark theme follows OS preference
- Escape key closes modal
- Read-only mode for preview panes
- `ModalTabDef` interface supports: `splitView`, `computeRightPanel`, `isBuilderManaged`, `hint`

### monacoJsPsychContext.ts

Provides TypeScript ambient declarations to Monaco for all code editors in the builder. This gives users autocomplete and type-checking when writing custom code.

**What it declares:**
- `jsPsych` global with full API surface (run, data, finishTrial, pluginAPI, etc.)
- All ~50 jsPsych plugins as globals (jsPsychHtmlKeyboardResponse, jsPsychSurvey, etc.)
- `DynamicPlugin` for the custom plugin
- `data` callback param type (rt, response, trial_index, builder_id, branches, etc.)
- `trial` callback param type (type, data, prev_response)
- Local config scope: `pendingDataSaves`, `trialSessionId`, `socket`
- Public config scope: `sessionRef`, `BATCH_CONFIG`, `TrialDB`, `firebase`, recruitment params
- Builder window globals: `nextTrialId`, `skipRemaining`, `branchingActive`, `JSPSYCH_SESSION_ID`, etc.
- Helper functions: `_showLoading()`, `_hideLoading()`, `_generateSessionName()`, `evaluateCondition()`, etc.

**Custom plugin integration:**
```typescript
// updateCustomPluginContext() dynamically adds declarations for user plugins:
declare const jsPsychMyCustomPlugin: any;
```

### TrialCodeInjection/index.tsx

The "Code Component" button on each trial's config panel. Opens `CodeEditorModal` with 4 tabs:

| Tab | Hook | Builder-managed? | Split view? |
|-----|------|-----------------|-------------|
| `initialize` | async setup before trial | No | No |
| `on_start` | params override + user code | Yes | Yes |
| `on_load` | DOM ready callback | No | No |
| `on_finish` | branching/jump + user code | Yes | Yes |

**Builder-managed tabs** show the full generated code block in the right panel so users see exactly what gets injected.

### PluginEditor.tsx

Monaco Editor for custom user plugins. Edits the full plugin JS source code. Auto-saves to `POST /api/save-plugin/:index`. See [04-PLUGINS.md](04-PLUGINS.md) for details.

---

## Layer 2: Trial Code Generators

### TrialCodeGenerators/ (10 files)

Pure functions that generate JavaScript code strings for trial lifecycle hooks. Located at `TrialCode/TrialCodeGenerators/`.

| File | Output | Triggered by |
|------|--------|-------------|
| `onStartGenerator.ts` | `on_start: function(trial) { ... }` | paramsOverride conditions |
| `onFinishGenerator.ts` | `on_finish: function(data) { ... }` | branchConditions + repeatConditions |
| `initializeGenerator.ts` | `initialize: async function() { ... }` | customInitialize user code |
| `onLoadGenerator.ts` | `on_load: function() { ... }` | customOnLoad user code |
| `paramsOverrideGenerator.ts` | Param override logic inside on_start | paramsOverride conditions |
| `branchConditionsGenerator.ts` | Branch condition evaluation | branchConditions rules |
| `repeatConditionsGenerator.ts` | Jump/repeat condition evaluation | repeatConditions rules |
| `branchCustomParamsGenerator.ts` | Custom param injection for branch targets | branchConditions.customParameters |
| `conditionalFunctionGenerator.ts` | `conditional_function` for conditional loops | loopConditions rules |

### useTrialCode.ts

The main orchestrator for per-trial code generation. Combines:
1. **MappedJson.ts** — resolves `columnMapping` → actual values (CSV or typed), producing the `mappedJson` array used as `timeline_variables`
2. **TrialCodeGenerators** — lifecycle hook code
3. **Plugin parameters** — assembled into the trial config object
4. **Extension code** — generated via `generateExtensionCode()`

Returns `{ genTrialCode(), mappedJson }`.

---

## Layer 3: Loop Code Generation

### useLoopCode/index.ts

Generates the complete jsPsych loop timeline. See [05-TRIALS_AND_LOOPS.md](05-TRIALS_AND_LOOPS.md) for the loop data model and configuration. The generated structure produces:

### BranchingLogicCode.ts

Generates the loop's internal branching infrastructure:
- Loop-scoped flags: `loop_xxx_NextTrialId`, `loop_xxx_SkipRemaining`, `loop_xxx_BranchingActive`, etc.
- Per-item wrappers with `conditional_function` that check flags
- Nested loop support: delegates branching to parent loop via `loop_{parent}_NextTrialId`
- Conditional loop support: `loop_function` that evaluates `loopConditions` against trial data
- `on_timeline_start`: resets flags for each iteration
- `on_timeline_finish`: handles branch propagation to parent or root timeline

### BranchesCode.ts

Generates the loop-level `on_finish` handler:
- **With repeat conditions**: evaluates `repeatConditions` against loop data, on match sets `jsPsych_jumpToTrial` in localStorage and restarts timeline
- **With branches**: evaluates `branchConditions`, activates `window.nextTrialId` / `window.skipRemaining`
- **Terminal loop** (no branches/repeats): calls `jsPsych.abortExperiment()` if branching was active
- Rule evaluation logic: handles numeric comparison, string equality, array includes, dynamic plugin column names

---

## Layer 4: Specialized Generators

### generateExtensionCode.ts

Generates jsPsych extension configurations for mouse-tracking, webgazer, and record-video:

```javascript
// Extension output format:
extensions: [{
  type: jsPsychExtensionWebgazer,
  params: { targets: ["#jspsych-html-keyboard-response-stimulus"] }
}]
```

- **Mouse tracking**: targets `#target` (generic)
- **WebGazer**: finds `stimulus`/`stimuli` parameter from trial params, converts to CSS selector
- **DynamicPlugin**: skips target detection (DynamicPlugin stores coordinates in trial data directly)
- **Record video**: no targets needed

### generatePhaseCode.ts (WebGazer)

Generates the 4-phase WebGazer trial code (initCamera, calibrate, validate, recalibrate):

```
Phase 1: initCamera → procedure with instructions
Phase 2: calibrate → procedure with calibration points
Phase 3: validate → procedure with validation
Phase 4: recalibrate → conditional loop:
  if validate.percent_in_roi < minimum_percent:
    repeat calibrate + validate
  else:
    calibration_done trial with branching on_finish
```

Each phase generates its own `timeline_variables`, `timeline` object, and procedure. The recalibrate phase wraps calibrate+validate in a `conditional_function`.

---

## Layer 5: Experiment Compilation

### generateTrialLoopCodes.ts

Entry point called from `ExperimentBase`. Iterates the timeline and calls `generateTrialCode()` / `generateLoopCode()` for each item. Returns all code as `string[]`.

### ExperimentCode/ (Timeline/ExperimentCode/)

| File | Purpose |
|------|---------|
| `ExperimentBase.ts` | Wraps all codes with preload + fullscreen → `jsPsych.run(timeline)` |
| `LocalConfiguration.ts` | Local experiment: session via Express, Socket.IO, no CAPTCHA |
| `PublicConfiguration.ts` | Published experiment: Firebase, IndexedDB batching, CAPTCHA, recruitment |
| `CaptchaCode.ts` | Injects `_showCaptchaGate()` function (hCaptcha/reCAPTCHA) |
| `ResumeCode.ts` | Injects `_resolveResumeBranch()` for session resume logic |
| `LoadingOverlay.ts` | Loading screen UI during session setup |
| `useExperimentCode.ts` | Orchestrator: calls Local/PublicConfiguration and provides to Timeline UI |
| `getInitJsPsychPreview.ts` | Preview generators for GlobalCustomCode right panel |

---

## Execution Order in Final Generated Code

```
1. Window globals set (JSPSYCH_FILE_UPLOAD_ENDPOINT, JSPSYCH_SESSION_ID)
2. IndexedDB wrapper (public only)
3. System metadata collection  
4. Session name config baked in
5. Firebase SDK load (public only) / Socket.IO load (local only)
6. Loading overlay shown
7. CAPTCHA gate (public only)
8. Resume check (localStorage)
9. Session creation → participantNumber assigned
10. Session name resolution (counter tokens → rename)
11. customPreInitCode injected ← user code
12. jsPsych.initJsPsych({...customInitJsPsychParams...})  ← user params
13. Preload trial (if media files exist)
14. Fullscreen trial (if enabled)
15. All trial/loop timeline codes  ← from generateAllCodes()
16. jsPsych.run(timeline)
17. on_finish: complete session, recruitment redirect
```
