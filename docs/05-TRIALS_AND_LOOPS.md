# 05 - Trials, Loops & Timeline

## Timeline Architecture

The timeline is a **flat, normalized** ordered array. Trials and loops are stored separately in flat arrays within the same `ExperimentDoc`. The timeline references them by ID.

```
ExperimentDoc
├── timeline[]  → [{ id: 1, type: "trial", name: "T1" }, { id: "loop_2", type: "loop", name: "L1", trials: [3,4] }]
├── trials[]    → [{ id: 1, ... }, { id: 3, ... }, { id: 4, ... }]
└── loops[]     → [{ id: "loop_2", trials: [3,4], ... }]
```

### Key Properties
- Trials have numeric IDs (timestamps)
- Loops have string IDs (`"loop_" + timestamp`)
- `parentLoopId` links a trial (or nested loop) to its containing loop
- Nested loops are supported (a loop inside another loop)

---

## Trial Lifecycle

### Creation
1. User clicks "+" on timeline or drags a plugin from sidebar
2. Frontend calls `createTrial({ name, plugin, parameters, ... })`
3. `POST /api/trial/:experimentID` creates the trial in the DB
4. If no `parentLoopId`, trial is added to timeline
5. If `parentLoopId` is set, trial is only in `trials[]` (handled by loop)

### Selection
1. User clicks trial node in Canvas
2. `setSelectedTrial(trial)` is called
3. `TrialsConfig` useEffect loads trial data:
   - Restores name, columnMapping, extensions settings
   - Loads CSV data from parent loop (if `parentLoopId` exists)
   - Loads parent loop object
4. Configuration panel renders appropriate UI based on `plugin`

### Field Updates (Autosave)
Most fields autosave on blur/change:
- **Name**: `saveName()` → `saveField("name", value)` → `PATCH /api/trial/:id`
- **Column Mapping**: `saveColumnMapping(key, value)` → `saveField("columnMapping", updatedMapping)`
- **Extensions**: `saveExtensions(includeExt, extType)` → `saveField("parameters", {includesExtensions, extensionType})`
- **Code Injection**: `saveField("customOnStart", code)` → `PATCH /api/trial/:id`

### Manual Save
The "Save" button calls `handleSave()` which does one `updateTrial()` call with all fields.

### Deletion
1. Confirmation dialog
2. `deleteTrial(id)` → `DELETE /api/trial/:experimentID/:id`
3. Smart reconnect: parents get the deleted trial's children as new branches

---

## Loop System

### Loop State
```typescript
type Loop = {
  repetitions: number;           // How many times to repeat
  randomize: boolean;            // Randomize trial order inside
  orders: boolean;               // Order stimuli by CSV column
  orderColumns: string[];        // Which columns define ordering
  stimuliOrders: any[];         // Computed order arrays
  categories: boolean;           // Categorize by CSV column
  categoryColumn: string;        // Column for categories
  categoryData: any[];          // Category values
  isConditionalLoop: boolean;    // Loop based on conditions, not repetitions
  loopConditions: LoopCondition[];// Conditions for repeating
  trials: (string|number)[];    // IDs of contained trials & nested loops
  csvJson: any[];               // CSV data (loop-level)
  csvColumns: string[];         // CSV column names
};
```

### Loop Creation
1. User selects trials on canvas → "Create Loop"
2. `createLoop({ name, trials, ...config })` is called
3. `POST /api/loop/:experimentID`
4. Backend side effects:
   - Removes selected trials from main timeline
   - Adds loop to timeline
   - Sets `parentLoopId` on all contained trials
   - Updates branches on other items (replaces trial IDs with loop ID)
5. Frontend updates parentLoopId on each contained item

### Loop Selection
When a loop is selected in the canvas:
1. `getLoopTimeline(loopId)` fetches internal trial metadata
2. The loop's internal trials are displayed (SubCanvas)
3. `LoopsConfig` renders with loop settings
4. `LoopTimelineCode` generates the jsPsych code for the loop

### CSV at Loop Level
CSV is managed at the loop level:
- Upload CSV → `csvJson` + `csvColumns` saved on the loop
- Trials inside loop get `csvFromLoop = true` flag
- Trial's `columnMapping` references loop CSV columns

### Nested Loops
A loop inside another loop:
- Both have `parentLoopId` set
- The nested loop's trials appear in its parent's `loopTimeline`
- Deletion preserves structure appropriately

---

## Orders & Categories

Configured via `OrdersAndCategories` component:

### Orders (`Set orders`)
- **Purpose**: Define presentation order of stimuli across loop repetitions
- **How**: Select CSV columns → values are converted to 0-based indices → `stimuliOrders` array
- **Example**: CSV column `order` = `[3, 1, 2]` → stimuli appear in that order each repetition

### Categories (`Set category column`)
- **Purpose**: Group stimuli by category for analysis
- **How**: Select one CSV column → values stored in `categoryData`
- **Example**: CSV column `condition` = `["A", "A", "B", "B"]` → stimuli grouped into categories

---

## Trial Code Injection

Four lifecycle hooks with code editors:

### 1. `initialize`
- Runs before trial timeline starts
- Async-capable (can return a Promise)
- Used for preloading resources, setting up external hardware

### 2. `on_start` (Builder-Managed)
- Runs before each trial execution
- **Automatically generated**: Includes paramsOverride logic and CSV variable injection
- User code is appended to the generated code
- Has access to trial parameters

### 3. `on_load`
- Runs once the stimulus is displayed and ready
- Used for DOM manipulation, animations, dynamic content

### 4. `on_finish` (Builder-Managed)
- Runs after trial ends, before transitioning to next trial
- **Automatically generated**: Includes branching/jump logic (branchConditions + repeatConditions)
- User code is appended
- Has access to trial data

### Code Generation Functions
These are in `TrialCode/TrialCodeGenerators.ts`:
- `generateInitializeCode(userCode)` → wraps user code in `initialize: async function() {...}`
- `generateOnStartCode({ paramsOverride, isInLoop, getVarName, customOnStart })` → params override + variable injection + user code
- `generateOnLoadCode(userCode)` → wraps in `on_load: function() {...}`
- `generateOnFinishCode({ branches, branchConditions, repeatConditions, isInLoop, getVarName, customOnFinish })` → branching logic + user code

---

## CSV Integration

### The Golden Rule: Loop CSV Owns Trial CSV

**When a trial is inside a loop that has CSV, the trial inherits the loop's CSV and its own `csvJson` is ignored at code generation time.** This is enforced at `generateTrialLoopCodes.ts:197-200`:

```typescript
const effectiveCsvJson =
  fullTrial.csvFromLoop && loopCsvJson && loopCsvJson.length > 0
    ? loopCsvJson             // loop CSV wins — trial's own csvJson is IGNORED
    : fullTrial.csvJson || []; // trial's own CSV only used if NOT in a loop with CSV
```

**Consequences:**
- A trial inside a loop with CSV **cannot** have its own independent CSV
- The trial's `columnMapping` references the **loop's** CSV columns, not its own
- To give a trial its own different CSV, it must be placed **outside** any loop that has CSV (or in a loop that has no CSV)
- A trial with `csvJson` that gets added to a loop with its own CSV will silently lose its original csvJson at runtime

### Data Flow
1. CSV uploaded in `LoopsConfig` → `handleCsvUpload()` → data stored on loop as `loop.csvJson` + `loop.csvColumns`
2. Loop's `csvColumns` are available for column mapping in child trials
3. Trial's `ParameterMapper` shows the **loop's** CSV columns as dropdown options (via `getLoopCsvData()` which fetches `parentLoop.csvColumns`)
4. `columnMapping` stores `{ source: "csv", value: "columnName" }` entries referencing the loop's columns
5. At code generation time, CSV data is injected as `timeline_variables` arrays

### What Happens When a Loop Gets CSV
1. User uploads CSV on the loop → `saveCsvData()` stores it
2. `saveCsvData()` automatically sets `csvFromLoop = true` on ALL trials inside the loop:
   ```typescript
   for (const trialId of loop.trials) {
     await updateTrialField(trialId, "csvFromLoop", true);
   }
   ```
3. Any trial added to the loop later gets `csvFromLoop = true` (via `SubCanvas/Actions.ts`)
4. The UI locks: trial shows "Using CSV from loop" with a disabled toggle
5. If the loop's CSV is deleted, `csvFromLoop` is set to `false` on all child trials

### Column Mapping Engine
Each parameter in `columnMapping` has:
- `source`: `"csv"` (read from CSV column) | `"typed"` (direct value) | `"none"` (use default)
- `value`: The CSV column name or typed value

### CSV Propagation (Loop Save)
When CSV is updated in a loop, all child trials get `csvFromLoop` flag updated via `updateTrialField(trialId, "csvFromLoop", hasCsv)`. Additionally, `csvColumns` are propagated to the loop's `orderColumns` and `categoryColumn` dropdowns.

---

## Loop Timeline Code

Loops generate jsPsych timeline code that:
1. Creates a `jsPsychTimelineVariable` array from CSV data
2. Uses `jsPsych.randomization.sampleWithReplacement` or `repeat` for repetition
3. Optionally randomizes with `jsPsych.randomization.shuffle`
4. Handles orders via `jsPsych.randomization.shuffle` with stimuli orders
5. Handles conditional loops with `conditional_function` that evaluates `loopConditions`
