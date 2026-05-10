# 12 - CSV, Multimedia & Publish Flow

This document covers the end-to-end flow for creating and publishing experiments, including CSV data handling, multimedia file management, and the complete publish pipeline to GitHub Pages.

---

## Part 1: CSV Data Handling

### Architecture

CSV data is the mechanism for creating data-driven (repeated) trials. One CSV row = one trial iteration.

```
User uploads CSV → Loop stores csvJson + csvColumns
  → Trials inside loop get csvFromLoop = true
  → Trial columnMapping references loop's CSV columns
  → Code generation creates timeline_variables from loop CSV
```

### Critical Rule: Loop CSV Overrides Trial CSV

**When a trial is inside a loop that has its own CSV, the loop's CSV takes over completely.** The trial's own `csvJson` (if any) is ignored at code generation time (`generateTrialLoopCodes.ts:197-200`):

```typescript
const effectiveCsvJson =
  fullTrial.csvFromLoop && loopCsvJson && loopCsvJson.length > 0
    ? loopCsvJson             // ← loop CSV wins, trial's own data is IGNORED
    : fullTrial.csvJson || []; // ← trial CSV only used when loop has no CSV
```

**What this means for LLMs generating experiments:**
- To give a trial its own CSV: place the trial **outside** loops, or inside a loop that has **no** CSV
- To share CSV across trials: put them in a loop **with** CSV → all trials automatically share it
- A trial's `columnMapping` must reference the loop's CSV columns (not trial-level columns)
- You **cannot** give a trial inside a CSV-loop a different, independent CSV — it will be overridden
- If you need different CSVs for different trials, create separate loops (each with its own CSV) or keep trials outside loops

### CSV Upload (`useCsvData.ts`)

Located at `TrialsConfiguration/Csv/useCsvData.ts`. Supports two formats:

#### CSV parsing (PapaParse)
```typescript
// Accepts .csv files
Papa.parse(file, {
  header: true,          // First row = column headers
  skipEmptyLines: true,
  complete: (results) => {
    // results.data = array of row objects
    // Object.keys(results.data[0]) = column names
  }
});
```

#### Excel/XLSX parsing (ExcelJS)
```typescript
// Accepts .xlsx files
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(arrayBuffer);
const worksheet = workbook.getWorksheet(1);

// Row 1 = headers
// Row 2+ = data rows
// Handles: string, number, Date, Formula cells
// Skips empty rows
```

### CSV Uploader UI (`Csv/CsvUploader.tsx`)

- Accepts `.csv` and `.xlsx` files
- Shows **data preview table** after upload (spreadsheet-like: column letters A, B, C... + row numbers)
- Delete button to clear CSV
- Disabled state for read-only mode

### CSV Data Structure

```typescript
// After parsing "stimuli.csv":
//   image, duration, correct_response
//   cat.jpg, 2000, left
//   dog.jpg, 1500, right

csvJson = [
  { image: "cat.jpg", duration: "2000", correct_response: "left" },
  { image: "dog.jpg", duration: "1500", correct_response: "right" }
];
csvColumns = ["image", "duration", "correct_response"];
```

### CSV Storage & Propagation

1. CSV is stored on the **Loop** (`loop.csvJson`, `loop.csvColumns`)
2. When a loop has CSV, all its child trials get `csvFromLoop = true`
3. CSV is propagated from loop to trials via `updateTrialField(trialId, "csvFromLoop", hasCsv)`
4. Trial's `TrialsConfig` loads CSV from parent loop's data when selected

### ColumnMapping with CSV

Each trial parameter can be mapped to a CSV column:

```typescript
// columnMapping entry
"stimulus": { source: "csv", value: "image" }
// Means: use the "image" column from CSV for this parameter

// Direct typed value
"trial_duration": { source: "typed", value: 2000 }

// Use default
"response_ends_trial": { source: "none", value: undefined }
```

### Code Generation with CSV

When a trial has CSV attached (via loop), the generated code includes:

```javascript
{
  type: jsPsychHtmlKeyboardResponse,
  timeline: [{
    stimulus: jsPsych.timelineVariable('image'),  // reads from CSV
    trial_duration: 2000,
    // ...
  }],
  timeline_variables: [
    { image: "cat.jpg", duration: "2000", correct_response: "left" },
    { image: "dog.jpg", duration: "1500", correct_response: "right" }
  ],
  randomize_order: true,   // from loop config
  repetitions: 2            // from loop config
}
```

### LLM-Friendly CSV Creation

For a chat agent creating experiments, CSVs can be generated programmatically:

```typescript
// CSV format the builder expects:
const csvData = [
  { column1: "value1", column2: "value2" },
  { column1: "value3", column2: "value4" }
];
const csvColumns = ["column1", "column2"];

// CRITICAL: CSV must be attached to a LOOP, not a trial.
// Trials inside the loop inherit the loop's CSV automatically.
// A trial's standalone csvJson is IGNORED if its loop has CSV.

// Option A: Create loop with CSV in one call
await fetch(`/api/loop/${experimentID}`, {
  method: "POST",
  body: JSON.stringify({
    name: "My Loop",
    trials: [trialId],
    repetitions: 1,
    csvJson: csvData,
    csvColumns: csvColumns
  })
});

// Option B: Update existing loop with CSV
await fetch(`/api/loop/${experimentID}/${loopId}`, {
  method: "PATCH",
  body: JSON.stringify({
    csvJson: csvData,
    csvColumns: csvColumns
  })
});

// ⚠️ REQUIRED: Set csvFromLoop=true on every trial inside the loop.
// This is NOT automatic via direct API — the frontend UI does it
// in saveCsvData(), but raw API calls need it explicitly.
for (const trialId of loop.trials) {
  await fetch(`/api/trial/${experimentID}/${trialId}`, {
    method: "PATCH",
    body: JSON.stringify({ csvFromLoop: true })
  });
}

// Then map trial parameters to the loop's CSV columns:
// { source: "csv", value: "column1" }
// { source: "csv", value: "column2" }

// If you need different CSVs for different trial sets, use SEPARATE LOOPS.
```

---

## Part 2: Multimedia File Management

### File Upload Flow (`useFileUpload.ts`)

```
User selects file(s) → handleFileUpload()
  → FormData with files appended
  → POST /api/upload-files/:experimentID (multipart)
  → Server classifies by extension into folders:
      {experimentName}/img/   (.png, .jpg, .gif, .svg, .webp, .bmp)
      {experimentName}/aud/   (.mp3, .wav, .ogg, .m4a, .flac, .aac)
      {experimentName}/vid/   (.mp4, .webm, .mov, .avi, .mkv)
      {experimentName}/others/ (everything else)
  → Invalidates cache → re-fetches file list
```

### File Type Classification (Server-side)

```javascript
// server/routes/files.js
const ext = path.extname(file.originalname).toLowerCase();
if (/\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(ext)) type = "img";
else if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(ext)) type = "aud";
else if (/\.(mp4|webm|mov|avi|mkv)$/i.test(ext)) type = "vid";
else type = "others";
```

### File Listing & Serving

```typescript
// List files by type
GET /api/list-files/:type/:experimentID  // type = "img" | "aud" | "vid" | "others" | "all"

// Response:
{
  files: [
    { name: "photo.jpg", url: "img/photo.jpg", type: "img" },
    { name: "sound.mp3", url: "aud/sound.mp3", type: "aud" }
  ]
}

// Files are served at matching URL paths:
// /img/photo.jpg → searches all experiment folders → serves file
```

### File URLs in the Builder

When files are uploaded, they receive URLs like:
```
img/encoded_filename.jpg
aud/encoded_filename.mp3
vid/encoded_filename.mp4
```

These URLs are used in trial parameters via `ColumnMapping`:
```typescript
// In columnMapping for an ImageComponent
"stimulus": { source: "typed", value: "img/photo.jpg" }
```

### File Uploader UI (`FileUploader.tsx`)

- **Upload single/multiple files** (file input with `multiple` attribute)
- **Upload entire folder** (file input with `webkitdirectory`)
- **Click-to-copy**: Click a filename to copy its URL to clipboard
- **Select mode**: Multi-select files for batch deletion
- **Delete**: Remove individual files or batch delete selected files
- **Cache**: 5-minute in-memory cache for file listings

### Participant Files

Files uploaded by participants during experiments (via FileUploadResponseComponent):
- Sent as base64 in JSON body (not multipart)
- `POST /api/participant-files/:experimentID`
- Body: `{ files: [{ name, data: base64, type, size }], sessionId? }`
- Stored in `{experimentName}/participant-files/`
- DB records include sessionId for renaming support

### LLM-Friendly File Handling

For a chat agent:

```typescript
// Upload a file for an experiment
const formData = new FormData();
formData.append("files", fileBlob, "photo.jpg");

await fetch(`/api/upload-files/${experimentID}`, {
  method: "POST",
  body: formData
});

// The file URL is then: "img/photo.jpg"
// Use this URL in trial columnMapping:
// { source: "typed", value: "img/photo.jpg" }

// List existing files
const res = await fetch(`/api/list-files/all/${experimentID}`);
const { files } = await res.json();
// files = [{ name: "photo.jpg", url: "img/photo.jpg", type: "img" }]
```

---

## Part 3: Complete Publish Flow

### Overview

```
[Builder] Generate experiment code → [Server] Build HTML → [Server] Publish to GitHub Pages via Firebase
```

### Step-by-Step Flow

#### Step 1: Build Experiment (Local)

1. User clicks "Build Experiment" button in the Timeline sidebar
2. `handleRunExperiment()` in `Actions.ts` is called
3. `generateLocalExperiment()` generates local code:
   - Gets timeline from context
   - Fetches all trial/loop data
   - Generates jsPsych timeline code with local file references
4. `POST /api/run-experiment/:experimentID` with `{ generatedCode, canvasStyles }`
5. Server builds HTML file at `experiments_html/{name}.html`
6. Experiment URL: `http://localhost:3000/{experimentName}`

#### Step 2: Share Local (Cloudflare Tunnel)

1. User clicks "Share Local Experiment"
2. `handleShareLocalExperiment()` calls `POST /api/create-tunnel`
3. Cloudflared binary creates tunnel to `localhost:3000`
4. Two modes:
   - **Quick tunnel**: Random `*.trycloudflare.com` URL
   - **Custom hostname**: Pre-configured domain via Tunnel Settings
5. Tunnel URL is persisted and shared via copy button

#### Step 3: Publish to GitHub Pages

1. User clicks "Publish to GitHub Pages"
2. `PublishExperiment.ts::handlePublishToGitHub()`:
   - Checks user is logged in (Firebase auth)
   - Gets user's storage tokens (Google Drive, Dropbox, OSF)
   - If multiple storages: shows `StorageSelectModal`
   - If single storage or after selection: calls `publishWithStorage(uid, storage)`

#### Step 4: Generate Public Code

3. `publishWithStorage()` calls `generateExperiment(storage)` from `PublicConfiguration.ts`
4. `PublicConfiguration.ts::generateExperiment()`:
   - Loads Firebase config: batchConfig, recruitmentConfig, captchaConfig
   - Loads session name config from local API
   - Loads DevMode code/custom params (public variant)
   - Generates public experiment code with:
     - Firebase SDK loading (from CDN)
     - Firebase RTDB connection
     - IndexedDB wrapper for client-side batching
     - Session creation with participant number
     - CAPTCHA gate (hCaptcha/reCAPTCHA)
     - Recruitment platform redirects (Prolific/MTurk)
     - Batch data sending logic
     - Resume/jump support
     - `customPreInitCode.public` + `customInitJsPsychParams.public`
     - All trial/loop code with CDN plugin references

#### Step 5: Send to Server

5. `POST /api/publish-experiment/:experimentID`
   Body: `{ uid, storage, generatedPublicCode }`

6. Server-side (`routes/experiments.js`):
   - Reads experiment HTML (uses existing build or template)
   - Replaces local scripts with CDN versions:
     ```javascript
     // Removed:
     $('script[src*="jspsych-bundle"]').remove();
     $('script[src*="webgazer"]').remove();
     $('script[src*="dynamicplugin"]').remove();
     
     // Added:
     <script src="https://unpkg.com/jspsych@8.2.2"></script>
     <script src="https://unpkg.com/jspsych-expbuilder-plugin-dynamic@1.0.2/dist/index.iife.js"></script>
     ```
   - Injects only plugins actually used (via `getPluginScriptsFromTrials`)
   - Injects preload if media files exist
   - Injects fullscreen if enabled
   - Converts multimedia files to base64
   - Replaces generated script with public code

#### Step 6: Firebase → GitHub

7. Server sends to Firebase Cloud Function:
   ```json
   POST {FIREBASE_URL}/publishExperiment
   {
     uid, repoName, htmlContent, description,
     isPrivate: false,
     mediaFiles: [{ type, filename, content: base64 }],
     experimentID, storageProvider
   }
   ```

8. Firebase:
   - Creates/updates GitHub repository
   - Sets up GitHub Pages
   - Returns `{ repoUrl, pagesUrl }`

9. Server saves `pagesUrl` to experiment document

#### Step 7: Result

Client receives: `{ success: true, repoUrl, pagesUrl }`
- GitHub Pages URL is shown
- URL is automatically copied to clipboard
- User can share the public experiment URL

---

## Part 4: Public vs Local Code Differences

| Feature | Local Code | Public Code |
|---------|-----------|-------------|
| jsPsych | Local bundle | unpkg CDN |
| DynamicPlugin | Local server | unpkg CDN |
| Plugin scripts | Local bundle | Individual CDN per plugin |
| Media files | Local URLs (`img/photo.jpg`) | Base64 embedded |
| Data storage | Express API → LowDB → DB API | Firebase RTDB → Storage provider |
| File upload | Express API | Firebase Cloud Function |
| Session ID | Generated locally | Generated + stored in Firebase |
| Batching | None | IndexedDB + batch to Firebase |
| Resume | None | Full resume support via localStorage |
| CAPTCHA | None | hCaptcha/reCAPTCHA gate |
| Recruitment | None | Prolific redirect / MTurk form submit |

---

## Part 5: Complete Tool Flow (Chat Agent Perspective)

For a chat agent creating and publishing an experiment end-to-end:

```
1. CREATE EXPERIMENT
   POST /api/create-experiment  { name, description }

2. UPLOAD FILES (optional)
   POST /api/upload-files/:experimentID  (multipart with files)

3. CREATE TRIALS
   For each trial:
   POST /api/trial/:experimentID  { name, plugin, parameters, columnMapping }

4. CONFIGURE BRANCHING (optional)
   PATCH /api/trial/:experimentID/:id  { branches, branchConditions }

5. CREATE LOOP (optional)
   POST /api/loop/:experimentID  { name, trials: [ids], repetitions, randomize }

6. **ATTACH CSV TO LOOP** (optional)
   PATCH /api/loop/:experimentID/:loopId  { csvJson, csvColumns }
   ⚠️ When a loop gets CSV, ALL its trials automatically use it.
   Trials inside lose their own csvJson at code generation time.
   Rule: loop CSV always wins. To give a trial its own CSV, keep it outside loops.

7. **MAP CSV COLUMNS TO TRIALS**
   PATCH /api/trial/:experimentID/:id  { columnMapping }
   Column values reference the LOOP's csvColumns: { source: "csv", value: "column_name" }

8. BUILD EXPERIMENT
   Generate code → POST /api/run-experiment/:experimentID  { generatedCode }
   → Returns experimentUrl

9. SHARE LOCALLY (optional)
   POST /api/create-tunnel  { experimentID }

10. CONFIGURE EXPERIMENT SETTINGS (optional)
    PUT /api/appearance-settings/:experimentID  { backgroundColor, fullScreen }
    POST /api/session-name-config/:experimentID  { tokens, separator }
    Firebase setDoc for: batchConfig, recruitmentConfig, captchaConfig
    PUT /api/tunnel-settings/:experimentID  { hostname, persistent }

11. PUBLISH
    Generate public code → POST /api/publish-experiment/:experimentID
    { uid, storage, generatedPublicCode }
    → Returns pagesUrl
```
