# JsPsych Builder - Application Documentation

This documentation covers the complete architecture, data model, API, and systems of the JsPsych Builder application. Designed for both developers and LLMs performing code-assistance tasks.

## Document Index

| Document | Description |
|----------|-------------|
| [01-ARCHITECTURE.md](01-ARCHITECTURE.md) | System overview, tech stack, directory structure, and design patterns |
| [02-DATA_MODEL.md](02-DATA_MODEL.md) | Full type definitions for Experiments, Trials, Loops, Timeline, Conditions, CSV mappings |
| [03-API.md](03-API.md) | Every API endpoint: experiments, trials, loops, configs, plugins, results, files, tunnel, DB |
| [04-PLUGINS.md](04-PLUGINS.md) | Plugin system: native jsPsych, custom/user plugins, metadata extraction, CDN resolution |
| [05-TRIALS_AND_LOOPS.md](05-TRIALS_AND_LOOPS.md) | Trial lifecycle, loop system, orders & categories, CSV integration, code injection hooks |
| [06-BRANCHING.md](06-BRANCHING.md) | Explicit branching, default destinations, parameter overrides, loops and resume |
| [temporary-migrations.md](temporary-migrations.md) | Temporary tester migrations, current status, and the code and tests to retire before the release for users |
| [retrocompatibility-removal-sdd.md](retrocompatibility-removal-sdd.md) | Spec for removing old public session protocols and historical recovery, updating a finite set of existing experiments, and deleting temporary converters after validation |
| [publication-versioning-removal-sdd.md](publication-versioning-removal-sdd.md) | Publication history retirement: one current HTML, per-session configuration, compatible resume, TDD results and deferred checks; existing GitHub/Firestore cleanup belongs to the user |
| [public-settings-sdd.md](public-settings-sdd.md) | Spec pending implementation: save IndexedDB, batch, timeout, recruitment and CAPTCHA settings without republishing; keep session naming and appearance tied to publication; isolate saves and preserve existing sessions |
| [cost-benchmarking-sdd.md](cost-benchmarking-sdd.md) | Implemented cost benchmarking: observers, monetary calculations, persistence reference, strict comparisons and CI |
| [cost-benchmarking-repeatability-sdd.md](cost-benchmarking-repeatability-sdd.md) | Validated controlled inputs and timing, repetition contracts, three independent matrices and the registered cost reference |
| [Persistence cost analysis](investigaciones/persistence-cost-analysis-2026-11-13.md) | Cost breakdown and evidence for a future optimization spec: idle work, handlers, per-event operations, retention and index-model limitations |
| [public-session-cost-optimization-sdd.md](public-session-cost-optimization-sdd.md) | Deliveries 1–2 verified; deliveries 3–4 pass functional and operation targets, with strict cost acceptance pending; delivery 5 pending |
| [Session reconciliation cost comparison](investigaciones/session-reconciliation-cost-2026-11-14.md) | Delivery 3 evidence: one scheduled job, lower fixed cost and three expiry storage increases rejected by the strict policy |
| [Session export cost comparison](investigaciones/session-export-cost-2026-11-14.md) | Delivery 4 evidence: fewer dispatch reads, no empty job write and a coherent preparation view; lower variable costs with temporal storage increases still rejected |
| [public-session-release-plan.md](public-session-release-plan.md) | Current publication flow, reproducible verification and a concrete test experiment; no historical recovery or general republication steps |
| [dynamic-plugin-proportional-scaling-sdd.md](dynamic-plugin-proportional-scaling-sdd.md) | Implemented proportional scaling with a shared internal 2560 × 1450 scene, editor/runtime geometry, input mapping, graphics resolution, verification results and pending npm distribution |
| [unified-branching-contract-sdd.md](unified-branching-contract-sdd.md) | Single Branching contract, scope entries, loops, persistence, resume and TDD acceptance criteria |
| [experiment-background-sdd.md](experiment-background-sdd.md) | Single experiment background for local execution, preview and publication; removal of per-trial background copies and verification results |
| [07-DYNAMIC_PLUGIN.md](07-DYNAMIC_PLUGIN.md) | Component types, canvas system, visual designer, proportional scene scaling, data collection |
| [08-EXECUTION.md](08-EXECUTION.md) | Code generation, experiment compilation, preview, local run, Cloudflare publishing |
| [09-CLIENT_SERVER.md](09-CLIENT_SERVER.md) | Providers, context, hooks, optimistic UI, data flow, autosave patterns |
| [10-EXPERIMENT_CONFIG.md](10-EXPERIMENT_CONFIG.md) | Experiment settings: batch config, recruitment (Prolific/MTurk), CAPTCHA (hCaptcha/reCAPTCHA), session naming, appearance, Cloudflare tunnel |
| [public-session-persistence-sdd.md](public-session-persistence-sdd.md) | Implemented public session persistence: IndexedDB, batching, shared timeout, stable identity, verified export, recovery after expiry and the recorded deliveries |
| [11-DEVMODE.md](11-DEVMODE.md) | DevMode system, custom code components, jsPsych init overrides, pre-init code, code generation integration |
| [12-PUBLISH_FLOW.md](12-PUBLISH_FLOW.md) | CSV handling (parse/generate), multimedia file upload/management, complete publish pipeline, local vs public code differences, experiment creation flow |
| [13-CODE_GENERATION.md](13-CODE_GENERATION.md) | Full code generation pipeline: generateTrialLoopCodes, useLoopCode, ExperimentBase, execution order, local vs public config comparison |

## Quick Reference

### Key File Paths

**Frontend Entry Points:**
- Experiment Builder: `client/src/pages/ExperimentBuilder/`
- Experiment Panel: `client/src/pages/ExperimentPanel/`
- Trial Configuration (main): `client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/index.tsx`

**Server Entry Points:**
- Main server: `server/index.js`
- Routes: `server/routes/`
- Dynamic Plugin: `server/dynamicplugin/`

**State Management:**
- Trials Context: `client/src/pages/ExperimentBuilder/contexts/TrialsContext.ts`
- Trials Provider: `client/src/pages/ExperimentBuilder/providers/TrialsProvider/`
- Hooks: `client/src/pages/ExperimentBuilder/hooks/`

**Database:**
- DB config: `server/utils/db.js`
- Schema initialization: `server/utils/db.js::ensureDbData()`

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, React Router |
| Backend | Express.js (Node.js) |
| Database | LowDB (JSON file-based) |
| State | React Context + Providers |
| Styling | Inline styles + CSS variables |
| Cloud | Firebase Functions, GitHub Pages, Cloudflare Tunnel |
| Experiment Runtime | jsPsych 8.2.2 |
