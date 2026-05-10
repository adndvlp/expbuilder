# 03 - API Reference

All routes are prefixed with the Express server URL. `experimentID` refers to the UUID of the experiment.

## Experiments (`server/routes/experiments.js`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/load-experiments` | List all experiments sorted by newest first |
| GET | `/api/experiment/:experimentID` | Get a single experiment by ID |
| POST | `/api/create-experiment` | Create new experiment. Body: `{ name, description?, author?, uid?, storage? }` |
| DELETE | `/api/delete-experiment/:experimentID` | Delete experiment + trials + configs + results + HTML + files. Body: `{ uid? }` |
| POST | `/api/run-experiment/:experimentID` | Compile experiment to HTML. Body: `{ generatedCode, canvasStyles? }` |
| POST | `/api/trials-preview/:experimentID` | Compile trial preview HTML. Body: `{ generatedCode, canvasStyles? }` |
| GET | `/:experimentID` | Serve compiled experiment HTML |
| GET | `/:experimentID/preview` | Serve compiled trial preview HTML |
| POST | `/api/publish-experiment/:experimentID` | Publish to GitHub Pages. Body: `{ uid, storage?, generatedPublicCode }` |
| GET | `/api/appearance-settings/:experimentID` | Get appearance settings |
| PUT | `/api/appearance-settings/:experimentID` | Save appearance settings. Body: `{ backgroundColor, fullScreen, progressBar }` |

### Static File Serving
- Files under `{experimentName}/img|aud|vid|others/` are served at matching URL paths
- Pattern: `/:anything/img/filename` etc.

---

## Trials (`server/routes/timeline/trials.js`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trials-metadata/:experimentID` | Get full timeline with metadata (no trial code) |
| GET | `/api/trials-extensions/:experimentID` | Get unique extensions used by trials |
| POST | `/api/trial/:experimentID` | Create trial. Body: `Trial` (without id) |
| GET | `/api/trial/:experimentID/:id` | Get single trial by ID |
| PATCH | `/api/trial/:experimentID/:id` | Partial update trial. Supports granular field updates |
| DELETE | `/api/trial/:experimentID/:id` | Delete trial. Smart reconnect: parents → children |
| DELETE | `/api/trials/:experimentID` | Delete all trials for experiment |

### Smart Delete Behavior (Trials)
When a trial is deleted, all parents that had it in their `branches[]` are reconnected to the deleted trial's children:
```
Before: Trial0 → Trial1 → [Trial2, Trial3]
Delete Trial1 → Trial0 → [Trial2, Trial3]
```

---

## Loops (`server/routes/timeline/loops.js`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/loop/:experimentID` | Create loop. Body: `{ name, trials[], ...loopConfig }`. Auto-updates parentLoopId on trials |
| GET | `/api/loop/:experimentID/:id` | Get single loop with trials metadata |
| GET | `/api/loop-trials-metadata/:experimentID/:loopId` | Get trials within a loop (recursive for branches) |
| PATCH | `/api/loop/:experimentID/:id` | Partial update loop. Syncs parentLoopId on trial add/remove |
| DELETE | `/api/loop/:experimentID/:id` | Delete loop. Restores trials to timeline. Smart reconnect |

### Smart Delete Behavior (Loops)
```
Before: Trial0 → Loop1 [TrialA, TrialB] → TrialC
Delete Loop1:
  - Trial0 → TrialA (first item of loop)
  - TrialB → TrialC (last item gets loop's branches)
  - TrialA, TrialB restored to timeline
```

### Loop Creation Side Effects
1. Removes trials from main timeline
2. Sets `parentLoopId` on all contained trials/loops
3. Updates branches on other items that referenced contained trials (replaces trial IDs with loop ID)

---

## Timeline (`server/routes/timeline/index.js`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/timeline-code/:experimentID` | Get all generated code (trial codes + loop codes) |
| PATCH | `/api/timeline/:experimentID` | Update timeline order (drag & drop). Body: `{ timeline[] }` |
| GET | `/api/timeline-names/:experimentID` | Get all trial/loop names for uniqueness validation |
| GET | `/api/validate-ancestor/:experimentID` | Check if source is ancestor of target. Query: `source`, `target` |
| GET | `/api/validate-connection/:experimentID` | Validate branch connection (no self-connect, no cycles) |

---

## Configs (`server/routes/configs.js`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/load-config/:experimentID` | Load experiment config + DevMode + SaveMode status |
| POST | `/api/save-config/:experimentID` | Save config. Body: `{ config, isDevMode, isSaveMode }` |
| GET | `/api/session-name-config/:experimentID` | Get session name configuration |
| POST | `/api/session-name-config/:experimentID` | Save session name config. Body: `{ tokens[], separator }` |

---

## Plugins (`server/routes/plugins.js`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/plugins-list` | List all plugin metadata files (names) |
| GET | `/api/metadata/*` | Serve static plugin metadata JSON files |
| GET | `/api/components-metadata/*` | Serve component metadata JSON |
| GET | `/api/component-metadata/:componentType` | Get metadata for a specific component |
| GET | `/api/load-plugins` | Get all custom user plugins |
| POST | `/api/save-plugin/:id` | Save custom plugin. Body: `{ name, scripTag, pluginCode }` |
| DELETE | `/api/delete-plugin/:index` | Delete custom plugin and its artifacts |

### Plugin Save Flow
1. Save plugin data to DB
2. Write plugin file to `userDataRoot/plugins/`
3. Update experiment and preview HTML templates with plugin script tag
4. Run `extract-metadata.mjs` to regenerate plugin metadata JSON

---

## Results (`server/routes/results.js`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/append-result/:experimentID` | Create new session. Body: `{ sessionId, metadata? }` |
| PUT | `/api/append-result/:experimentID` | Append trial result to session. Body: `{ sessionId, response }` |
| GET | `/api/session-results/:experimentID` | List session metadata (no data) |
| GET | `/api/participant-number/:experimentID` | Get next participant number |
| GET | `/api/download-session/:sessionId/:experimentID` | Download session as CSV |
| POST | `/api/download-sessions-zip` | Download multiple sessions as ZIP. Body: `{ sessionIds[], experimentID }` |
| POST | `/api/complete-session/:experimentID` | Mark session as completed. Body: `{ sessionId }` |
| POST | `/api/save-online-session-metadata/:experimentID` | Save online session metadata. Body: `{ sessionId, metadata?, state? }` |
| PATCH | `/api/rename-session/:experimentID` | Rename session. Body: `{ oldSessionId, newSessionId }` |
| DELETE | `/api/session-results/:sessionId/:experimentID` | Delete session + participant files |

---

## Files (`server/routes/files.js`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload-files/:experimentID` | Upload multimedia (multipart). Auto-classifies into img/aud/vid/others |
| GET | `/api/list-files/:type/:experimentID` | List files by type (`all`, `img`, `aud`, `vid`, `others`) |
| DELETE | `/api/delete-file/:type/:filename/:experimentID` | Delete a file |
| POST | `/api/participant-files/:experimentID` | Receive participant-uploaded files (base64). Body: `{ files[], sessionId? }` |
| GET | `/api/participant-files/:experimentID` | List participant files. Query: `?sessionId=xxx` |
| GET | `/api/participant-files-serve/:experimentID/:filename` | Serve participant file |
| DELETE | `/api/participant-files/:experimentID/:fileId` | Delete participant file |

---

## Database (`server/routes/db.js`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/export-all-experiments` | Export all as ZIP. Query: `?ids=id1,id2` |
| GET | `/api/export-experiment/:experimentID` | Export single experiment as ZIP |
| POST | `/api/import-experiments` | Import experiments from ZIP (multipart, field: `zipfile`) |
| POST | `/api/app/reset` | Factory reset. Body: `{ uid?, deleteRepos? }` |

---

## Tunnel (`server/routes/tunnel.js`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tunnel-settings/:experimentID` | Get tunnel settings |
| PUT | `/api/tunnel-settings/:experimentID` | Save tunnel settings. Body: `{ hostname, persistent }` |
| POST | `/api/create-tunnel` | Start Cloudflare tunnel. Body: `{ experimentID?, hostname? }` |
| POST | `/api/close-tunnel` | Stop tunnel. Body: `{ experimentID? }` |

---

## Client-Side API Consumption Pattern

All API calls from the React frontend go through `TrialsProvider` or similar providers:

```
Component → useTrials() → TrialsContext → TrialsProvider → fetch(API_URL + endpoint)
```

The `API_URL` is set via `import.meta.env.VITE_API_URL` (defaults to `http://localhost:3000`).

### Trial Field Update (granular autosave)

```
Component calls: saveField("columnMapping", value)
  → updateTrialField(trialId, "columnMapping", value)
    → PATCH /api/trial/:experimentID/:id
      body: { "columnMapping": value }
```

### Trial Full Save (manual save button)

```
Component calls: handleSave()
  → updateTrial(trialId, { name, plugin, parameters, columnMapping, ... })
    → PATCH /api/trial/:experimentID/:id (full update)
```
