export const DOC_SECTIONS = [
  // ═══════════════════════════════════════════════════════
  // 1. ANATOMY OF THE GENERATED HTML
  // ═══════════════════════════════════════════════════════
  {
    id: "anatomy",
    title: "Anatomy of the Generated HTML",
    content: `# Anatomy of the Generated HTML

The generated experiment is a self-contained \`index.html\` file. It has 4 layers that execute in order:

\`\`\`mermaid
flowchart TD
    A["1. TEMPLATE HTML"] --> B["2. SESSION INITIALIZATION"]
    B --> C["3. initJsPsych()"]
    C --> D["4. TIMELINE"]
    D --> E["jsPsych.run(timeline)"]

    A1["&lt;head&gt;: jsPsych scripts + plugins"] -.- A
    A2["&lt;body&gt;: DOM overlays"] -.- A
    A3["&lt;script id='generated-script'&gt;"] -.- A

    B1["sessionId · participantNumber"] -.- B
    B2["Socket.IO / Firebase setup"] -.- B
    B3["loadingOverlay · resumeCode"] -.- B
    B4["CAPTCHA gate · Recruit platforms"] -.- B

    C1["on_data_update → persistence"] -.- C
    C2["on_finish → cleanup + redirect"] -.- C
    C3["extensions · custom code"] -.- C

    D1["preload trial → fullscreen trial"] -.- D
    D2["procedures (trials + conditional_functions)"] -.- D
    D3["loops (repetitions, nested)"] -.- D
\`\`\`

## Source Templates

| Template | Usage |
|---|---|
| \`experiment_template.html\` | Local bundle (Express/Electron) |
| \`experiment_template_unkpg.html\` | unpkg CDN (published to GitHub Pages) |
| \`trials_preview_template.html\` | Individual trial preview in Builder |

## Local vs Published Differences

| Aspect | Local (Express) | Published (GitHub Pages) |
|---|---|---|
| jsPsych bundle | \`/bundle/jspsych-bundle.js\` (local file) | unpkg CDN (only used plugins) |
| DynamicPlugin | \`../dynamicplugin/dist/index.iife.js\` | unpkg CDN |
| Socket.IO | Loaded from \`/socket.io/socket.io.js\` | Not included |
| Firebase SDK | Not included | Loaded dynamically from CDN |
| Persistence | PUT \`/api/append-result/:id\` | Firebase Realtime DB + IndexedDB |
| CAPTCHA | Not included | hCaptcha / reCAPTCHA |
| Recruitment | Not included | Prolific, MTurk |
| Media files | Served by Express | Base64 baked-in in the HTML |
`,
  },

  // ═══════════════════════════════════════════════════════
  // 2. SESSION SYSTEM — LOCAL
  // ═══════════════════════════════════════════════════════
  {
    id: "session-local",
    title: "Session — Local Mode",
    content: `# Session — Local Mode

Generated from \`ExperimentCode/LocalConfiguration.ts\`.

## Session Name (dynamic tokens)

The \`sessionId\` can be a random UUID or a structured name configurable in **Builder → Settings → Session Name**.

| Token | Description | Formats / Options |
|---|---|---|
| \`date\` | Current date | \`YYYYMMDD\`, \`DD-MM-YYYY\`, \`MM-DD-YYYY\`, \`YYYY-MM-DD\` |
| \`time\` | Current time | \`HHmmss\`, \`HH-mm\`, \`HH-mm-ss\` |
| \`randomAlpha\` | Random alphanumeric | Configurable length (default: 6) |
| \`customText\` | Fixed text defined by the researcher | Any string |
| \`counter\` | Auto-incremental participant number | Configurable padding (e.g. \`003\`) |

\`\`\`js
// Generated in the HTML:
const _SESSION_NAME_TOKENS = [
  { type: "date", dateFormat: "YYYYMMDD" },
  { type: "counter", counterDigits: 3 }
];
const _SESSION_NAME_SEPARATOR = "_";

function _generateSessionName(participantNumber) {
  // "date" → current date formatted
  // "counter" → participantNumber with 3-digit padding
  // Result: "20260506_003"
}
\`\`\`

If no token guarantees uniqueness (\`randomAlpha\` or \`counter\`), a random 6-character suffix is automatically added to avoid collisions.

## Session Start Flow

\`\`\`mermaid
sequenceDiagram
    participant P as Browser
    participant LS as localStorage
    participant API as Express API
    participant S as Socket.IO

    P->>LS: read jsPsych_currentSessionId
    alt sessionId exists
        Note over P: isResuming = true
    else does not exist
        P->>P: generate sessionId (UUID or session name)
    end

    P->>P: window.JSPSYCH_SESSION_ID = sessionId
    P->>API: POST /api/append-result/:id (create session)
    API-->>P: { participantNumber }
    Note over P: If counter token: rename session

    P->>S: load /socket.io/socket.io.js
    P->>S: emit "join-experiment"
    Note over P: _hideLoading() → experiment starts
\`\`\`

## Socket.IO

The Socket.IO script is loaded dynamically with polling until available:

\`\`\`js
const socketScript = document.createElement('script');
socketScript.src = '/socket.io/socket.io.js';
socketScript.onload = () => { window._socketReady = true; };
document.head.appendChild(socketScript);

function waitForSocket() {
  return new Promise(resolve => {
    const interval = setInterval(() => {
      if (window._socketReady && typeof io !== 'undefined') {
        clearInterval(interval);
        resolve();
      }
    }, 50);
  });
}

// On connection, the session event is emitted:
const socket = io();
socket.emit('join-experiment', {
  experimentID,
  sessionId: trialSessionId,
  state: isResuming ? 'resumed' : 'initiated',
  metadata, // { browser, os, screenWidth, ... }
});
\`\`\`

Socket.IO is used for real-time tracking from the Builder Dashboard (view connected participants, progress, etc.). **It is not used for data persistence.**

## Data Persistence (local)

Each trial is saved via \`PUT\`:

\`\`\`js
const pendingDataSaves = []; // tracks in-flight fetches

on_data_update: function(data) {
  const savePromise = fetch("/api/append-result/" + experimentID, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: trialSessionId, response: data }),
  }).finally(() => {
    const i = pendingDataSaves.indexOf(savePromise);
    if (i > -1) pendingDataSaves.splice(i, 1);
  });
  pendingDataSaves.push(savePromise);
}
\`\`\`

When the experiment finishes, it waits for all \`pendingDataSaves\` to complete before marking the session as finished:

\`\`\`js
on_finish: async function() {
  _showLoading('Saving your data…');
  await Promise.all(pendingDataSaves);
  await fetch("/api/complete-session/" + experimentID, { method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: trialSessionId }),
  });
  _showSuccess();
}
\`\`\`

## System Metadata

Automatically collected at the start of each session:

\`\`\`js
const metadata = getMetadata();
// {
//   browser: "Chrome", browserVersion: "125.0",
//   os: "Windows", screenWidth: 1920, screenHeight: 1080,
//   screenResolution: "1920x1080", viewportWidth: 1536,
//   viewportHeight: 792, language: "en-US",
//   userAgent: "Mozilla/5.0 ...", startedAt: 1715030400000
// }
\`\`\`

## File Upload

\`\`\`js
window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '/api/participant-files/' + experimentID;
\`\`\`

The DynamicPlugin's \`FileUploadResponseComponent\` automatically uses this endpoint for participants to upload files during the experiment.
`,
  },

  // ═══════════════════════════════════════════════════════
  // 3. SESSION SYSTEM — PUBLISHED
  // ═══════════════════════════════════════════════════════
  {
    id: "session-public",
    title: "Session — Published Mode",
    content: `# Session — Published Mode

Generated from \`ExperimentCode/PublicConfiguration.ts\`. Completely self-contained: no Express server required.

## Firebase Realtime Database

The Firebase SDK is loaded dynamically from CDN:

\`\`\`js
// Sequential loading: first app-compat, then database-compat
function waitForFirebase() {
  return new Promise(resolve => {
    const check = setInterval(() => {
      if (typeof firebase !== 'undefined' && firebase.database) {
        clearInterval(check); resolve();
      }
    }, 50);
  });
}

const firebaseConfig = { /* baked-in credentials */ };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
\`\`\`

### Session Node Structure in Firebase

\`\`\`text
/experiments/:experimentID/sessions/:sessionId
  ├── state:          "pending" | "in-progress" | "completed"
  ├── connected:      true | false
  ├── participantNumber: 42
  ├── startedAt:      ServerValue.TIMESTAMP
  ├── finishedAt:     ServerValue.TIMESTAMP
  ├── lastUpdate:     ServerValue.TIMESTAMP
  └── recruitment:    { platform, pid, studyId, ... }
\`\`\`

### onDisconnect Cleanup

If the participant closes the browser unexpectedly, Firebase detects the disconnection and updates the state:

\`\`\`js
const sessionRef = db.ref("experiments/" + experimentID + "/sessions/" + sessionId);
sessionRef.onDisconnect().update({ connected: false, state: 'disconnected' });
\`\`\`

## IndexedDB — TrialDB

Wrapper for buffering trials before sending them in batch. Minimizes HTTP requests and handles connection loss.

\`\`\`js
const TrialDB = {
  dbName: 'jsPsychTrialsDB',
  storeName: 'trials',
  ttl: 3 * 24 * 60 * 60 * 1000, // 3 days

  init()            // Creates/opens DB with indexes: sessionId, timestamp, createdAt
  add(trial)        // Inserts a trial with timestamp + sessionId
  getAll()          // All pending trials
  getN(n)           // First N trials (for batch sending)
  count()           // Total trials in buffer
  deleteN(n)        // Deletes first N (after successful send)
  clear()           // Empties the entire store
  cleanExpiredData() // Deletes trials with TTL > 3 days
};
\`\`\`

### Batching Configuration

Obtained from Firestore at experiment start:

\`\`\`js
const BATCH_CONFIG = {
  useIndexedDB: true,  // false → trial-by-trial directly to Firebase
  size: 10,            // send batch every N trials. 0 → all together at the end
  currentBatchNumber: 0,
};
\`\`\`

### Data Flow in on_data_update

\`\`\`mermaid
flowchart TD
    A["Trial completed"] --> B["Add clientTimestamp, sessionId, experimentID"]
    B --> C{"BATCH_CONFIG.useIndexedDB?"}

    C -->|true| D["TrialDB.add(data)"]
    D --> E{"count >= BATCH_CONFIG.size?"}
    E -->|yes| F["getN(size) → sendBatchConcatenated()"]
    F --> G["deleteN(size)"]
    E -->|no| H["Wait for next trial"]

    C -->|false| I["fetch POST directly to Firebase"]
    I --> J["sessionRef.update({ lastUpdate })"]
\`\`\`

### sendBatchConcatenated vs sendCompleteExperiment

| Function | When used | How it sends |
|---|---|---|
| \`sendBatchConcatenated\` | \`BATCH_CONFIG.size > 0\` | Concatenates trials with \`\\n\`, single POST |
| \`sendCompleteExperiment\` | \`BATCH_CONFIG.size === 0\` (on_finish) | All trials together at the end |

## CAPTCHA Gate (published only)

\`\`\`js
// Supports hCaptcha and reCAPTCHA v2
const token = await _showCaptchaGate(siteKey, 'hcaptcha');
// → full-screen overlay "Please verify you are human"
// → dynamic script loading (js.hcaptcha.com or google.com/recaptcha)
// → experiment does not start until CAPTCHA is resolved
// → skipped on jump reloads (resume)
\`\`\`

## Recruitment (published only)

At the end of the experiment, if a recruitment platform is detected, automatic redirection occurs:

\`\`\`js
// Prolific: query string → ?PROLIFIC_PID=...&STUDY_ID=...&SESSION_ID=...
if (PROLIFIC_PID) {
  window.location.href = "https://app.prolific.com/submissions/complete?cc=XXXX";
}

// MTurk: query string → ?workerId=...&assignmentId=...&hitId=...
if (assignmentId && assignmentId !== 'ASSIGNMENT_ID_NOT_AVAILABLE') {
  document.getElementById('mturk-form').submit();
}

// MTurk preview mode: assignmentId === 'ASSIGNMENT_ID_NOT_AVAILABLE'
// → experiment does not start (blocked at startup)

// No platform → _showSuccess()
\`\`\`
`,
  },

  // ═══════════════════════════════════════════════════════
  // 4. OVERLAYS
  // ═══════════════════════════════════════════════════════
  {
    id: "overlays",
    title: "Overlays (Loading / Success)",
    content: `# Overlays

The generated experiment includes a DOM overlay system (not canvas) for visual communication with the participant.

## Overlay API

| Function | Purpose |
|---|---|
| \`_showLoading(msg)\` | Full-screen overlay with spinner + message. Blocks interaction. |
| \`_setLoadingMsg(msg)\` | Updates the text without re-creating the DOM. |
| \`_hideLoading()\` | Removes the overlay immediately. |
| \`_showSuccess()\` | Animated green checkmark + "Experiment complete. Thank you!" |

## Behavior

- The overlay is created as a fixed \`<div>\` covering the entire viewport, with maximum \`z-index\`.
- The overlay background color and success message match the **Canvas Styles** configured in the Trial Designer.
- The spinner is a pure CSS animation (no external libraries).
- The success checkmark is an inline SVG with \`stroke-dasharray\` animation.

## Typical Sequence in on_finish

\`\`\`js
on_finish: async function() {
  // 1. Show loading while saving data
  _showLoading('Saving your data…');
  await new Promise(r => setTimeout(r, 0)); // yield to event loop

  // 2. Flush pending data
  await Promise.all(pendingDataSaves);

  // 3. Update message
  _setLoadingMsg('Finishing up…');

  // 4. Complete session
  await fetch("/api/complete-session/" + experimentID, { method: "POST" });

  // 5. Show success
  _showSuccess();
}
\`\`\`

## Availability in Custom Code

All overlay functions are available in the global scope. They can be used in:

- \`on_start\` / \`on_finish\` of any trial
- Global Custom Code
- Custom initJsPsych override

\`\`\`js
// Example: show loading while loading a heavy resource
on_start: function(trial) {
  _showLoading('Loading stimuli…');
  // preload something...
  _hideLoading();
}
\`\`\`
`,
  },

  // ═══════════════════════════════════════════════════════
  // 5. TIMELINE — STRUCTURE
  // ═══════════════════════════════════════════════════════
  {
    id: "timeline",
    title: "Timeline — Structure",
    content: `# Timeline — Structure

The timeline is built in \`generateTrialLoopCodes.ts\` and assembled at the end of the generated script.

## Timeline Push Order

\`\`\`mermaid
flowchart LR
    A["timeline = []"] --> B["1. Preload trial"]
    B --> C["2. Fullscreen trial"]
    C --> D["3. Trials / Loops"]
    D --> E["jsPsych.run(timeline)"]

    B1["jsPsychPreload with all uploaded files"] -.- B
    C1["jsPsychFullscreen · fullscreen_mode: true"] -.- C
    D1["Procedures, loops, nested loops"] -.- D
\`\`\`

\`\`\`js
const timeline = [];

// 1. Preload (only if files were uploaded from the Timeline panel)
if (uploadedFiles.length > 0) {
  const preload_trial = {
    type: jsPsychPreload,
    auto_preload: false,
    images: allImageUrls,
    video: allVideoUrls,
    audio: allAudioUrls,
  };
  timeline.push(preload_trial);
}

// 2. Fullscreen (configurable in Canvas Styles)
const fullscreen_trial = {
  type: jsPsychFullscreen,
  fullscreen_mode: true,
};
timeline.push(fullscreen_trial);

// 3. Dynamically generated trials and loops
// ... (trial/loop code inserted here) ...

// 4. Run
jsPsych.run(timeline);
\`\`\`

## Why "procedure"?

In jsPsych, standalone trials inside a loop must be wrapped in a \`procedure\` object (or nested \`timeline\`). The Builder always wraps each trial in a procedure to:

1. **Support \`conditional_function\`** — skip/branch/jump mechanism between trials
2. **Support \`timeline_variables\`** — CSV data that parameterizes the trial
3. **Uniformity** — same format for trials inside and outside loops

## Structure of a Trial (procedure)

\`\`\`js
// Individual trial definition
const myTrial_timeline = {
  type: jsPsychHtmlKeyboardResponse,

  // Plugin parameters (with timeline variables if CSV is present)
  stimulus: jsPsych.timelineVariable('stimulus'),
  prompt: jsPsych.timelineVariable('prompt'),

  // Metadata injected by the Builder
  data: {
    trial_id: 123,              // Numeric ID (DB)
    builder_id: "uuid-v4",      // Stable UUID for resume and branching
    trial_name: "Encoding Task",
    isInLoop: false,
    branches: [],               // Target trial IDs for branching
    branchConditions: [],       // Active branch conditions on this trial
  },

  // Callbacks (generated if applicable)
  on_start: function(trial) { /* params override + branch custom params */ },
  on_finish: function(data)  { /* repeat/jump + branch conditions */ },
};

// Procedure wrapper
const myTrial_procedure = {
  timeline: [myTrial_timeline],
  timeline_variables: test_stimuli_myTrial, // CSV object array
  randomize_order: false,
  conditional_function: function() {
    // Skip/jump/branch logic (see Branching System)
  },
};

timeline.push(myTrial_procedure);
\`\`\`

## Structure of a Loop

\`\`\`js
// Unified variables from all trials inside the loop
const loop_abc123_stimuli = [
  { trialA_stimulus: "img1.png", trialB_word: "hello" },
  { trialA_stimulus: "img2.png", trialB_word: "world" },
];

// Individual trials inside the loop (each with its conditional_function)
const trialA_timeline = { type: ..., data: { isInLoop: true, ... } };
const trialA_proc = {
  timeline: [trialA_timeline],
  conditional_function: function() { /* skip with loop vars */ }
};

// Main loop
const loop_abc123 = {
  timeline: [trialA_proc, trialB_proc],
  timeline_variables: loop_abc123_stimuli,
  randomize_order: false,
  repetitions: 3,

  // If conditional loop:
  loop_function: function(data) {
    // Evaluates loopConditions → true = repeat, false = exit
  },

  // Initialize and cleanup branching variables per iteration
  on_timeline_start: function() {
    window.loop_abc123_NextTrialId = null;
    window.loop_abc123_SkipRemaining = false;
  },
  on_timeline_finish: function() {
    // Sync loop state to global scope if branching is active
  },
};

const loop_abc123_procedure = {
  timeline: [loop_abc123],
  conditional_function: function() { /* skip entire loop */ }
};

timeline.push(loop_abc123_procedure);
\`\`\`

## Branching Variables with Loop Scope

Each loop declares its own variables with a prefix to avoid collisions with the global scope and other nested loops:

| Variable | Scope | Purpose |
|---|---|---|
| \`window.loop_ID_NextTrialId\` | Inside loop ID | Branch target trial |
| \`window.loop_ID_SkipRemaining\` | Inside loop ID | Active skip flag |
| \`window.loop_ID_BranchingActive\` | Inside loop ID | Indicates ongoing branch |
| \`window.loop_ID_BranchCustomParameters\` | Inside loop ID | Active branch params |

Where \`ID\` is the loop's UUID in the database.
`,
  },

  // ═══════════════════════════════════════════════════════
  // 6. DYNAMIC PLUGIN
  // ═══════════════════════════════════════════════════════
  {
    id: "dynamic-plugin",
    title: "Dynamic Plugin",
    content: `# Dynamic Plugin

Custom plugin that renders visual trials created in the **Trial Designer**. Replaces the standard plugin when the trial has components positioned on a canvas (images, buttons, text, etc.).

Source code: \`server/dynamicplugin/index.ts\`. Runs as a jsPsych plugin (\`type: DynamicPlugin\`).

## Stimulus Components (6)

Stimulus components are rendered but do not capture the participant's response.

### TextComponent

Static text with full styling.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`text\` | string | \`""\` | Text content (supports basic HTML) |
| \`font_size\` | number | \`16\` | Size in px (relative to canvas) |
| \`font_color\` | string | \`"#000000"\` | Text color (hex, rgb, name) |
| \`font_family\` | string | \`"Arial"\` | Font family |
| \`font_style\` | string | \`"normal"\` | \`normal\`, \`italic\`, \`oblique\` |
| \`font_weight\` | string | \`"normal"\` | \`normal\`, \`bold\`, \`100\`–\`900\` |
| \`text_align\` | string | \`"left"\` | \`left\`, \`center\`, \`right\`, \`justify\` |
| \`text_decoration\` | string | \`"none"\` | \`none\`, \`underline\`, \`line-through\` |
| \`line_height\` | number | \`1.2\` | Line height (multiplier) |
| \`letter_spacing\` | number | \`0\` | Letter spacing (px) |
| \`cloze_mode\` | boolean | \`false\` | Cloze mode: \`%%\` become inline inputs |
| \`cloze_case_sensitive\` | boolean | \`true\` | Case sensitive in cloze correction |
| \`cloze_answer\` | string | \`""\` | Correct answer for cloze mode |

**Cloze mode**: Occurrences of \`%%\` in text are replaced by inline \`<input>\` elements. The participant types inside the inputs.

### ImageComponent

Static image.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`stimulus\` | string | \`""\` | Image URL or path |
| \`width\` | number | \`auto\` | Width in vw% (0 = auto) |
| \`height\` | number | \`auto\` | Height in vw% (0 = auto) |
| \`maintain_aspect_ratio\` | boolean | \`true\` | Preserve aspect ratio when scaling |
| \`object_fit\` | string | \`"contain"\` | \`contain\`, \`cover\`, \`fill\`, \`none\` |

### AudioComponent

Audio with onset/duration control.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`stimulus\` | string | \`""\` | Audio file URL |
| \`show_controls\` | boolean | \`false\` | Show native browser controls |
| \`autoplay\` | boolean | \`true\` | Play automatically |
| \`loop\` | boolean | \`false\` | Repeat in loop |
| \`volume\` | number | \`1.0\` | Volume (0.0 to 1.0) |

### VideoComponent

Video with optional controls.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`stimulus\` | string \| string[] | \`""\` | Video URL(s) (array for multiple sources) |
| \`width\` | number | \`auto\` | Width in vw% (0 = auto) |
| \`height\` | number | \`auto\` | Height in vw% (0 = auto) |
| \`autoplay\` | boolean | \`true\` | Play automatically |
| \`controls\` | boolean | \`false\` | Show controls |
| \`loop\` | boolean | \`false\` | Repeat in loop |
| \`muted\` | boolean | \`false\` | Muted |
| \`start_time\` | number | \`0\` | Playback start (seconds) |
| \`stop_time\` | number | \`null\` | Playback end (seconds, null = full) |
| \`playback_rate\` | number | \`1.0\` | Playback speed |

### HtmlComponent

Arbitrary HTML rendered in an isolated iframe.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`html\` | string | \`""\` | HTML content (including \`<style>\` and \`<script>\`) |
| \`width\` | number | \`auto\` | Width in vw% |
| \`height\` | number | \`auto\` | Height in vw% |

### SketchpadComponent

Free-drawing canvas for the participant.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`stroke_color\` | string | \`"#000000"\` | Stroke color |
| \`stroke_width\` | number | \`4\` | Stroke width (px) |
| \`background_color\` | string | \`"#ffffff"\` | Canvas background color |
| \`show_undo\` | boolean | \`true\` | Show undo button |
| \`show_redo\` | boolean | \`true\` | Show redo button |
| \`show_clear\` | boolean | \`true\` | Show clear button |
| \`show_color_palette\` | boolean | \`true\` | Show color palette |
| \`palette_colors\` | string[] | \`[...]\` | Colors in the palette |

Generated data: \`SketchpadComponent_N_strokes\` (array of strokes) and \`SketchpadComponent_N_png\` (base64).

## Response Components (8)

Response components capture the participant's response and determine when the trial ends.

### ButtonResponseComponent

Clickable buttons with flexible layout.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`choices\` | string[] | \`[]\` | Button texts |
| \`button_html\` | string | \`""\` | HTML template (\`{{choice}}\` = button text) |
| \`button_layout\` | string | \`"flex"\` | \`flex\`, \`grid\` |
| \`columns\` | number | \`1\` | Columns in grid mode |
| \`rows\` | number | \`1\` | Rows in grid mode |
| \`button_gap\` | number | \`10\` | Space between buttons (px) |
| \`button_color\` | string | \`"#4a90d9"\` | Background color |
| \`button_text_color\` | string | \`"#ffffff"\` | Text color |
| \`button_font_size\` | number | \`16\` | Font size (px) |
| \`button_font_family\` | string | \`"Arial"\` | Font family |
| \`button_border_radius\` | number | \`5\` | Border radius (px) |
| \`button_border_color\` | string | \`"transparent"\` | Border color |
| \`button_border_width\` | number | \`0\` | Border width (px) |
| \`button_padding\` | number | \`10\` | Internal padding (px) |
| \`button_image_width\` | number | \`50\` | Image width in button with image |
| \`button_image_height\` | number | \`50\` | Image height in button with image |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Data: \`ButtonResponseComponent_N_response\` (button text), \`ButtonResponseComponent_N_rt\`.

### KeyboardResponseComponent

Captures pressed keys.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`allowed_keys\` | string[] | \`[]\` | Allowed keys (empty = all) |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Data: \`KeyboardResponseComponent_N_response\` (key), \`KeyboardResponseComponent_N_rt\`.

### SliderResponseComponent

Range-type slider with labels.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`min\` | number | \`0\` | Minimum value |
| \`max\` | number | \`100\` | Maximum value |
| \`step\` | number | \`1\` | Step |
| \`start\` | number | \`50\` | Initial value |
| \`label_left\` | string | \`""\` | Left label |
| \`label_right\` | string | \`""\` | Right label |
| \`show_value\` | boolean | \`true\` | Show numeric value |
| \`require_movement\` | boolean | \`true\` | Requires moving the slider |
| \`require_response\` | boolean | \`true\` | Requires response to advance |
| \`slider_color\` | string | \`"#4a90d9"\` | Bar color |
| \`slider_height\` | number | \`6\` | Bar height (px) |
| \`slider_width\` | number | \`300\` | Slider width (px) |
| \`slider_font_size\` | number | \`14\` | Label font size |

Data: \`SliderResponseComponent_N_response\` (number), \`SliderResponseComponent_N_rt\`.

### InputResponseComponent

Text field.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`input_label\` | string | \`""\` | Input label |
| \`input_type\` | string | \`"text"\` | \`text\`, \`number\`, \`date\`, \`time\`, \`password\` |
| \`input_placeholder\` | string | \`""\` | Placeholder |
| \`input_width\` | number | \`200\` | Input width (px) |
| \`input_font_size\` | number | \`16\` | Font size |
| \`input_font_color\` | string | \`"#000000"\` | Text color |
| \`input_border_color\` | string | \`"#cccccc"\` | Border color |
| \`input_border_radius\` | number | \`5\` | Border radius (px) |
| \`cloze_mode\` | boolean | \`false\` | Cloze mode (automatic correction) |
| \`cloze_answer\` | string | \`""\` | Correct cloze answer |
| \`cloze_case_sensitive\` | boolean | \`true\` | Case sensitive cloze |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Data: \`InputResponseComponent_N_response\` (text), \`InputResponseComponent_N_rt\`.

### ClickResponseComponent

Captures click/touch coordinates in the viewport.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`target\` | string | \`"fullscreen"\` | \`fullscreen\` or \`component_1\` (component ID) |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Data: \`ClickResponseComponent_N_response\` (array \`[x, y]\`), \`ClickResponseComponent_N_rt\`.

### AudioResponseComponent

Audio recording with microphone. Play/Pause, Done, Record Again buttons.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`max_duration\` | number | \`60000\` | Maximum recording duration (ms) |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Data: \`AudioResponseComponent_N_response\` (audio base64), \`AudioResponseComponent_N_rt\`.

### FileUploadResponseComponent

Participant file upload.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`allowed_types\` | string[] | \`[]\` | Allowed extensions (empty = all) |
| \`max_file_size\` | number | \`10\` | Maximum size in MB |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Uses \`window.JSPSYCH_FILE_UPLOAD_ENDPOINT\` as the upload destination.

Data: \`FileUploadResponseComponent_N_response\` (uploaded file URL).

### SurveyComponent

Full survey with SurveyJS. See dedicated section below.

## Positioning System

Components use normalized coordinates:

\`\`\`json
{
  "coordinates": { "x": 40, "y": 30 },
  "width": 20,
  "height": 10,
  "zIndex": 2,
  "rotation": 0
}
\`\`\`

- \`x\`, \`y\`: top-left corner position, in **vw** / **vh** (0–100)
- \`width\`, \`height\`: dimensions in **vw%** relative to the configured canvas width
- \`zIndex\`: stacking control (higher = on top)
- \`rotation\`: rotation degrees (0–360)

## Screen Layouts (responsive)

Each trial can have multiple layouts for different viewports. The DynamicPlugin detects the viewport width and applies the corresponding layout:

\`\`\`js
// Example screenLayouts saved in the configuration:
"screenLayouts": {
  "375x725":  { "x": 10, "y": 20, "width": 30, "height": 8 },
  "768x725":  { "x": 20, "y": 15, "width": 25, "height": 6 },
  "1440x763": { "x": 40, "y": 30, "width": 20, "height": 5 }
}
\`\`\`

When the participant changes devices or resizes the window, the layout adjusts automatically based on the nearest breakpoint. Layouts are created and managed from the **CanvasStylesBar** in the Trial Designer.

## stimulus_onset / stimulus_duration

Controls the temporal visibility of stimulus components:

\`\`\`js
{
  stimulus_onset: 500,      // ms from trial start when it appears
  stimulus_duration: 2000,  // ms it remains visible (null = until end of trial)
}
\`\`\`

- **Does not apply** to response components (always visible during the trial).
- If \`stimulus_duration\` is null, the component remains visible until the trial ends.
- Useful for priming, RSVP paradigms, or sequential stimulus presentation.

## Generated Data Format

### Standard DynamicPlugin
\`\`\`js
// Trial with ButtonResponseComponent (index 1) + SliderResponseComponent (index 2)
{
  trial_index: 5,
  rt: 1240,
  ButtonResponseComponent_1_response: "Option A",
  SliderResponseComponent_2_response: 65,
  trial_id: 123,
  builder_id: "uuid-abc",
}
\`\`\`

### SurveyComponent
\`\`\`js
{
  SurveyComponent_1_response: {
    question1: "Strongly agree",
    question2: "Neutral"
  }
}
\`\`\`

### SketchpadComponent
\`\`\`js
{
  SketchpadComponent_1_strokes: [{ points: [...], color: "#000", width: 4 }],
  SketchpadComponent_1_png: "data:image/png;base64,iVBORw0KG..."
}
\`\`\`

### FileUploadResponseComponent
\`\`\`js
{
  FileUploadResponseComponent_1_response: "https://storage.example.com/uploads/file.pdf"
}
\`\`\`

### AudioResponseComponent
\`\`\`js
{
  AudioResponseComponent_1_response: "data:audio/wav;base64,UklGRiQAAABXQVZF..."
}
\`\`\`
`,
  },

  // ═══════════════════════════════════════════════════════
  // 7. SURVEY COMPONENT (SURVEYJS)
  // ═══════════════════════════════════════════════════════
  {
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
  },

  // ═══════════════════════════════════════════════════════
  // 8. BRANCHING SYSTEM
  // ═══════════════════════════════════════════════════════
  {
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
  },

  // ═══════════════════════════════════════════════════════
  // 9. RESUME SYSTEM
  // ═══════════════════════════════════════════════════════
  {
    id: "resume",
    title: "Resume System",
    content: `# Resume System

Allows the participant to close the browser and resume where they left off.

## Per-Trial Persistence

On each \`on_data_update\` of a trial with \`builder_id\`:

\`\`\`js
localStorage.setItem('jsPsych_resumeTrial', JSON.stringify({
  branches: data.branches || [],
  branchConditions: data.branchConditions || [],
  trialData: data,
}));
\`\`\`

## Resolution on Reload

\`\`\`mermaid
flowchart TD
    A["Reload experiment"] --> B{"sessionId in localStorage?"}
    B -->|no| C["Start new session"]
    B -->|yes| D["isResuming = true"]
    D --> E["Read jsPsych_resumeTrial"]
    E --> F["_resolveResumeBranch()"]
    F --> G{"Branch resolved?"}
    G -->|yes: targetId| H["localStorage.setItem('jsPsych_jumpToTrial', targetId)"]
    G -->|no: null| I["Experiment already completed — start new one"]
    G -->|error| J["Corrupt data — clean reset"]
\`\`\`

## Branch Resolution

\`_resolveResumeBranch(resumeRaw)\` reconstructs the last state:

\`\`\`js
// 1. If 0 branches → experiment finished normally
// 2. If 1 branch → jump to that trial (without evaluating conditions)
// 3. If 2+ branches → evaluate branch conditions:
//    - Build column names (DynamicPlugin support)
//    - Evaluate rules with operators (==, !=, >, <, >=, <=)
//    - Arrays: includes()
//    - Survey: extract nested property
//    - No match → first branch by default
\`\`\`

## Anti-Loop Guard

Prevents a jump/reload from getting stuck in an infinite cycle:

\`\`\`js
// On startup:
const comingFromJumpReload = sessionStorage.getItem('jsPsych_jumpReload') === '1';
sessionStorage.removeItem('jsPsych_jumpReload');

if (comingFromJumpReload && existingJump) {
  // The jump was processed in the previous cycle but not consumed
  // → full reset, start new session
  localStorage.removeItem('jsPsych_jumpToTrial');
  localStorage.removeItem('jsPsych_resumeTrial');
  localStorage.removeItem('jsPsych_currentSessionId');
  localStorage.removeItem('jsPsych_participantNumber');
}
\`\`\`

## Cleanup on Finish

\`\`\`js
on_finish: async function() {
  // Clean up resume state
  localStorage.removeItem('jsPsych_resumeTrial');
  localStorage.removeItem('jsPsych_currentSessionId');
  localStorage.removeItem('jsPsych_participantNumber');
  // Do NOT clean jsPsych_jumpToTrial here (it's cleaned when consumed)
}
\`\`\`
`,
  },

  // ═══════════════════════════════════════════════════════
  // 10. CONDITIONAL LOOPS
  // ═══════════════════════════════════════════════════════
  {
    id: "conditional-loops",
    title: "Conditional Loops (While)",
    content: `# Conditional Loops (While)

A **conditional loop** repeats its content as long as a condition is met, similar to a \`while\` in programming.

Configured in **Builder → Loop → Conditional Loop Settings**.

## loop_function

The generated code includes a \`loop_function\` that jsPsych evaluates after each iteration:

\`\`\`js
loop_function: function(data) {
  // data = latest data generated in this loop iteration
  const loopConditions = [
    {
      rules: [
        { column: "ButtonResponseComponent_1_response", op: "!=", value: "Done" }
      ]
    }
  ];

  // OR between conditions, AND between rules
  for (const condition of loopConditions) {
    const allMatch = condition.rules.every(rule => {
      let propValue = data[rule.column];
      // ... same evaluation as branch conditions ...
    });
    if (allMatch) return true; // repeat the loop
  }

  return false; // exit the loop
}
\`\`\`

## Flow

\`\`\`mermaid
flowchart TD
    A["Loop start"] --> B["on_timeline_start: reset loop vars"]
    B --> C["Run iteration"]
    C --> D["loop_function(data)"]
    D -->|true| E["on_timeline_finish"]
    E --> C
    D -->|false| F["on_timeline_finish final"]
    F --> G["Continue timeline"]
\`\`\`

## Interaction with Branching Inside the Loop

Branching code inside a conditional loop uses loop-scoped variables:

\`\`\`js
// on_finish of a trial inside the conditional loop:
if (allMatch && rule.nextTrialId) {
  window.loop_LOOPID_NextTrialId = rule.nextTrialId;
  window.loop_LOOPID_SkipRemaining = true;
  window.loop_LOOPID_BranchingActive = true;
}

// on_timeline_finish of the loop:
// Syncs the loop state to the global scope so branching continues after exiting
if (window.loop_LOOPID_BranchingActive) {
  window.skipRemaining = true;
  window.nextTrialId = window.loop_LOOPID_NextTrialId;
  window.branchingActive = true;
}
\`\`\`

## Limitations

- Loop conditions only access data from the **current iteration** (not accumulated from previous iterations)
- Loop conditions are evaluated with the same operators as branching (\`==\`, \`!=\`, \`>\`, \`<\`, \`>=\`, \`<=\`)
- For accumulated data across iterations, use \`jsPsych.data.get().last(N)\` in custom code
`,
  },

  // ═══════════════════════════════════════════════════════
  // 11. NESTED LOOPS
  // ═══════════════════════════════════════════════════════
  {
    id: "nested-loops",
    title: "Nested Loops",
    content: `# Nested Loops

A loop can contain other loops, creating nested structures (e.g. trial blocks that repeat within a larger block).

## Recursive Generation

\`generateTrialLoopCodes.ts\` handles the recursion:

\`\`\`js
function generateLoopCode(loop) {
  const items = getLoopTimeline(loop.id); // trials and sub-loops

  for (const item of items) {
    if (item.type === 'trial') {
      codes.push(generateTrialCode(item, /* isInLoop: true */));
    } else if (item.type === 'loop') {
      codes.push(generateLoopCode(item)); // recursion
    }
  }

  return wrapInLoopProcedure(codes, loop);
}
\`\`\`

## CSV Merge Across Levels

When a parent loop has a CSV, the data is inherited by its children:

\`\`\`js
// If the parent loop has a CSV with columns A, B, C
// and a child trial has columns D, E:
// → timeline_variables of the loop = [{ A, B, C, trial_D, trial_E }, ...]
\`\`\`

Each trial inside the loop uses \`jsPsych.timelineVariable()\` with names prefixed by the trial name (sanitized) to avoid collisions.

## Branching Variables in Nested Loops

Each loop level has its own namespace:

\`\`\`js
// Outer loop
window.loop_OUTER_NextTrialId = ...;
window.loop_OUTER_SkipRemaining = ...;

// Inner loop (inside the outer)
window.loop_INNER_NextTrialId = ...;
window.loop_INNER_SkipRemaining = ...;
\`\`\`

## on_timeline_finish in Nesting

When an inner loop activates branching, upon finishing its iteration, \`on_timeline_finish\` propagates the state to the parent loop:

\`\`\`js
// on_timeline_finish of the inner loop:
if (window.loop_INNER_BranchingActive) {
  // Propagate to outer loop
  window.loop_OUTER_NextTrialId = window.loop_INNER_NextTrialId;
  window.loop_OUTER_SkipRemaining = true;
  window.loop_OUTER_BranchingActive = true;
}
\`\`\`
`,
  },

  // ═══════════════════════════════════════════════════════
  // 12. initJsPsych — CUSTOMIZATION
  // ═══════════════════════════════════════════════════════
  {
    id: "init-jspsych",
    title: "initJsPsych — Customization",
    content: `# initJsPsych — Customization

The \`initJsPsych\` block is generated automatically but can be partially or fully customized.

## Generated Block

\`\`\`js
// __INIT_JSPSYCH_START__
const jsPsych = initJsPsych({
  show_progress_bar: true, // if enabled in Canvas Styles

  // Configured extensions
  extensions: [
    { type: jsPsychExtensionMouseTracking },
    { type: jsPsychExtensionWebgazer },
  ],

  on_data_update: function(data) { /* data persistence */ },
  on_finish: async function() { /* cleanup + redirect */ },

  // Global Custom Code injected here if configured
});
// __INIT_JSPSYCH_END__
\`\`\`

## How to Customize

**Builder → Global Code → initJsPsych → Open initJsPsych**

| Tab | Effect |
|---|---|
| Local Config | Replaces the entire block in **local preview** |
| Local (generated) | Read-only — shows the code Builder generates |
| Public Config | Replaces the entire block in **published experiment** |
| Public (generated) | Read-only — shows the code Builder generates |

If you write the same content as the generated one, the override is deleted (not stored).

**Important**: The \`// __INIT_JSPSYCH_START__\` and \`// __INIT_JSPSYCH_END__\` markers **must be preserved** in your custom code for the substitution to work.

## Global Custom Code (Extra Options)

From **Builder → Global Code → Custom Code**, code can be injected **inside** \`initJsPsych({})\` without replacing the entire block:

\`\`\`js
const jsPsych = initJsPsych({
  // ... generated code ...

  // --- Global Custom Code ---
  display_element: 'my-custom-container',
  on_interaction_data_update: function(data) { /* extra tracking */ },
  override_safe_mode: true,
});
\`\`\`

Useful for adding jsPsych options not exposed in the Builder UI.

## Progress Bar

Enabled from **Canvas Styles → Progress bar**:

\`\`\`js
const jsPsych = initJsPsych({
  show_progress_bar: true,
  // The bar updates automatically with the number of trials in the timeline
});
\`\`\`
`,
  },

  // ═══════════════════════════════════════════════════════
  // 13. CUSTOM CODE INJECTION
  // ═══════════════════════════════════════════════════════
  {
    id: "custom-code",
    title: "Custom Code Injection",
    content: `# Custom Code Injection

## Per Trial: on_start / on_finish

Each trial can have custom JavaScript code in its callbacks. Edited from **⌨ Open Code Component** in the trial panel.

### Execution Order

\`\`\`js
on_start: function(trial) {
  // 1. Conditional params override (evaluated against historical data)
  // 2. Branch custom parameters (applied if there is an active branch)

  // --- Your code here ---
  // Access to: trial, jsPsych, trialSessionId, participantNumber

  // 3. The trial renders after on_start
}

on_finish: function(data) {
  // 1. Repeat conditions (evaluates whether to jump)

  // --- Your code here ---
  // Access to: data, jsPsych, trialSessionId, participantNumber

  // 2. Branch conditions (evaluates where to jump)
}
\`\`\`

### Variables Available in Trial Custom Code

| Variable | Available in | Type | Description |
|---|---|---|---|
| \`trial\` | \`on_start\` | object | Trial parameters (mutable) |
| \`data\` | \`on_finish\` | object | Completed trial data |
| \`jsPsych\` | Both | object | Global jsPsych instance |
| \`trialSessionId\` | Both | string | Current session ID |
| \`participantNumber\` | Both | number | Participant number |
| \`window.branchingActive\` | Both | boolean | Active branch |
| \`window.nextTrialId\` | Both | string | Branch target trial |
| \`window.skipRemaining\` | Both | boolean | Skip flag |
| \`window.branchCustomParameters\` | \`on_start\` | object | Branch params |

> **Do not modify** \`window.nextTrialId\`, \`window.skipRemaining\`, \`window.branchingActive\`, or \`window.branchCustomParameters\` directly. They are managed by the branching system.

### Example: Conditional Logging

\`\`\`js
on_finish: function(data) {
  if (data.rt > 2000) {
    console.warn('Slow response on trial ' + data.builder_id, data);
  }
}
\`\`\`

### Example: Modifying Stimulus in on_start

\`\`\`js
on_start: function(trial) {
  // Change text based on participant number (even/odd)
  if (participantNumber % 2 === 0) {
    trial.stimulus = 'Condition A: ' + trial.stimulus;
  } else {
    trial.stimulus = 'Condition B: ' + trial.stimulus;
  }
}
\`\`\`

## Global Custom Code

Injected inside \`initJsPsych({})\`. See **initJsPsych — Customization** section.

## Full initJsPsych Override

Replaces the entire block. Ideal for full control of \`on_data_update\` or \`on_finish\` without the restrictions of the generated code.
`,
  },

  // ═══════════════════════════════════════════════════════
  // 14. EXTENSIONS
  // ═══════════════════════════════════════════════════════
  {
    id: "extensions",
    title: "Extensions",
    content: `# Extensions

jsPsych extensions add cross-cutting functionality to trials. They are configured per trial from the configuration panel.

Code generated from \`utils/generateExtensionCode.ts\`.

## Mouse Tracking

Records the cursor position during the trial.

\`\`\`js
// In initJsPsych:
extensions: [
  { type: jsPsychExtensionMouseTracking }
],

// In the trial:
extensions: [
  { type: jsPsychExtensionMouseTracking,
    params: { targets: ["#target"] } }
],
\`\`\`

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`targets\` | string[] | \`["#target"]\` | CSS selectors of elements to track |
| \`events\` | string[] | \`["mousemove"]\` | Events to record |

Generated data: \`mouse_tracking_data\` — array of \`{ x, y, t, event }\`.

## Record Video

Records the webcam during the trial.

\`\`\`js
// In initJsPsych:
extensions: [
  { type: jsPsychExtensionRecordVideo }
],

// In the trial:
extensions: [
  { type: jsPsychExtensionRecordVideo }
],
\`\`\`

Generated data: \`record_video_data\` — base64 string of the recorded video.

## WebGazer (Eye Tracking)

\`\`\`js
// In initJsPsych:
extensions: [
  { type: jsPsychExtensionWebgazer }
],

// In the trial — targets are auto-detected from visual components:
extensions: [
  { type: jsPsychExtensionWebgazer,
    params: {
      targets: ["#ImageComponent_1", "#TextComponent_1"]
    }
  }
],
\`\`\`

Targets are automatically generated from the visual components of the DynamicPlugin (ImageComponent, TextComponent, VideoComponent, HtmlComponent).

Generated data: \`webgazer_data\` — array of \`{ x, y, t }\` + \`webgazer_targets\`.

See the **WebGazer (Eye Tracking)** section for the calibration sequence.
`,
  },

  // ═══════════════════════════════════════════════════════
  // 15. WEBGAZER (EYE TRACKING)
  // ═══════════════════════════════════════════════════════
  {
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
  },

  // ═══════════════════════════════════════════════════════
  // 16. COLUMN MAPPING AND CSV
  // ═══════════════════════════════════════════════════════
  {
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
  },

  // ═══════════════════════════════════════════════════════
  // 17. ORDERS & CATEGORIES (COUNTERBALANCING)
  // ═══════════════════════════════════════════════════════
  {
    id: "counterbalancing",
    title: "Orders & Categories",
    content: `# Orders & Categories (Counterbalancing)

Participant-number-based counterbalancing system. Configured in **Builder → Trial Config → Orders & Categories**.

## Orders (Presentation Orders)

Defines permutations of stimulus order within a loop. Each CSV column marked as "order" contains an order index.

\`\`\`csv
stimulus, order_a, order_b
img1.png, 1, 3
img2.png, 2, 1
img3.png, 3, 2
\`\`\`

The Builder extracts the indices as \`stimuliOrders\`:

\`\`\`js
const stimuliOrders = [
  [1, 2, 3],  // order_a
  [3, 1, 2],  // order_b
];

// Selection by participant number:
const orderIndex = (participantNumber - 1) % stimuliOrders.length;
const selectedOrder = stimuliOrders[orderIndex];
// Participant 1 → order_a (original)
// Participant 2 → order_b (alternative)
// Participant 3 → order_a (cyclic)
\`\`\`

## Categories (Participant Groups)

Assigns participants to groups that receive different stimulus sets:

\`\`\`csv
stimulus, category
img_setA_1.png, group_a
img_setA_2.png, group_a
img_setB_1.png, group_b
img_setB_2.png, group_b
\`\`\`

\`\`\`js
const categoryData = ["group_a", "group_a", "group_b", "group_b"];
const participantsPerCategory = 2;

const categoryIndex = Math.floor((participantNumber - 1) / participantsPerCategory);
const selectedCategory = categoryData[categoryIndex];
// Participants 1-2 → group_a
// Participants 3-4 → group_b
// Participants 5-6 → group_a (cyclic)
\`\`\`

## Combining Orders + Categories

They can be used simultaneously. First filter by category, then apply the order.

## Limitations

- Counterbalancing works at the loop level. Standalone trials outside loops don't have access to this system.
- \`participantNumber\` is assigned sequentially by the server (not random).
- If the number of participants exceeds available permutations, it wraps around cyclically.
`,
  },

  // ═══════════════════════════════════════════════════════
  // 18. STANDARD JSPSYCH PLUGINS
  // ═══════════════════════════════════════════════════════
  {
    id: "plugins",
    title: "Standard jsPsych Plugins",
    content: `# Standard jsPsych Plugins

Builder includes **57 official plugins** from jsPsych v8. Metadata (parameters, types, defaults, generated data) is in \`server/metadata/*.json\`.

## Loading by Mode

| Mode | Source | What is loaded |
|---|---|---|
| Local (preview) | \`/bundle/jspsych-bundle.js\` | Full bundle (all plugins) |
| Published | unpkg CDN | **Only the plugins used** in the experiment |

In published mode, \`experiments.js\` analyzes the trials and only includes the \`<script>\` tags for the plugins that the experiment actually needs.

## Full List of Available Plugins

### Stimulus + Response

| Plugin | Stimulus | Response |
|---|---|---|
| \`jsPsychHtmlKeyboardResponse\` | HTML | Keyboard |
| \`jsPsychHtmlButtonResponse\` | HTML | Buttons |
| \`jsPsychHtmlSliderResponse\` | HTML | Slider |
| \`jsPsychImageKeyboardResponse\` | Image | Keyboard |
| \`jsPsychImageButtonResponse\` | Image | Buttons |
| \`jsPsychImageSliderResponse\` | Image | Slider |
| \`jsPsychAudioKeyboardResponse\` | Audio | Keyboard |
| \`jsPsychAudioButtonResponse\` | Audio | Buttons |
| \`jsPsychAudioSliderResponse\` | Audio | Slider |
| \`jsPsychVideoKeyboardResponse\` | Video | Keyboard |
| \`jsPsychVideoButtonResponse\` | Video | Buttons |
| \`jsPsychVideoSliderResponse\` | Video | Slider |

### Surveys

| Plugin | Description |
|---|---|
| \`jsPsychSurveyMultiChoice\` | Multiple choice |
| \`jsPsychSurveyMultiSelect\` | Multiple selection |
| \`jsPsychSurveyText\` | Free text |
| \`jsPsychSurveyLikert\` | Likert scale |
| \`jsPsychSurveyHtmlForm\` | Custom HTML form |
| \`jsPsychSurvey\` | Composite survey (multiple types) |

### Specialized

| Plugin | Description |
|---|---|
| \`jsPsychAnimation\` | Animation (image sequence) |
| \`jsPsychAudioSliderResponse\` | Audio + slider |
| \`jsPsychBrowserCheck\` | Compatibility check |
| \`jsPsychCallFunction\` | Execute arbitrary function |
| \`jsPsychCanvasKeyboardResponse\` | Canvas + keyboard |
| \`jsPsychCanvasButtonResponse\` | Canvas + buttons |
| \`jsPsychCanvasSliderResponse\` | Canvas + slider |
| \`jsPsychCategorizeAnimation\` | Categorize animation |
| \`jsPsychCategorizeHtml\` | Categorize HTML |
| \`jsPsychCategorizeImage\` | Categorize image |
| \`jsPsychCloze\` | Cloze text |
| \`jsPsychExternalHtml\` | External HTML (iframe) |
| \`jsPsychFreeSort\` | Free sorting |
| \`jsPsychFullscreen\` | Fullscreen |
| \`jsPsychHtmlAudioResponse\` | HTML + audio response |
| \`jsPsychHtmlVideoResponse\` | HTML + video response |
| \`jsPsychIatHtml\` | IAT (Implicit Association Test) |
| \`jsPsychIatImage\` | IAT with images |
| \`jsPsychInitialization\` | Initialization |
| \`jsPsychInstructions\` | Instruction pages |
| \`jsPsychMaxDiff\` | MaxDiff (best-worst scaling) |
| \`jsPsychMirrorCamera\` | Mirror camera |
| \`jsPsychMultiImageKeyboardResponse\` | Multiple images + keyboard |
| \`jsPsychMultiImageButtonResponse\` | Multiple images + buttons |
| \`jsPsychMultiImageSliderResponse\` | Multiple images + slider |
| \`jsPsychPreload\` | Resource preloading |
| \`jsPsychReconstruction\` | Reconstruction |
| \`jsPsychResize\` | Resize window |
| \`jsPsychSameDifferentHtml\` | Same/Different with HTML |
| \`jsPsychSameDifferentImage\` | Same/Different with images |
| \`jsPsychSerialReactionTimeMouse\` | SRT with mouse |
| \`jsPsychSerialReactionTime\` | SRT with keyboard |
| \`jsPsychSketchpad\` | Drawing (native jsPsych) |
| \`jsPsychVirtualChinrest\` | Virtual chinrest |
| \`jsPsychVisualSearchCircle\` | Visual search (circles) |
| \`jsPsychWebgazerCalibrate\` | Eye tracking — calibrate |
| \`jsPsychWebgazerInitCamera\` | Eye tracking — start camera |
| \`jsPsychWebgazerValidate\` | Eye tracking — validate |

## Standard Data Generated by All Plugins

\`\`\`js
{
  trial_type: "html-keyboard-response",
  trial_index: 5,
  time_elapsed: 8240,
  rt: 840,
  response: "f",
  stimulus: "<p>Press F or J</p>",
  // + Builder-injected fields:
  trial_id: 123,
  builder_id: "uuid-abc",
  trial_name: "Encoding Task",
  isInLoop: false,
  branches: [],
  branchConditions: [],
  // + Session fields (published mode):
  clientTimestamp: 1715030450123,
  sessionId: "20260506_003",
  experimentID: "exp-123",
}
\`\`\`
`,
  },

  // ═══════════════════════════════════════════════════════
  // 19. PUBLISHING TO GITHUB PAGES
  // ═══════════════════════════════════════════════════════
  {
    id: "publish",
    title: "Publishing to GitHub Pages",
    content: `# Publishing to GitHub Pages

## Flow

\`\`\`mermaid
flowchart TD
    A["Builder: Publish button"] --> B["generateExperiment(storage)"]
    B --> C["PublicConfiguration.ts generates public code"]
    C --> D["POST /api/publish-experiment/:id"]
    D --> E["Server: replace local bundles with CDN"]
    E --> F["Server: convert media files to base64"]
    F --> G["Server: push to the experiment's GitHub repo"]
    G --> H["GitHub Actions: deploy to GitHub Pages"]
    H --> I["https://user.github.io/repo-name/"]
\`\`\`

## Publishing Transformations

| Step | Description |
|---|---|
| 1. Generate public code | \`PublicConfiguration.generateExperiment(storage)\` — includes Firebase, IndexedDB, CAPTCHA |
| 2. Swap bundles | Replaces \`jspsych-bundle/index.js\` with individual scripts from unpkg CDN |
| 3. Only plugins used | Analyzes the trials and only includes the necessary \`<script>\` tags |
| 4. Media to base64 | Images, audio, video → \`data:...;base64,...\` inline in the HTML |
| 5. Firebase creds | Server credentials baked-in to the code |
| 6. Push to GitHub | The final HTML is committed to the experiment's repo |
| 7. Automatic deploy | GitHub Actions (if configured) deploys to \`gh-pages\` |

## Public URL

\`\`\`text
https://[github-username].github.io/[repo-name]/
\`\`\`

The repo name is configured in **Builder → Settings → GitHub**.

## Data Storage

Participant data in published experiments goes to:
- **Firebase Realtime Database** → sessions and trials
- **Firebase Cloud Function** → file uploads (\`/uploadParticipantFile\`)
- **IndexedDB** (local) → temporary buffer with 3-day TTL
`,
  },

  // ═══════════════════════════════════════════════════════
  // 20. DATA FORMAT REFERENCE
  // ═══════════════════════════════════════════════════════
  {
    id: "data-format",
    title: "Data Format Reference",
    content: `# Data Format Reference

Each trial generates a data object with fields from multiple sources. This is the complete reference.

## jsPsych Fields (core)

| Field | Type | Description |
|---|---|---|
| \`trial_type\` | string | Plugin name (e.g. \`"html-keyboard-response"\`) |
| \`trial_index\` | number | 0-based index in the timeline |
| \`time_elapsed\` | number | ms since experiment start |
| \`internal_node_id\` | string | Internal jsPsych node ID |
| \`rt\` | number \| null | Reaction time in ms |
| \`response\` | any | Participant's response |
| \`stimulus\` | string | Presented stimulus |
| \`correct\` | boolean \| null | Whether the response was correct |
| \`correct_response\` | any \| null | Expected correct response |

## Builder-Injected Fields (trial-level)

| Field | Type | Generated by | Description |
|---|---|---|---|
| \`trial_id\` | number | \`useTrialCode.ts\` | Numeric trial ID in the DB |
| \`builder_id\` | string (UUID) | \`useTrialCode.ts\` | Stable UUID for resume and branching |
| \`trial_name\` | string | \`useTrialCode.ts\` | Trial name in the Builder |
| \`isInLoop\` | boolean | \`useTrialCode.ts\` | Whether the trial is inside a loop |
| \`branches\` | string[] | \`useTrialCode.ts\` | UUIDs of target trials for branch |
| \`branchConditions\` | object[] | \`useTrialCode.ts\` | Conditions that led to this trial |

## Builder-Injected Fields (session-level, published mode)

| Field | Type | Generated by | Description |
|---|---|---|---|
| \`clientTimestamp\` | number | \`PublicConfiguration.ts\` | \`Date.now()\` at trial time |
| \`sessionId\` | string | \`PublicConfiguration.ts\` | Current session ID |
| \`experimentID\` | string | \`PublicConfiguration.ts\` | Experiment ID in Firebase |

## DynamicPlugin Fields

Format: \`[ComponentType]_[Index]_[Property]\`

| Component | Generated fields |
|---|---|
| TextComponent | (no data generated) |
| ImageComponent | \`ImageComponent_N_stimulus\` |
| AudioComponent | (no data generated) |
| VideoComponent | (no data generated) |
| HtmlComponent | (no data generated) |
| SketchpadComponent | \`SketchpadComponent_N_strokes\`, \`SketchpadComponent_N_png\` |
| ButtonResponseComponent | \`ButtonResponseComponent_N_response\`, \`ButtonResponseComponent_N_rt\` |
| KeyboardResponseComponent | \`KeyboardResponseComponent_N_response\`, \`KeyboardResponseComponent_N_rt\` |
| SliderResponseComponent | \`SliderResponseComponent_N_response\`, \`SliderResponseComponent_N_rt\` |
| InputResponseComponent | \`InputResponseComponent_N_response\`, \`InputResponseComponent_N_rt\` |
| ClickResponseComponent | \`ClickResponseComponent_N_response\` (array \`[x, y]\`), \`ClickResponseComponent_N_rt\` |
| AudioResponseComponent | \`AudioResponseComponent_N_response\` (base64), \`AudioResponseComponent_N_rt\` |
| FileUploadResponseComponent | \`FileUploadResponseComponent_N_response\` (URL) |
| SurveyComponent | \`SurveyComponent_N_response\` (object \`{ questionName: answer }\`) |

## Extension Fields

| Extension | Field | Type |
|---|---|---|
| Mouse Tracking | \`mouse_tracking_data\` | \`{ x, y, t, event }[]\` |
| Record Video | \`record_video_data\` | string (base64) |
| WebGazer | \`webgazer_data\` | \`{ x, y, t }[]\` |
| WebGazer | \`webgazer_targets\` | string[] |

## Global Variables in Experiment Scope

| Variable | Scope | Description |
|---|---|---|
| \`jsPsych\` | Global | jsPsych instance |
| \`timeline\` | Global | Experiment timeline array |
| \`trialSessionId\` | IIFE | Current session ID |
| \`participantNumber\` | IIFE | Participant number |
| \`metadata\` | IIFE | System metadata |
| \`pendingDataSaves\` | IIFE | In-flight fetch promises (local) |
| \`socket\` | IIFE | Socket.IO client (local) |
| \`TrialDB\` | Global | IndexedDB wrapper (published) |
| \`BATCH_CONFIG\` | IIFE | Batching config (published) |

## localStorage Keys Used by the Experiment

| Key | When written | When cleared |
|---|---|---|
| \`jsPsych_currentSessionId\` | At session start | \`on_finish\` (success) |
| \`jsPsych_participantNumber\` | When number received | \`on_finish\` (success) |
| \`jsPsych_resumeTrial\` | Each \`on_data_update\` | \`on_finish\` (success) |
| \`jsPsych_jumpToTrial\` | Repeat/jump triggered | When consumed in \`conditional_function\` |
| \`jsPsych_jumpReload\` | \`sessionStorage\` | At experiment start (anti-loop guard) |
`,
  },

  // ═══════════════════════════════════════════════════════
  // 21. INTERNAL APIs REFERENCE
  // ═══════════════════════════════════════════════════════
  {
    id: "api-reference",
    title: "Internal APIs Reference",
    content: `# Internal APIs Reference

## window Globals

| Variable | Type | Mode | Description |
|---|---|---|---|
| \`window.skipRemaining\` | boolean | Both | Activates trial skip until nextTrialId is found |
| \`window.nextTrialId\` | string \| null | Both | Target trial of the active branch |
| \`window.branchingActive\` | boolean | Both | Indicates branch in progress |
| \`window.branchCustomParameters\` | object \| null | Both | Params to inject into target trial |
| \`window.JSPSYCH_FILE_UPLOAD_ENDPOINT\` | string | Both | Endpoint for FileUploadResponseComponent |
| \`window.JSPSYCH_SESSION_ID\` | string | Both | Current Session ID |
| \`window._socketReady\` | boolean | Local | true when Socket.IO loaded |
| \`window._firebaseReady\` | boolean | Published | true when Firebase SDK loaded |

## Loop Scope Variables

| Variable | Scope |
|---|---|
| \`window.loop_ID_NextTrialId\` | Loop with uuid \`ID\` |
| \`window.loop_ID_SkipRemaining\` | Loop with uuid \`ID\` |
| \`window.loop_ID_BranchingActive\` | Loop with uuid \`ID\` |
| \`window.loop_ID_BranchCustomParameters\` | Loop with uuid \`ID\` |

## localStorage Keys

| Key | Content | Lifecycle |
|---|---|---|
| \`jsPsych_currentSessionId\` | Current Session ID | Created at start, cleared in on_finish |
| \`jsPsych_participantNumber\` | Participant number | Created on assignment, cleared in on_finish |
| \`jsPsych_resumeTrial\` | \`{ branches, branchConditions, trialData }\` | Updated each trial, cleared in on_finish |
| \`jsPsych_jumpToTrial\` | builder_id of target trial | Created by repeat/jump, cleared when consumed |

## sessionStorage Keys

| Key | Content | Lifecycle |
|---|---|---|
| \`jsPsych_jumpReload\` | \`"1"\` | Written before reload, cleared at start |

## Template Markers

| Marker | Location | Purpose |
|---|---|---|
| \`// __INIT_JSPSYCH_START__\` | Start of initJsPsych block | Delimits replaceable zone |
| \`// __INIT_JSPSYCH_END__\` | End of initJsPsych block | Delimits replaceable zone |

## Express Endpoints (local mode)

| Method | Route | Body / Response |
|---|---|---|
| POST | \`/api/append-result/:id\` | \`{ sessionId, metadata }\` → \`{ participantNumber }\` |
| PUT | \`/api/append-result/:id\` | \`{ sessionId, response }\` → \`{ success }\` |
| POST | \`/api/complete-session/:id\` | \`{ sessionId }\` → \`{ success }\` |
| POST | \`/api/participant-files/:id\` | FormData with file → \`{ url }\` |
| PATCH | \`/api/rename-session/:id\` | \`{ oldId, newId }\` → \`{ success }\` |
| GET | \`/api/session-name-config/:id\` | → \`{ tokens, separator }\` |

## Firebase Realtime Database Paths (published mode)

| Path | Content |
|---|---|
| \`/experiments/:id/sessions/:sid/state\` | \`"pending"\|"in-progress"\|"completed"\|"disconnected"\` |
| \`/experiments/:id/sessions/:sid/connected\` | boolean |
| \`/experiments/:id/sessions/:sid/participantNumber\` | number |
| \`/experiments/:id/sessions/:sid/startedAt\` | TIMESTAMP |
| \`/experiments/:id/sessions/:sid/finishedAt\` | TIMESTAMP |
| \`/experiments/:id/sessions/:sid/lastUpdate\` | TIMESTAMP |
`,
  },

  // ═══════════════════════════════════════════════════════
  // 22. TROUBLESHOOTING / FAQ
  // ═══════════════════════════════════════════════════════
  {
    id: "troubleshooting",
    title: "Troubleshooting / FAQ",
    content: `# Troubleshooting / FAQ

## The experiment doesn't load

1. **Local**: Verify that the Express server is running (\`npm start\` in the root) and that port 3000 is available.
2. **Published**: Wait ~2 minutes after publishing for GitHub Pages to deploy. Check the repo's **Actions** tab.

## Files not showing (404)

- In **local** mode, files must have been uploaded from the Builder's Timeline panel. URLs are generated as \`/api/files/:id/filename.ext\`.
- In **published** mode, files are converted to base64 upon publishing. If a file fails, re-publish the experiment.

## Branching doesn't work

1. Verify that the **column names** in the conditions match the generated names exactly (case-sensitive).
2. For DynamicPlugin, the format is \`ComponentType_Index_Property\` (e.g. \`ButtonResponseComponent_1_response\`).
3. For SurveyComponent, access the nested property: \`SurveyComponent_1_response.questionName\`. The branching system handles this automatically if you select the question from the Builder's dropdown.
4. Check that the target trial **exists** in the timeline and is **after** the source trial (for branch, not jump).

## Resume doesn't work

1. Resume only works if the participant closes the browser **after** completing at least one trial with \`builder_id\`.
2. If the trial was deleted or renamed after the participant started, resume will fail (clean reset).
3. Clearing the browser's localStorage/cookies erases the resume state.
4. In incognito, resume does not persist between browser sessions.

## localStorage Limits

- localStorage has a limit of ~5-10 MB per domain.
- \`jsPsych_resumeTrial\` stores the complete \`data\` of the last trial. Heavy data (audio/video base64) may exceed the limit.
- **Solution**: Avoid storing large blobs. FileUploadResponseComponent and AudioResponseComponent upload files to the server and only store the URL.

## CORS Errors in Published Mode

- Firebase Cloud Functions must have CORS enabled for the GitHub Pages domain.
- \`DATA_API_URL\` is configured in Firestore. It must point to the correct Cloud Function URL.

## Browser Compatibility

| Browser | Status | Notes |
|---|---|---|
| Chrome 90+ | Supported | Full functionality |
| Firefox 90+ | Supported | WebGazer may have reduced accuracy |
| Edge 90+ | Supported | Chromium-based |
| Safari 15+ | Supported | AudioResponse may require explicit permission |
| Mobile Chrome | Partial | Responsive screen layouts required |
| Mobile Safari | Partial | Fullscreen not supported, AudioResponse limited |

## The Experiment is Slow

- **Published with IndexedDB**: Check \`BATCH_CONFIG\`. A \`size\` that's too low generates too many requests. Too high can cause data loss if the browser crashes.
- **Many files without preload**: Add a \`jsPsychPreload\` at the start or upload files from the Builder's Timeline.
- **Large SurveyJS**: Surveys with 50+ questions may take time to render. Consider splitting into multiple trials.

## Common Errors in Custom Code

1. **\`trial is not defined\`** in \`on_finish\`: The variable in \`on_finish\` is \`data\`, not \`trial\`.
2. **\`jsPsych is not defined\`** in inline code: Make sure the code is inside a callback, not in the global scope.
3. **Modifying \`window.nextTrialId\`** directly: Use the Builder's branch conditions. Manual modification can break the flow.
`,
  },
];
