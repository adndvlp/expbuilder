# 09 - Client-Server Interaction Patterns

## Architecture Overview

```
React Frontend (Vite dev server)
    ↕ fetch(API_URL + endpoint)
Express Backend (Node.js)
    ↕ LowDB read/write
Database (JSON file)
```

`API_URL = import.meta.env.VITE_API_URL` (typically `http://localhost:3000`)

---

## State Management

### React Context Tree

```
<UrlProvider>         ← Provides experimentID via URL params
  <PluginsProvider>   ← Loads plugin metadata list
    <DevModeProvider> ← Manages DevMode/SaveMode state
      <CanvasStylesProvider> ← Canvas dimension defaults
        <TrialsProvider>     ← ALL trial/loop CRUD + timeline state
          <ExperimentBuilder> ← UI components
```

### TrialsProvider (`providers/TrialsProvider/index.tsx`)

The central state manager for all trial/loop operations. Exposes through `TrialsContext`:

```typescript
type TrialsContextType = {
  // State
  timeline: TimelineItem[];           // Main timeline
  loopTimeline: TimelineItem[];       // Current loop's internal timeline
  activeLoopId: string | number | null;
  selectedTrial: Trial | null;
  selectedLoop: Loop | null;
  isLoading: boolean;

  // Trial CRUD
  createTrial(trial) → Trial;
  getTrial(id) → Trial | null;
  updateTrial(id, partial) → Trial | null;
  updateTrialField(id, field, value, updateSelected?) → boolean;
  deleteTrial(id) → boolean;

  // Loop CRUD
  createLoop(loop) → Loop;
  getLoop(id) → Loop | null;
  updateLoop(id, partial) → Loop | null;
  updateLoopField(id, field, value, updateSelected?) → boolean;
  deleteLoop(id) → boolean;

  // Timeline
  updateTimeline(timeline[]) → boolean;
  getTimeline() → void;
  getLoopTimeline(loopId) → TimelineItem[];
  clearLoopTimeline() → void;
  deleteAllTrials() → boolean;
};
```

---

## Optimistic UI Pattern

All mutations follow this pattern:

```
1. Optimistic UI update (update React state immediately)
2. Fetch to backend (PATCH/POST/DELETE)
3a. On success: refine UI with real data from response
3b. On failure: reload entire timeline from backend
```

### Example: Update Trial Field

```typescript
// TrialMethods.ts::updateTrialField()
const updateTrialField = async (id, fieldName, value) => {
  // Step 1: Optimistic UI (for name/branches changes)
  if (fieldName === "name" || fieldName === "branches") {
    setTimeline(prev => prev.map(item => ...));
  }

  // Step 2: Backend
  const response = await fetch(`/api/trial/${experimentID}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ [fieldName]: value })
  });

  // Step 3a: Success - refine with real data
  const { trial: updatedTrial } = await response.json();
  setTimeline(prev => prev.map(/* final update */));
  if (selectedTrial?.id === id) setSelectedTrial(updatedTrial);

  // Step 3b: Failure - reload
  // (handled in catch block)
};
```

---

## Data Flow Examples

### Flow 1: Create a Trial

```
User drags plugin to timeline
  ↓
Canvas calls createTrial({ name: "Trial 1", plugin: "plugin-html-keyboard-response" })
  ↓
TrialsProvider::TrialMethods::createTrial()
  POST /api/trial/:experimentID
  body: { name, plugin, parameters: {} }
  ↓
Server: creates trial with timestamp ID, adds to trials[] and timeline[]
  returns { trial: { id: 1234567890, name, plugin, ... } }
  ↓
TrialsProvider: returns new trial
  ↓
Canvas: adds node to visual timeline
```

### Flow 2: Configure Trial Parameters

```
User clicks trial node → setSelectedTrial(trial)
  ↓
TrialsConfig useEffect: loads trial data
  - Restores name, columnMapping, extensions
  - Loads parent loop CSV if parentLoopId exists
  ↓
ParameterMapper renders plugin parameters
  ↓
User changes "trial_duration" → selects CSV column "duration_ms"
  ↓
saveColumnMapping("trial_duration", { source: "csv", value: "duration_ms" })
  ↓
updateTrialField(id, "columnMapping", { ...existingMapping, trial_duration: newValue })
  PATCH /api/trial/:experimentID/:id
  body: { columnMapping: { ... } }
  ↓
Save indicator shows "✓ Saved (columnMapping)"
```

### Flow 3: Add Branching

```
User clicks "Branch" button on trial
  ↓
BranchedTrial modal opens
  ↓
useLoadData: loads trial data definitions + available trials
  ↓
User adds rule: "response == yes" → target: "Trial A"
  User adds condition (OR): "rt > 500" → target: "Trial B"
  ↓
handleSaveConditions()
  - Separates into branchConditions[] + repeatConditions[]
  - updateTrialField("branchConditions", [...])
  - updateTrialField("repeatConditions", [...])
  ↓
on_finish code generation includes:
  if (data.response === 'yes') { /* navigate */ }
  if (data.rt > 500) { /* navigate */ }
```

### Flow 4: Create a Loop

```
User selects trials on canvas → "Create Loop"
  ↓
createLoop({ name: "Loop 1", trials: [1, 2, 3], repetitions: 2, randomize: true })
  ↓
Optimistic UI: Remove trials from timeline, add temp loop
  ↓
POST /api/loop/:experimentID
  body: { name, trials: [1,2,3], repetitions: 2, randomize: true }
  ↓
Server:
  - Creates loop with ID "loop_{timestamp}"
  - Removes trials from timeline[]
  - Adds loop to timeline[]
  - Sets parentLoopId on trials 1, 2, 3
  - Updates branches on other items
  ↓
Frontend:
  - Updates parentLoopId on each trial: PATCH /api/trial/:id → { parentLoopId: "loop_xxx" }
  - Replaces temp loop ID with real ID
  ↓
Canvas: Shows loop node containing trials
```

### Flow 5: Run Experiment

```
User clicks "Run Experiment"
  ↓
Frontend generates code:
  - ExperimentBase: full timeline code
  - LoopTimelineCode: loop wrappers
  - TrialCode: individual trials
  ↓
POST /api/run-experiment/:experimentID
body: { generatedCode: "...", canvasStyles: { ... } }
  ↓
Server:
  - Resolves canvas styles (body → DB → appearance settings)
  - Copies experiment_template.html
  - Injects generated code + background CSS
  - Returns { experimentUrl: "http://localhost:3000/ExperimentName" }
  ↓
Frontend: Opens experimentURL in browser
```

### Flow 6: Publish Experiment

```
User clicks "Publish"
  ↓
Frontend generates PUBLIC code:
  - CDN plugin refs instead of local
  - base64 media instead of local files
  - DynamicPlugin from CDN
  ↓
POST /api/publish-experiment/:experimentID
body: { uid, storage, generatedPublicCode }
  ↓
Server:
  - Reads experiment HTML
  - Replaces local scripts with CDN versions
  - Injects only used plugins
  - Converts media files to base64
  - Sends to Firebase → GitHub Pages
  - Saves pagesUrl to experiment
  ↓
Returns { repoUrl, pagesUrl }
```

---

## Autosave Patterns

### Granular Field Autosave
Most individual fields save on blur:

```typescript
// Pattern: onBlur handler triggers save
<input
  value={trialName}
  onChange={(e) => setTrialName(e.target.value)}
  onBlur={() => saveName()}  // saves this single field
/>
```

### Debounced Autosave (Code Injection)
For text editors where frequent saves would be disruptive:

```typescript
// 1-second debounce before saving
const timeoutRef = useRef<NodeJS.Timeout | null>(null);

const debouncedSave = (value: string) => {
  if (timeoutRef.current) clearTimeout(timeoutRef.current);
  timeoutRef.current = setTimeout(() => {
    saveField("customOnStart", value);
  }, 1000);
};
```

### Save Indicator
Shows "✓ Saved" with field name for 1.5 seconds after each save:

```typescript
const showSaveIndicator = (fieldName?: string) => {
  setSavingField(fieldName || null);
  setSaveIndicator(true);
  setTimeout(() => {
    setSaveIndicator(false);
    setSavingField(null);
  }, 1500);
};
```

### Full Save (Manual)
The "Save" button calls `handleSave()` which does one `updateTrial()` with all fields. This is a fallback for when autosave may have been missed.

---

## Error Handling

All API calls have:
1. **Try/catch** wrapping fetch
2. **Response.ok** check
3. **On failure**: Reload timeline to restore consistent state
4. **Optional**: Update selectedTrial from fresh data

```typescript
try {
  const response = await fetch(...);
  if (!response.ok) throw new Error("Failed");
  // success path
} catch (error) {
  console.error("Error:", error);
  await getTimeline(); // Reload to restore consistency
  return null / false;
}
```

---

## Loop Timeline (SubCanvas) Pattern

When a loop is selected in the canvas, instead of the main timeline, the loop's internal structure is shown:

```
Main Canvas (timeline[])
  ↓ Loop selected
SubCanvas (loopTimeline[])
  - Shows trials inside the loop
  - Supports same operations (create, edit, branch, delete)
  - Items here have parentLoopId = loop.id
```

The `loopTimeline` is loaded via `getLoopTimeline(loopId)` which calls:
`GET /api/loop-trials-metadata/:experimentID/:loopId`

Returns metadata for all trials inside the loop (including branches recursively).

---

## File Upload Patterns

### Experiment Media Files
- Uploaded via `POST /api/upload-files/:experimentID` (multipart)
- Stored in `userDataRoot/{experimentName}/{type}/`
- Types: `img`, `aud`, `vid`, `others`
- Listed by `GET /api/list-files/{type}/:experimentID`

### Participant Files
- Uploaded during experiment (by participants via FileUploadResponseComponent)
- Sent as base64 in `POST /api/participant-files/:experimentID`
- Stored in `userDataRoot/{experimentName}/participant-files/`
- DB records track `sessionId` for session renaming support

### Serving Media
Media files are served by a middleware in `experiments.js` that matches paths like `/img/filename` and searches all experiment folders.

---

## Tunnel Management Pattern

Cloudflare tunnels provide public URLs for local experiments:
- Custom domain (persistent) or random `*.trycloudflare.com` (temporary)
- Settings stored per-experiment in `experiment.tunnelSettings`
- Auto-start on server boot if `persistent: true`
- Manual start/stop via API endpoints
