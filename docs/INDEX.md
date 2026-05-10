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
| [06-BRANCHING.md](06-BRANCHING.md) | Branch conditions, repeat/jump conditions, params override, rule system, condition matching |
| [07-DYNAMIC_PLUGIN.md](07-DYNAMIC_PLUGIN.md) | Component types, canvas system, visual designer, screen layout resolution, data collection |
| [08-EXECUTION.md](08-EXECUTION.md) | Code generation, experiment compilation, preview, local run, Cloudflare publishing |
| [09-CLIENT_SERVER.md](09-CLIENT_SERVER.md) | Providers, context, hooks, optimistic UI, data flow, autosave patterns |
| [10-EXPERIMENT_CONFIG.md](10-EXPERIMENT_CONFIG.md) | Experiment settings: batch config, recruitment (Prolific/MTurk), CAPTCHA (hCaptcha/reCAPTCHA), session naming, appearance, Cloudflare tunnel |
| [11-DEVMODE.md](11-DEVMODE.md) | DevMode system, custom code components, jsPsych init overrides, pre-init code, code generation integration |
| [12-PUBLISH_FLOW.md](12-PUBLISH_FLOW.md) | CSV handling (parse/generate), multimedia file upload/management, complete publish pipeline, local vs public code differences, chat agent tool flow |
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
