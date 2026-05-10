# 08 - Experiment Execution & Publishing

## Code Generation

### When Code is Generated

Code is generated **dynamically at execution time**, not stored in the database (except WebGazer). This happens in two contexts:

1. **Run Experiment**: Local execution on `http://localhost:3000/{experimentName}`
2. **Run Demo/Preview**: Preview a single trial at `http://localhost:3000/{experimentID}/preview`
3. **Publish**: Generate public CDN-compatible code for GitHub Pages

### Generation Pipeline

```
Timeline (ordered Trial/Loop IDs)
  ↓
LoopTimelineCode: Wraps loops in jsPsych timeline structure
  ↓
TrialCode: Generates individual trial configurations
  ↓
ExperimentBase: Assembles timeline + extensions + preload + fullscreen
  ↓
Client sends to server: POST /api/run-experiment or /api/trials-preview
  ↓
Server: Injects code into HTML template via cheerio
  ↓
HTML file served at /experimentName or /experimentID/preview
```

### Trial Code Structure

```javascript
{
  type: jsPsychHtmlKeyboardResponse,  // from plugin registry
  timeline: [{                         // single trial or array for CSV
    stimulus: '<p>Hello</p>',
    trial_duration: 2000,
    data: { trial_name: 'Trial 1' },
    on_start: function(trial) { /* paramsOverride logic */ },
    on_finish: function(data) { /* branching/jump logic */ }
  }],
  timeline_variables: csvData,        // if CSV is attached
  randomize_order: true,              // from loop config
  repetitions: 3,                     // from loop config
  conditional_function: function() {  // loop conditions
    /* return true to repeat */
  }
}
```

### Loop Code Generation

Loops generate jsPsych timeline arrays:
- `timeline_variables`: Array of CSV row objects
- `sample`: Uses `jsPsych.randomization.sampleWithReplacement` or `repeat`
- `randomize_order`: From loop's `randomize` config
- `repetitions`: From loop's `repetitions` config
- `conditional_function`: Checks loop conditions against trial data

### Orders Implementation

When orders are configured:
```javascript
if (trial.orders) {
  trialData['stimuliOrders'] = JSON.parse(trialColumnMapping.stimuliOrders.value);
}
// In generated code:
var order = jsPsych.randomization.shuffle(stimuliOrders);
```

### Categories Implementation
```javascript
if (trial.categories) {
  trialData['categoryColumn'] = trialColumnMapping.trialCategory.value;
}
```

---

## Local Execution (`Run Experiment`)

1. Frontend generates complete experiment code
2. `POST /api/run-experiment/:experimentID` with `{ generatedCode, canvasStyles }`
3. Server:
   - Reads experiment name from DB
   - Resolves canvasStyles (body → DB fallback → experiment appearance settings)
   - Copies fresh `experiment_template.html` to `experiments_html/{name}.html`
   - Injects generated code as `<script id="generated-script">`
   - Injects canvas background color
   - Returns `{ experimentUrl: "http://localhost:3000/{name}" }`
4. Opens in in-app browser or system browser

### Experiment HTML Template
```html
<html>
<head>
  <!-- jsPsych CSS -->
  <!-- jsPsych core script -->
  <!-- All plugin scripts (CDN or local) -->
  <!-- Custom plugin scripts -->
  <!-- webgazer.js if needed -->
</head>
<body>
  <!-- Generated experiment script injected here -->
</body>
</html>
```

---

## Trial Preview (`Run Demo`)

Similar to full experiment but for a single trial:
1. Frontend generates single-trial code
2. `POST /api/trials-preview/:experimentID` with `{ generatedCode }`
3. Server uses `trials_preview_template.html`
4. Served at `/experimentID/preview`

---

## Publishing (`Publish`)

### Overview
Publishes the experiment to GitHub Pages via Firebase Cloud Functions.

### Steps (Server-side)

1. **Validate**: Requires `uid` and `generatedPublicCode`
2. **Read experiment HTML**: Uses existing compiled HTML or falls back to template
3. **Replace scripts**: Swaps local jsPsych bundle for CDN versions:
   ```html
   <!-- Removed: jspsych-bundle.js, webgazer.js, dynamicplugin.js -->
   <!-- Added: -->
   <script src="https://unpkg.com/jspsych@8.2.2"></script>
   <script src="https://unpkg.com/jspsych-expbuilder-plugin-dynamic@1.0.2/dist/index.iife.js"></script>
   ```
4. **Inject used plugins**: Only plugins actually used by the experiment's trials
5. **Inject preload**: If experiment has uploaded media files
6. **Inject fullscreen**: If fullScreen mode is enabled
7. **Convert media**: All uploaded images/videos/audio → base64
8. **Replace generated code**: Swap local generated code with public code
9. **Send to Firebase**:
   ```json
   POST {FIREBASE_URL}/publishExperiment
   {
     uid, repoName, htmlContent, description, isPrivate: false,
     mediaFiles: [{ type, filename, content: base64 }],
     experimentID, storageProvider
   }
   ```
10. Firebase creates/updates GitHub repo with `index.html` + media files
11. Returns `{ repoUrl, pagesUrl }`
12. Server saves `pagesUrl` to experiment document

### Public Code Generation
The frontend generates special "public" code that:
- Uses CDN plugin references instead of local imports
- Has base64-encoded media instead of local file references
- References dynamic plugin from CDN instead of local server

---

## Development vs Production Modes

### DevMode (`isDevMode: true`)
- Experiments show developer toolbar
- Trial boundaries are visible
- Console logging is enabled
- Running experiments are tracked in `configs[]`

### SaveMode (`isSaveMode: false`)
- Results are NOT saved to the database
- Useful for testing without generating data
- Participant number still increments

### Toggle
Both are configurable via the UI (stored in `configs.isDevMode` and `configs.isSaveMode`)

---

## Appearance Settings

Stored per-experiment in `experiment.appearanceSettings`:
- `backgroundColor`: CSS hex color for experiment background
- `fullScreen`: Whether the experiment fills the viewport
- `progressBar`: Whether to show a progress bar

Applied during compilation:
- Background color injected as CSS
- FullScreen mode adds `plugin-fullscreen` trial to timeline start
- Progress bar is handled by jsPsych timeline configuration

---

## Session Name Configuration

Customizable session naming for local experiments:
- Tokens: `{ type: "text" | "participantId" | "counter" | "custom", value: string }`
- Separator: string (default `_`)
- Example: `[participantId, text("session"), counter(1)]` with separator `_` → `P1_session_1`

Session names with `participantId` or `counter` tokens are resolved after the session is first created:
1. Create session with temporary ID
2. Resolve participant number and counter
3. `PATCH /api/rename-session/:experimentID` to update session ID
