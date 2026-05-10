# 01 - System Architecture

## Overview

The JsPsych Builder is an Electron/React desktop application for visually designing, running, and publishing jsPsych experiments. It runs a local Express.js server that serves both the React SPA frontend and experiment HTML files.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│  Electron Shell (main process)                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  React SPA (Vite) -- localhost:5173            │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │  ExperimentBuilder                       │  │  │
│  │  │  ├─ Timeline (Canvas + Drag & Drop)      │  │  │
│  │  │  ├─ ConfigurationPanel                   │  │  │
│  │  │  │  ├─ TrialsConfiguration               │  │  │
│  │  │  │  │  ├─ TrialMetaConfig                │  │  │
│  │  │  │  │  ├─ ParameterMapper / TabContent   │  │  │
│  │  │  │  │  ├─ TrialCodeInjection             │  │  │
│  │  │  │  │  ├─ BranchedTrial (modal)          │  │  │
│  │  │  │  │  ├─ ParamsOverride (modal)         │  │  │
│  │  │  │  │  ├─ LoopsConfiguration             │  │  │
│  │  │  │  │  └─ Webgazer                       │  │  │
│  │  │  │  └─ Settings & Controls               │  │  │
│  │  │  └─ ResultsList                          │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │  ExperimentPanel                                │  │
│  │  ├─ Preview / Local / Online Results            │  │
│  │  └─ ExperimentSettings                          │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  Express Server (port 3000)                          │
│  ┌───────────────────────────────────────────────┐  │
│  │  Routes:                                       │  │
│  │  ├─ /api/experiments/* (CRUD)                 │  │
│  │  ├─ /api/trial/* (trial CRUD)                 │  │
│  │  ├─ /api/loop/* (loop CRUD)                   │  │
│  │  ├─ /api/timeline/* (timeline ordering)       │  │
│  │  ├─ /api/timeline-code/* (code retrieval)     │  │
│  │  ├─ /api/run-experiment/* (compile & serve)   │  │
│  │  ├─ /api/publish-experiment/* (GitHub Pages)  │  │
│  │  ├─ /api/configs/* (save/load configs)         │  │
│  │  ├─ /api/plugins/* (custom plugins CRUD)      │  │
│  │  ├─ /api/results/* (session results)          │  │
│  │  ├─ /api/files/* (multimedia upload)          │  │
│  │  ├─ /api/tunnel/* (Cloudflare tunnel)         │  │
│  │  ├─ /api/db/* (db export/import)              │  │
│  │  ├─ /:experimentID (serve experiment HTML)     │  │
│  │  └─ /:experimentID/preview (serve trial preview)│  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  Local Storage                                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  userDataRoot/database/db.json (LowDB)         │  │
│  │  userDataRoot/{experimentName}/img|aud|vid/    │  │
│  │  userDataRoot/experiments_html/                 │  │
│  │  userDataRoot/trials_previews_html/            │  │
│  │  userDataRoot/plugins/                          │  │
│  │  userDataRoot/templates/                        │  │
│  │  userDataRoot/participant-files/                │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Directory Structure

```
JsPsych/
├── client/                          # React frontend (Vite)
│   └── src/
│       └── pages/
│           ├── ExperimentBuilder/    # Main experiment designer
│           │   ├── components/
│           │   │   ├── Timeline/     # Visual trial timeline (Canvas)
│           │   │   └── ConfigurationPanel/  # Right panel config
│           │   │       ├── TrialsConfiguration/
│           │   │       │   ├── index.tsx             # Main trial config
│           │   │       │   ├── TabContent.tsx         # Dynamic plugin tabs
│           │   │       │   ├── ParameterMapper/       # Native plugin params
│           │   │       │   ├── TrialDesigner/         # Visual canvas designer
│           │   │       │   ├── BranchedTrial/         # Branching UI
│           │   │       │   │   └── BranchConditions/
│           │   │       │   │       └── ConditionsList/
│           │   │       │   │           └── ParameterOverride/
│           │   │       │   ├── ParamsOverride/        # Param override UI
│           │   │       │   ├── LoopsConfiguration/    # Loop settings
│           │   │       │   ├── OrdersAndCategories/   # Orders & categories
│           │   │       │   ├── Webgazer/              # WebGazer config
│           │   │       │   ├── TrialCodeInjection/    # Code injection
│           │   │       │   └── Extensions/            # jsPsych extensions
│           │   │       └── types/index.ts             # Shared type defs
│           │   ├── contexts/          # React contexts
│           │   │   └── TrialsContext.ts
│           │   ├── providers/         # Context providers (API layer)
│           │   │   ├── TrialsProvider/
│           │   │   ├── PluginsProvider.tsx
│           │   │   ├── DevModeProvider.tsx
│           │   │   └── CanvasStylesProvider.tsx
│           │   └── hooks/            # Custom hooks
│           │       ├── useTrials.ts
│           │       ├── useExperimentID.ts
│           │       └── ...
│           └── ExperimentPanel/      # Experiment results/settings
│
├── server/                           # Express backend
│   ├── index.js                      # Server entry point
│   ├── routes/                       # API routes
│   │   ├── experiments.js            # Experiment CRUD, publish, run
│   │   ├── configs.js                # Config save/load
│   │   ├── plugins.js                # Custom plugins management
│   │   ├── results.js                # Session results
│   │   ├── files.js                  # File upload/serve
│   │   ├── db.js                     # DB export/import/reset
│   │   ├── tunnel.js                 # Cloudflare tunnel
│   │   └── timeline/                 # Normalized trial/loop API
│   │       ├── index.js              # Timeline, validate, names
│   │       ├── trials.js             # Trial CRUD
│   │       └── loops.js              # Loop CRUD
│   ├── utils/                        # Shared utilities
│   │   ├── db.js                     # LowDB setup + ensureDbData()
│   │   ├── templates.js              # HTML template management
│   │   ├── plugin-scripts.js         # CDN plugin URL resolution
│   │   └── paths.js                  # __dirname/__filename helpers
│   └── dynamicplugin/                # Custom DynamicPlugin
│       ├── index.ts                  # Plugin entry (trial method)
│       ├── components/               # Stimulus components
│       └── response_components/      # Response components
│
└── templates/                        # HTML templates for experiments
    ├── experiment_template.html
    └── trials_preview_template.html
```

## Design Patterns

### Flat Normalization (Timeline)
Trials and loops are stored in separate flat arrays within the experiment document, linked by IDs. The `timeline` array defines order. This avoids deep nesting and simplifies CRUD operations.

### Optimistic UI
All mutations (create, update, delete) update the UI first, then the backend. On failure, the timeline is reloaded. This provides instant feedback.

### Autosave
Most trial/loop fields autosave on blur/change via `updateTrialField`/`updateLoopField`. A save indicator shows status. Manual "Save" button exists as fallback.

### Code Generation
Trial code (jsPsych JavaScript) is generated dynamically at execution time, not stored redundantly in the database. The `trialCode` field exists only for WebGazer and edge cases.

### React Context + Providers
State flows: Provider → Context → hooks → components. The `TrialsProvider` wraps the entire ExperimentBuilder and exposes all trial/loop CRUD operations.

### Column Mapping Engine
Plugin parameters are mapped to values via `ColumnMapping = Record<string, ColumnMappingEntry>` where each entry has:
- `source`: `"csv"` | `"typed"` | `"none"`
- `value`: The actual value (column reference or typed value)
