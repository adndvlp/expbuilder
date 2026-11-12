# Public session persistence: coordinated release and historical recovery

Scope update, 2026-11-12: the [compatibility removal spec](retrocompatibility-removal-sdd.md) supersedes this plan's legacy coexistence, historical recovery and general republication steps. Only the identified experiments that need updating enter the temporary transition; converters are removed after validation. The historical tool is scheduled for removal and must not be treated as a pending recovery operation. The removal is specified but not implemented yet.

Status: implementation and local verification complete. The full local run passed all seven HTTP contracts and 51 emulator/browser cases without skips; backend, selected client and local server regressions also passed. This file is a release plan, not a record of deployment. No production experiment has been republished or recovered.

## Reproducible checks

- `npm run test:e2e:persistence`: provider HTTP contracts, then generated HTML and real jsPsych/Firebase against isolated Firestore and RTDB emulators. Cloud Tasks delivery and the external providers are controlled local services; HTTP handlers, transactions, lifecycle resolver, exporter and RTDB rules are real.
- The runner requires Node 22/24, Java 21+ and Chrome/Playwright Chromium. It selects an installed compatible NVM binary when needed. CI uses its installed Chromium; macOS can use Chrome. `PLAYWRIGHT_EXECUTABLE_PATH` selects another installed browser.
- Firebase browser SDK 9.23.0 is exactly the version in published HTML. The first run downloads its official public app/database compatibility bundles and checks pinned SHA-256 values. `PERSISTENCE_SDK_DIR` supplies those two files for offline use. It never replaces the SDK with a Firebase stub.
- The Firebase project is always `demo-public-persistence`; ports and emulator working directories are temporary. No existing emulator backup is imported. The harness refuses a different project or nonlocal emulator hosts. A local task queue loader replaces only Cloud Tasks delivery. Java is bounded to a 256 MB heap per emulator.
- `npm test --prefix api/functions -- --runInBand` checks backend regressions. The existing client persistence, runtime and native branching tests remain part of the release checks.

## Deployment order

1. Preserve an inventory of experiments, active publications, existing session protocols and destinations. Do not delete old HTML, trial payloads or files as part of release. Confirm the functions runtime and provider credentials in the target project.
2. Run the reproducible checks above and the existing Builder contracts workflow. Inspect the final CSV assertions, not only successful HTTP statuses.
3. Deploy Firestore indexes and RTDB rules together with `apiData`, `apiDataComplete`, `apiDeleteExperiment`, `publishExperiment`, the legacy disconnect trigger, connection presence trigger, timeout dispatcher/worker/reconciler and export dispatcher/worker/reconciler. Use the committed Functions manifest and source as one release. Cloud Tasks and Cloud Scheduler APIs and enqueue/invoke permissions must be provisioned.
4. Verify declared functions, collection-group indexes and scheduler/queue targets in the selected project before exposing the new runtime. Index readiness must precede relying on dispatch queries.
5. Republish a small test experiment with the new generator. Verify its immutable HTML/media and active manifest, run both IndexedDB modes, interrupt and resume a session, let another expire and download their confirmed CSVs. Provider tests use dedicated test folders.
6. Publish the remaining experiments deliberately. New sessions use protocol 3; existing compatible sessions keep their artifact/configuration. A session without a compatible historical artifact must stop visibly and keep its data, rather than interpreting an old checkpoint on a new graph.
7. Inspect and recover historical results separately using the tool below. Deployment itself does not run it.

Rollback keeps the new backend's session/export records and immutable artifacts. Stop new publication or deactivate collection if needed; do not replace an active session's artifact, remove receipts, clear IndexedDB, delete pending jobs, or switch a versioned session back to legacy endpoints. Provider writes with uncertain outcomes remain subject to reconciliation.

## Historical recovery tool

Entry point: `api/functions/experiment/sessions/recovery/cli.js`. Run using a compatible Node runtime and explicit Firebase project credentials. It has no public HTTP endpoint and no default project. An existing access token is supplied through an environment-variable name; inspection never refreshes tokens or writes OAuth state. The exporter later uses the backend's normal stored credentials.

Inspection is the default operation:

```sh
node api/functions/experiment/sessions/recovery/cli.js --project PROJECT --experiment EXPERIMENT_ID --session SESSION_ID --token-env RECOVERY_PROVIDER_TOKEN --out reviewed-plan.json
```

This reads source documents and the destination, creates a local plan with mode 0600, and prints its status/digest/count. It does not change Firestore or the provider, reserve a Drive file ID, or overwrite an existing plan file. The plan contains responses; treat it as experiment data. Tokens are not copied into it.

Review the participant, condition, creation date, destination, original document IDs, expanded rows and event count before application. If original identity facts are absent, inspection blocks. `--identity identity.json` can supply missing facts explicitly; it cannot replace a participant/condition already recorded. `--destination destination.json` can select the original known provider/owner/folder if the current experiment's destination changed. Neither override is inferred from the current condition counter.

An existing unreceipted CSV blocks automatic application because rows in that file and old Firestore documents may be duplicates without a provable common ID. Corrupt batches and positive counts with missing payloads also block. Equal answers are retained as distinct events; the tool does not guess duplicates by content, timestamp or trial index. Sessions that already have event receipts, including partial versions of the protocol, are blocked from legacy conversion so their IDs cannot be replaced. Inspect their existing export/status/retry state instead.

Apply only the reviewed ready plan:

```sh
node api/functions/experiment/sessions/recovery/cli.js --project PROJECT --mode apply --plan reviewed-plan.json --token-env RECOVERY_PROVIDER_TOKEN
```

Application verifies the plan digest, explicit project, source identity/payloads and remote snapshot before staging. It closes the old execution without allocating another participant or incrementing counters. Original documents are copied to `recovery_sources` before conversion; a `recovery_plans` journal permits interrupted work to resume. Events use deterministic IDs derived from project/session/source document/position and are written in bounded batches. Legacy containers are removed only after their original backup and converted events exist. An unexpected concurrent payload stops the request for export and leaves recoverable copies.

The final event set is checked and export requested atomically through the regular revision exporter. The tool reports `export_requested`, never a false saved confirmation. Repeating an applied plan returns its original request; inspect `sessionStatus` and the matching provider receipt to confirm completion. Original backups remain until explicit session/experiment deletion, which includes the new recovery resources.

A plan blocked by ambiguity, corrupt data or missing identity needs manual reconciliation; the tool deliberately does not overwrite a legacy CSV or manufacture facts. Production inspection/application and removal of legacy compatibility remain operator actions after review.


## Acceptance coverage

The matrix combines existing focused regressions with the new emulator suite. The normal path crosses three providers with IndexedDB batches 0/1/3 and disabled IndexedDB with stored values 0/1/9 (18 cases). Resilience tests use real RTDB connections, actual browser IndexedDB and the published Firebase 9.23.0 SDK; provider responses and task delivery are the controlled external boundaries.

| Acceptance | Emulator path or focused regression |
|---|---|
| AC01 | `session.e2e.mjs`: five rows, stable IDs, verified bytes and no pending payloads, across all 18 configurations. |
| AC02 | Blocked first batch while later responses are persisted; CSV retains sequences 0–4 exactly once. |
| AC03 | Lost HTTP acknowledgement and idempotent retry; server total and final CSV stay at five. |
| AC04 | Existing public batch/verified-completion browser tests reject missing, false, wrong-session/hash/sequence acknowledgements. |
| AC05 | Disabled IndexedDB transport and lost-ack retry; progression waits for verified server backup. |
| AC06 | Real browser transaction abort; zero received before retry and the full CSV afterwards. |
| AC07 | Hold the final HTTP acknowledgement in either mode; no completion request or success before release. |
| AC08 | ON → OFF → ON with an earlier batch-zero session; original artifact, configuration and pending events survive. |
| AC09 | Provider read returns 503; payloads remain, retry confirms one complete file for each provider. |
| AC10 | Provider commits and loses its response; subsequent read reconciles one stable resource for each provider. |
| AC11 | Batch-zero normal/multiple-fragment completion; identity/registration retries also remain covered by lifecycle unit tests. |
| AC12–AC14 | Real disconnect/resume and expiry in both modes for every provider; exact deadline boundaries are tested with the lifecycle clock-controlled transaction tests. |
| AC15 | Writer generations and obsolete work are exercised by existing lifecycle race tests; real RTDB rules refuse reopening a disconnected generation. |
| AC16–AC17 | Expired IndexedDB batch-zero session first closes empty; browser recovery fills its original file, and a new participation stays separate. |
| AC18 | Batch 3 remnant in the 18-case matrix and batch-zero execution with 105 trials split into bounded requests. |
| AC19 | Existing export request/process concurrency tests verify a recovered event's later revision survives an earlier snapshot's cleanup. |
| AC20 | Network goOffline/goOnline on the same real page, both modes: renewed generation and continuation without reload. |
| AC21 | A second live tab receives `session_in_use`; only the original writer completes. |
| AC22 | Existing lifecycle tests check old-session resume versus the limit for new participation. |
| AC23 | Existing export cleanup/lease tests preserve receipts and retry interrupted cleanup without re-uploading. |
| AC24 | Provider contracts and export-process tests cover failed downloads, version conflicts, uncertain writes and superseded workers; Dropbox also rejects a different ID at the same saved path. |
| AC25 | Event contract/receipt tests retain explicit content conflicts. |
| AC26 | Existing real IndexedDB retention test keeps ten-day-old pending rows through another session's cleanup. |
| AC27 | Emulator republication follows the original immutable artifact; missing revisions remain covered by lifecycle/bootstrap tests. |
| AC28 | Existing async-export and generated-runtime tests gate success and recruitment redirection on a matching confirmed receipt. |

Historical recovery additionally has three emulator cases, one per provider: read-only inspection followed by journaled conversion of 151 events, a complete verified CSV, retained originals, unchanged participation counters and an idempotent second apply. Focused tests cover malformed batches, missing identity/payloads, changed sources, edited plans, project mismatch, existing unverified files, interrupted conversion and CLI defaults/flags.

These test layers are distinct: unit tests do not stand in for Firebase emulators, and local task delivery does not establish production Cloud Tasks IAM or scheduler configuration. CI repeats the provider/emulator suite on Node 22/JDK 21 and checks Functions units on both Node 20 and Node 22. That workflow is prepared locally; it has not been executed on GitHub in this task.

## Provider contract sources

- [Drive v3 generated IDs](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds) and [creating files with reserved IDs](https://developers.google.com/workspace/drive/api/guides/create-file): reserve before creation and retain the same ID. Media-update compare-and-swap is not inferred from metadata alone.
- [Dropbox upload arguments and write modes](https://dropbox.github.io/dropbox-sdk-js/global.html): strict revision updates with autorename disabled; download/upload metadata retains ID and revision. Inspection must not adopt a different file that has replaced a saved path.
- [WaterButler upload/update contract](https://waterbutler.readthedocs.io/en/latest/api.html): create via the folder upload URL with kind/name, then update the returned file upload URL; do not delete the old resource before replacement. Uncertain writes are reconciled rather than blindly repeated.
