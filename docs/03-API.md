# 03 - API Reference

All routes are prefixed with the Express server URL. `experimentID` refers to the UUID of the experiment.

## Experiments (`server/routes/experiments.js`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/load-experiments` | List all experiments sorted by newest first |
| GET | `/api/experiment/:experimentID` | Get a single experiment by ID |
| POST | `/api/create-experiment` | Create new experiment. Body: `{ name, description?, author?, uid?, storage? }` |
| DELETE | `/api/delete-experiment/:experimentID` | Delete local records/files, optionally active published resources. Body: `{ scope: "local" | "remote", uid? }`; remote requires owner authentication |
| POST | `/api/run-experiment/:experimentID` | Compile experiment to HTML. Body: `{ generatedCode }` |
| POST | `/api/trials-preview/:experimentID` | Compile trial preview HTML. Body: `{ generatedCode }` |
| GET | `/:experimentID` | Serve compiled experiment HTML |
| GET | `/:experimentID/preview` | Serve compiled trial preview HTML |
| POST | `/api/publish-experiment/:experimentID` | Publish to GitHub Pages. Body: `{ uid, storage?, backendProjectId?, generatedPublicCode, functionalSettings }` |
| GET | `/api/appearance-settings/:experimentID` | Get appearance settings |
| PUT | `/api/appearance-settings/:experimentID` | Save appearance settings. Body: `{ backgroundColor, fullScreen, progressBar }` |

Run, preview and publication resolve appearance from the saved experiment,
defaulting to white when unset. Construction requests use the fields listed
above; appearance is configured through its dedicated settings API.

### Verified publication destinations (M04)

All routes below require `Authorization: Bearer <Firebase ID token>`. They proxy to
`getExperimentDeploymentContext` or `configureExperimentBindings` in the selected
Firebase project and verify the returned experiment/project/owner before saving
local metadata. Remote calls do not hold the local database lock.

| Method | Path | Body / behavior |
|--------|------|-----------------|
| GET | `/api/deployment-context/:experimentID` | Authoritative `exists`, project, owner, storage/GitHub states and whitelisted bindings; no provider creation |
| POST | `/api/deployment-bindings/:experimentID/inspect` | `{backendProjectId?, selection: {repository?, storageFolder?, branch?}}`; inspect original legacy destinations without writing |
| POST | `/api/deployment-bindings/:experimentID/confirm` | `{backendProjectId?, selection, contextFingerprint, fingerprint}`; revalidate and claim the inspected identities, add the repository marker, save bindings without publishing |
| POST | `/api/deployment-bindings/:experimentID/repair/inspect` | `{backendProjectId?, resource: "storage" | "github", selection?}`; verify the linked account and preview replacement of an inaccessible bound resource |
| POST | `/api/deployment-bindings/:experimentID/repair/confirm` | `{backendProjectId?, resource, selection, contextFingerprint, fingerprint, confirmReplacement: true, acknowledgeDataLoss: true}`; prepare only the confirmed replacement, atomically record history and switch its binding |

Storage states: `new`, `bound`, `needs_confirmation`. GitHub states: `new`, `bound`,
`needs_selection`. An absent remote experiment returns `exists: false` without
reserving ownership or creating resources. Inspection previews carry a fingerprint
and the source context fingerprint; changing an identity requires inspection again.
A pending repair exposes its resource type and safe checkpoint hints (folder ID/path or repository name), never OAuth credentials. Ordinary publication is blocked until that repair is resolved.

Publication uses fixed provider/account/folder IDs and GitHub account/repository ID
and branch. Omitting a provider lets Functions use the existing binding. A different
provider is rejected with `STORAGE_CHANGE_REQUIRES_MIGRATION`; publication cannot
perform a data migration. Legacy original destinations require explicit verification,
and imported URLs do not authorize association. A missing RPC on an older backend
returns `426 BACKEND_UPGRADE_REQUIRED` rather than silently using the old behavior.

Repair preserves experiment identity, counters, settings, pause and historical
references. It neither recovers deleted files nor moves previous results. Registered
sessions retain their original storage binding; new sessions use the replacement.
A new GitHub repository returns `repairResult.requiresPublication: true` and
`urlMayChange: true`, invalidating the local old Pages URL. Previous external
resources remain untouched. An uncertain replacement creation can be explicitly
selected and inspected through the repair flow; it is never adopted by name.

Key errors: `BINDING_PREVIEW_STALE`, `STORAGE_BINDING_UNAVAILABLE`,
`GITHUB_BINDING_UNAVAILABLE`, `RESOURCE_ALREADY_BOUND`, `REPAIR_NOT_NEEDED`,
`REPAIR_CONFIRMATION_REQUIRED`, `REPAIR_IN_PROGRESS`, `BACKEND_CONTEXT_CHANGED`.
A provider error does not establish that its resource was deleted. Reconnect the
linked account and retry verification before confirming any replacement.

### Static File Serving
- Files under an experiment's `img|aud|vid|others/` directories are resolved by exact `experimentID`
- Pattern: `/:experimentID/img/filename` etc.; one experiment cannot fall through to another experiment's files

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
| GET | `/api/loop-trials-metadata/:experimentID/:loopId` | Get ordered direct members from the loop scope |
| PATCH | `/api/loop/:experimentID/:id` | Partial update loop. Syncs parentLoopId on trial add/remove |
| DELETE | `/api/loop/:experimentID/:id` | Ungroup loop. Restore direct members and preserve trial connections |

### Grouping and Ungrouping

```text
Before grouping: Trial0 → TrialA → TrialB → TrialC
After grouping:  same trial connections; Loop1 contains TrialA and TrialB
After deleting Loop1: same trial connections; TrialA and TrialB restored in order
```

Creation inserts the container at the first selected position and updates direct member ownership. Deletion replaces the container with its direct members at that position; nested loops remain containers. Neither operation substitutes loop IDs into branches or transfers branches from a loop to a trial. Responses include the canonical graph for the provider to adopt.

Loops reject `branches` and `branchConditions`, including empty arrays. Trial mutations and timeline replacement reject existing loop IDs as branch destinations. REST mutations use the same validation contract; ZIP import applies the temporary tester conversion tracked in [temporary-migrations.md](temporary-migrations.md), which must be retired before the release for users.

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
| POST | `/api/append-result/:experimentID` | Idempotently create a UUID session. Body: `{ sessionId, metadata?, displayName? }`; returns a strict ACK and positive `participantNumber` |
| PUT | `/api/append-result/:experimentID` | Idempotently store one trial. Body: `{ sessionId, eventId, sequence, response }`; returns matching identifiers and `storedCount` |
| GET | `/api/session-results/:experimentID` | List persisted session metadata (no trial payload); optional exact `?sessionId=` query |
| GET | `/api/participant-number/:experimentID` | Get next participant number |
| GET | `/api/download-session/:sessionId/:experimentID` | Download session as CSV |
| POST | `/api/download-sessions-zip` | Download multiple sessions as ZIP. Body: `{ sessionIds[], experimentID }` |
| POST | `/api/complete-session/:experimentID` | Complete only an exact sequence set. Body: `{ sessionId, expectedEventCount, lastSequence }` |
| POST | `/api/save-online-session-metadata/:experimentID` | Save online session metadata. Body: `{ sessionId, metadata?, state? }` |
| PATCH | `/api/rename-session/:experimentID` | Change only the visible label. Body: `{ sessionId, displayName }`; UUID identity is unchanged |
| DELETE | `/api/session-results/:sessionId/:experimentID` | Delete session + participant files |

---

## Files (`server/routes/files.js`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload-files/:experimentID` | Upload multimedia (multipart). Auto-classifies into img/aud/vid/others |
| GET | `/api/list-files/:type/:experimentID` | List files by type (`all`, `img`, `aud`, `vid`, `others`) |
| DELETE | `/api/delete-file/:type/:filename/:experimentID` | Delete a file |
| POST | `/api/participant-files/:experimentID` | Receive participant files (base64). Body: `{ files[], sessionId }`; the persisted session is required |
| GET | `/api/participant-files/:experimentID` | List participant files. Query: `?sessionId=xxx` |
| GET | `/api/participant-files-serve/:experimentID/:filename` | Serve participant file |
| DELETE | `/api/participant-files/:experimentID/:fileId` | Delete participant file |

---

## Database (`server/routes/db.js`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/export-all-experiments` | Export a v2 ZIP. Query: `?ids=id1,id2&kind=backup` or `kind=portable`; defaults to backup |
| GET | `/api/export-experiment/:experimentID` | Export one experiment as a v2 ZIP; same `kind` options |
| POST | `/api/import-experiments/inspect` | Validate and stage a ZIP (multipart field `zipfile`); return `importID`, entries, collisions, settings state, warnings and allowed modes |
| POST | `/api/import-experiments/:importID/apply` | Apply a staged package. Body: `{mode: "copy" | "restore", replaceExisting: boolean}` |
| DELETE | `/api/import-experiments/:importID` | Cancel an inspection and remove its staging |
| POST | `/api/import-experiments` | Legacy automatic import is disabled; returns `426 IMPORT_PREVIEW_REQUIRED` |
| POST | `/api/app/reset` | Factory reset. Body: `{ uid?, deleteRepos? }` |

Packages contain `manifest.json` plus `experiments/<entryId>/data.json` and media
under `experiments/<entryId>/media/`. File sizes and SHA-256 hashes are validated.
Portable packages include design, functional settings and media. Backups also
include local sessions, counters and available participant files. Managed OAuth
credentials and active remote associations are excluded.

Copy allocates new experiment IDs and independent media directories, without
historical results or counters. Restore preserves IDs and replaces local records,
including empty histories. A collision requires explicit replacement confirmation;
changes since inspection return `409 IMPORT_PREVIEW_STALE`. Applying a committed
import again with the same ID and mode returns its original result.

Inspect supports legacy v1 ZIPs and v2 packages. Previews expire after 24 hours.
Limits: 256 MiB compressed, 512 MiB uncompressed, 256 MiB per media file, 32 MiB
per data document, 2 MiB manifest, 10,000 archive entries and 1,000 experiments.
Oversized packages return 413. A rolled-back apply returns `IMPORT_ROLLED_BACK`
and requires inspection again. Imports never restore remote resources or counters.

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
