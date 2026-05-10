# 02 - Data Model

## Database (LowDB)

All data is stored in a single JSON file (`database/db.json`). The schema is initialized by `ensureDbData()` in `server/utils/db.js`.

### Collections (Top-level keys)

| Collection | Type | Purpose |
|-----------|------|---------|
| `experiments` | `Array<Experiment>` | Experiment metadata |
| `trials` | `Array<ExperimentDoc>` | One doc per experiment containing trials + loops + timeline |
| `configs` | `Array<ConfigDoc>` | Experiment configurations and DevMode state |
| `pluginConfigs` | `Array<PluginConfigDoc>` | Custom user plugins (single document) |
| `sessionResults` | `Array<SessionDoc>` | Participant session data |
| `participantFiles` | `Array<ParticipantFile>` | Files uploaded by participants |
| `chat` | `Object` | Chat agent settings (API keys, provider, conversations) |

---

## Core Type Definitions

### Experiment

```typescript
type Experiment = {
  experimentID: string;      // UUID
  name: string;              // Display name
  description?: string;
  author?: string;
  createdAt: string;         // ISO date
  updatedAt: string;         // ISO date
  storage?: string;          // "googledrive" | "dropbox"
  pagesUrl?: string;         // GitHub Pages URL (after publish)
  tunnelUrl?: string;        // Active Cloudflare tunnel URL
  appearanceSettings?: {
    backgroundColor: string; // Hex color
    fullScreen: boolean;
    progressBar: boolean;
  };
  tunnelSettings?: {
    hostname: string;        // Custom domain or empty
    persistent: boolean;     // Keep tunnel on across restarts
  };
};
```

### ExperimentDoc (the `trials` collection)

```typescript
type ExperimentDoc = {
  experimentID: string;
  trials: Trial[];           // All trials in the experiment
  loops: Loop[];             // All loops in the experiment
  timeline: TimelineItem[];  // Ordered list of top-level items
  createdAt: string;
  updatedAt: string;
};
```

### Trial

```typescript
type Trial = {
  // Identity
  id: number;                // Timestamp-based (Date.now())
  name: string;
  type: string;              // Always "trial"

  // Plugin
  plugin?: string;           // e.g. "plugin-html-keyboard-response", "plugin-dynamic", "webgazer"
  parameters: Record<string, any>;  // Plugin parameters (includes extensions toggle)
  trialCode?: string;        // Generated jsPsych code (WebGazer only; dynamic for others)

  // Column Mapping
  columnMapping?: ColumnMapping;   // Maps params to CSV columns or typed values
  csvJson?: any[];                 // CSV data rows (loop-level; may be empty for trials)
  csvColumns?: string[];           // CSV column names
  csvFromLoop?: boolean;           // True if trial uses parent loop's CSV

  // Orders & Categories
  orders?: boolean;
  stimuliOrders?: any[];
  orderColumns?: string[];
  categories?: boolean;
  categoryColumn?: string;
  categoryData?: any[];

  // Branching
  branches?: Array<string | number>;          // Connected trials/loops (same scope)
  branchConditions?: BranchCondition[];        // Conditional branching within scope
  repeatConditions?: RepeatCondition[];        // Jump conditions (any target)
  paramsOverride?: ParamsOverrideCondition[];  // On-start param overrides

  // Code Injection
  customInitialize?: string;   // User code for initialize hook
  customOnStart?: string;      // User code for on_start hook
  customOnLoad?: string;       // User code for on_load hook
  customOnFinish?: string;     // User code for on_finish hook

  // Hierarchy
  parentLoopId?: string | null;  // Loop ID if this trial is inside a loop
};
```

### Loop

```typescript
type Loop = {
  // Identity
  id: string;                // "loop_" + timestamp
  name: string;

  // Loop configuration
  repetitions: number;       // Number of repetitions (1+)
  randomize: boolean;        // Randomize order of trials inside

  // CSV
  csvJson?: any[];           // CSV data (managed at loop level)
  csvColumns?: string[];     // CSV column names

  // Orders & Categories
  orders: boolean;            // Enable stimulus ordering
  stimuliOrders: any[];       // Computed order arrays
  orderColumns: string[];     // Selected order columns from CSV
  categories: boolean;        // Enable categorization
  categoryColumn: string;     // Selected category column
  categoryData: any[];        // Category values from CSV

  // Contents
  trials: (string | number)[];  // IDs of trials inside this loop

  // Branching
  branches?: Array<string | number>;
  branchConditions?: BranchCondition[];
  repeatConditions?: RepeatCondition[];

  // Conditional Loop
  isConditionalLoop?: boolean;
  loopConditions?: LoopCondition[];  // Conditions that keep loop repeating

  // Generated code
  code?: string;

  // Hierarchy
  parentLoopId?: string | number | null;  // Parent loop ID for nested loops

  // Code injection at loop level
  customOnTimelineStart?: string;
  customOnTimelineFinish?: string;
};
```

### TimelineItem

```typescript
type TimelineItem = {
  id: string | number;           // Trial ID (number) or Loop ID (string "loop_xxx")
  type: "trial" | "loop";
  name: string;
  branches?: (string | number)[]; // Connected items (visual arrows)
  trials?: (string | number)[];   // For loops: IDs of contained trials
};
```

The `timeline` is a flat, ordered array. Loops are top-level items that contain trial IDs. When a loop is selected, a separate `loopTimeline` is loaded showing the loop's internal structure.

---

### BranchCondition

```typescript
type BranchCondition = {
  id: number;           // Unique condition ID
  rules: Rule[];        // AND conditions (all must match)
  nextTrialId: number | string | null;  // Target trial/loop (must be in branches[])
  customParameters?: Record<string, ColumnMappingEntry>;  // Params to override
};
```

### RepeatCondition (Jump)

```typescript
type RepeatCondition = {
  id: number;
  rules: Rule[];
  jumpToTrialId: number | string | null;  // Target trial/loop (ANY in experiment)
  // NOTE: No customParameters support for jumps
};
```

### Rule (used by BranchCondition, RepeatCondition, LoopCondition, ParamsOverride)

```typescript
type Rule = {
  column: string;       // Direct column name from trial data
                        // e.g. "response", "ButtonResponseComponent_1_response", "rt"
  op: string;           // Comparison operator: "==", "!=", ">", "<", ">=", "<=", "includes"
  value: string;        // Threshold value to compare against
  // Legacy fields (still present for backward compat):
  prop?: string;
  fieldType?: string;
  componentIdx?: string;
};
```

### ParamsOverrideCondition

```typescript
type ParamsOverrideCondition = {
  id: number;
  rules: ParamsOverrideRule[];  // AND conditions (referencing other trials' data)
  paramsToOverride: Record<string, ColumnMappingEntry>;  // Own params to override
};

type ParamsOverrideRule = {
  trialId: string | number;  // Which trial's data to check
  column: string;            // Which column in that trial's data
  op: string;                // Comparison operator
  value: string;             // Threshold value
};
```

**Key difference**: ParamsOverride runs `on_start` and overrides the **current trial's own** parameters based on conditions from **previous trials**. BranchConditions run `on_finish` and navigate to **other trials** based on conditions.

### LoopCondition

```typescript
type LoopCondition = {
  id: number;
  rules: LoopConditionRule[];  // AND conditions
};

type LoopConditionRule = {
  trialId: string | number;  // Which trial's data to check
  column: string;
  op: string;
  value: string;
};
```

When a loop has loop conditions, it repeats based on data from its trials rather than a fixed `repetitions` count.

---

### ColumnMapping

```typescript
type ColumnValueType = "csv" | "typed" | "none";

type ColumnMappingEntry = {
  source: ColumnValueType;
  value: string | number | boolean | any[] | coordinates | undefined | null;
};

type ColumnMapping = Record<string, ColumnMappingEntry>;
// Example:
// {
//   "stimulus": { source: "csv", value: "image_column" },
//   "trial_duration": { source: "typed", value: 2000 },
//   "response_ends_trial": { source: "typed", value: true }
// }
```

**For Dynamic Plugin**: The columnMapping can contain nested component arrays:
```typescript
columnMapping: {
  "components": {
    source: "typed",
    value: [
      {
        name: { source: "typed", value: "ImageComponent_1" },
        type: { source: "typed", value: "ImageComponent" },
        stimulus: { source: "csv", value: "image_url" },
        coordinates: { source: "typed", value: { x: -30, y: 20 } },
        // ... other component-specific params
      }
    ]
  },
  "response_components": { ... },
  "trial_duration": { source: "typed", value: null },
  "response_ends_trial": { source: "typed", value: true },
  "__canvasStyles": { source: "typed", value: { width: 1024, height: 768 } }
}
```

---

### Plugin Parameters (FieldDefinition)

```typescript
type FieldDefinition = {
  label: string;       // Human-readable parameter name
  key: string;         // Parameter key matching jsPsych plugin API
  type: FieldType;     // Data type
  default: DefaultValue; // Default value
};

type FieldType =
  | "string" | "html_string" | "number" | "boolean" | "function"
  | "coordinates" | "object"
  | "string_array" | "number_array" | "boolean_array"
  | "undefined" | "null";
```

---

### ConfigDoc

```typescript
type ConfigDoc = {
  experimentID: string;
  data: {
    generatedCode?: string;  // Cached experiment code
    // ... other config data
  };
  isDevMode: boolean;
  isSaveMode: boolean;
  sessionNameConfig?: {
    tokens: Array<{type: string, value: string}>;
    separator: string;
  };
  createdAt: string;
  updatedAt: string;
};
```

### SessionDoc

```typescript
type SessionDoc = {
  experimentID: string;
  sessionId: string;      // Unique session ID (can be custom names)
  createdAt: string;
  data: any[];            // Array of trial response objects
  state: "initiated" | "in-progress" | "completed";
  lastUpdate: string;
  metadata: {
    browser?: string;
    browserVersion?: string;
    os?: string;
    screenResolution?: string;
    language?: string;
    startedAt?: string;
  };
  isOnline?: boolean;     // True if data is stored in cloud, metadata locally
};
```

### ParticipantFile

```typescript
type ParticipantFile = {
  id: string;             // UUID
  experimentID: string;
  sessionId: string | null;
  filename: string;       // On-disk filename
  originalName: string;   // Original upload name
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
};
```

---

## Data Relationships

```
Experiment (experiments[])
  └── ExperimentDoc (trials[])
        ├── Trial[] (trials in experiment)
        │     ├── branches[] → other Trial/Loop IDs
        │     ├── branchConditions[] → navigate within branches[]
        │     ├── repeatConditions[] → navigate to any Trial/Loop
        │     ├── paramsOverride[] → conditional param changes
        │     └── parentLoopId → Loop
        ├── Loop[] (loops in experiment)
        │     ├── trials[] → Trial IDs inside loop
        │     ├── branches[] → other Trial/Loop IDs
        │     ├── loopConditions[] → repeat conditions
        │     └── parentLoopId → parent Loop (nested)
        └── TimelineItem[] (ordered display)
              ├── type: "trial" → Trial
              └── type: "loop" → Loop

Config (configs[])
  └── experimentID → Experiment

SessionResult (sessionResults[])
  ├── experimentID → Experiment
  └── sessionId (unique per experiment)

ParticipantFile (participantFiles[])
  └── experimentID + sessionId → SessionResult
```
