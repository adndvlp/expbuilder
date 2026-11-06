# Session Timeout Cloud Tasks

This document describes the delayed timeout flow used by `builder_api` for
disconnected experiment sessions.

## Why This Exists

The previous implementation used `setTimeout(..., 30 minutes)` inside the
Realtime Database trigger `finalizeDisconnectedSessions`. That is not reliable
in Cloud Functions: the trigger handler returns immediately, and the timer then
lives only in the memory of one function instance.

The current implementation uses Firebase task queue functions, backed by Google
Cloud Tasks, to schedule the delayed work durably.

Official references:

- Firebase task queue functions: https://firebase.google.com/docs/functions/task-functions
- Cloud Tasks pricing: https://cloud.google.com/tasks/pricing
- Cloud Tasks quotas and limits: https://cloud.google.com/tasks/docs/quotas

## Deployed Functions

This is the declared deployment configuration. The persistence work described
below was verified locally; deployment and republication remain separate steps.

- `finalizeDisconnectedSessions`: Realtime Database trigger on
  `sessions/{experimentID}/{sessionId}`. It detects disconnects and schedules
  durable timeout work when the session is resumable.
- `processSessionTimeout`: task queue worker. Cloud Tasks dispatches this
  function at `resumeExpiresAt`.
- `enqueueSessionExport`: Firestore trigger on
  `experiments/{experimentID}/sessions/{sessionId}/export_jobs/{revision}`.
- `processSessionExportTask`: worker for one durable export revision.
- `reconcilePendingSessionExports`: scheduled every minute to rediscover jobs
  whose enqueue failed or whose previous dispatcher disappeared.

The queue target used by the Admin SDK is:

```text
locations/us-central1/functions/processSessionTimeout
```

No new npm dependency is required. The existing `firebase-functions` and
`firebase-admin` versions already support task queue functions.

## Runtime Flow

When a participant disconnects and resume is enabled:

1. `finalizeDisconnectedSessions` writes `resumeExpiresAt`,
   `resumeTimeoutStarted`, and `resumeTimeoutTaskStatus: "pending"` to RTDB.
2. It enqueues a Cloud Task for `processSessionTimeout` using `scheduleTime`.
3. After enqueue succeeds, it writes `resumeTimeoutTaskStatus: "queued"`.
4. If the participant reconnects before the task fires, RTDB is marked as
   `state: "resumed"` and `resumeTimeoutTaskStatus: "cancelled"`.
5. The task may still dispatch, but it is idempotent: it re-reads RTDB and
   no-ops unless the session is still disconnected and `resumeExpiresAt`
   matches the task payload.

For versioned sessions (`sessionProtocolVersion: 2` or `exportProtocolVersion: 1`),
an eligible timeout closes execution as `expired` and atomically requests a
durable export. RTDB records `exportStatus` and keeps `finalizationProcessed`
false while storage remains pending. Payloads are removed only after verifying
the complete CSV in the provider. An empty session closes without creating a
fake CSV. A stale presence record cannot turn a completed execution into an
expired one.

The scheduling policy has not yet been unified: IndexedDB sessions and OSF
without IndexedDB use the delayed timeout; Drive/Dropbox without IndexedDB still
request a partial export on disconnect. Both paths now use the same exporter
for versioned sessions. Unifying the timeout and connection generations belongs
to point 4 of the persistence SDD. Unversioned sessions retain their legacy
compatibility path. Batch-zero responses still only in the browser cannot be
exported by the server.

## Durable Export Flow

The export queue target is:

```text
locations/us-central1/functions/processSessionExportTask
```

Closing and requesting a revision commit together. Each revision fixes the
event set, hash, session metadata and destination. A Firestore trigger enqueues
it; the scheduler repairs an enqueue gap without requiring the browser to stay
open. Delivery may repeat: session + revision is the stable logical identity.
The installed Admin SDK does not support custom physical task IDs.

The worker uses a six-minute lease and generation checks, persists the CSV in
250 KB chunks before mutation, reads the previous confirmed file, merges by
`event_id`, and verifies the uploaded bytes by SHA-256. It confirms the receipt
before cleaning only that revision's payloads. A cleanup failure resumes cleanup
without uploading again. Recovered responses request another revision of the
same resource and do not reopen execution or increment participation counters.

Drive reserves an ID before creation; Dropbox uses strict revision updates with
`autorename: false`; OSF updates its returned resource URL without deleting the
old file. A failed download is an error, never evidence of an empty file.
Uncertain writes enter `reconciling`. Exact observed snapshot bytes can confirm
them without another mutation. Where a safe repeat cannot be established, the
job retains its snapshots and payloads in `needs_attention`. Drive v3 media
update CAS is not assumed from an ETag alone; OSF has no documented conditional
PUT in the referenced contract. Dropbox's strict update revision and Drive's
reserved-ID creation permit safe repetition in their supported cases.

HTTP `completeSession` can return 202 while the job runs. The participant checks
`sessionStatus`; only a matching confirmed receipt permits success or recruitment
redirection. `recoverEvents` uploads closed-session pending events, and
`retryExport` reactivates the blocking job after attention or exhausted retries.
Older closed sessions without verifiable jobs/receipts require the later
transition tool, not an inferred confirmation.

Provider references: [Drive reserved IDs](https://developers.google.com/workspace/drive/api/guides/create-file),
[Dropbox strict upload revisions](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/upload),
and [WaterButler upload/update contracts](https://github.com/CenterForOpenScience/waterbutler/blob/develop/docs/api.rst).

## Retry And Rate Limits

`processSessionTimeout` is configured with:

- Region: `us-central1`
- Timeout: 300 seconds
- Max attempts: 5
- Backoff: 30 to 300 seconds
- Max concurrent dispatches: 20
- Max dispatches per second: 20
- Per-task dispatch deadline: 120 seconds

`processSessionExportTask` uses a 300-second function timeout and dispatch
deadline, 512 MiB memory, eight attempts, 30–900 second backoff, and at most five
concurrent dispatches/five dispatches per second. Exhaustion retains the job and
data for explicit retry. The scheduler and per-job dispatch claim also recover
an interrupted worker or a task whose delivery retries ended.

## Deployment Requirements

For the eventual coordinated release, deploy the indexes and all participating
functions together, and then republish the compatible participant runtime:

```bash
firebase deploy --only firestore:indexes,functions:apiData,functions:apiDataComplete,functions:processSessionTimeout,functions:finalizeDisconnectedSessions,functions:enqueueSessionExport,functions:processSessionExportTask,functions:reconcilePendingSessionExports
```

Deploying all functions is also fine:

```bash
firebase deploy --only functions
```

On first deploy, Firebase CLI creates the Cloud Tasks queue for the task queue
function using the retry and rate-limit options in source code.

If enqueueing fails with permission errors, check IAM for the service account
used by the function. It needs permission to create Cloud Tasks tasks
(`cloudtasks.tasks.create`, commonly via `roles/cloudtasks.enqueuer`) and to
invoke the task queue function.

The checked-in Functions manifest declares Cloud Tasks and Cloud Scheduler as
required APIs. `firestore.indexes.json` includes collection-group indexes for
dispatch and deletion guards. Deploying only Functions is insufficient when
these indexes have not been provisioned. No new environment variable or npm
dependency is required.

## Cost Model

The example below counts only the timeout queue. Export queue deliveries,
Firestore jobs/snapshots and the scheduler add their own operations; they are not
included in that original estimate.

The task payload is far below 32 KB, so one disconnected resumable session
normally adds two Cloud Tasks billable operations:

1. One enqueue API call.
2. One push delivery attempt.

Ignoring free tiers, Google lists Cloud Tasks at USD 0.40 per million operations
up to 5 billion operations/month. Under that model:

- 500 disconnected sessions: 1,000 operations = USD 0.0004.
- 1,000 disconnected sessions: 2,000 operations = USD 0.0008.
- Retries add one delivery operation per retry.

This is only the Cloud Tasks increment. The worker still incurs the normal
Firebase costs for Cloud Functions execution, RTDB reads/writes, Firestore
reads/writes/deletes, and any provider API work.

## Relevant Limits

Current Cloud Tasks limits that matter for this implementation:

- Maximum schedule time: 30 days in the future. Builder uses minutes, normally
  30 minutes, so it is well below the limit.
- Maximum task size: 1 MiB. Builder sends only `experimentID`, `sessionId`, and
  `expiresAt`.
- Queue dispatch rate: 500 tasks/second per queue. Builder caps this worker at
  20 dispatches/second in source.
- Queues per region: 1,000. Builder uses one task queue function for session
  timeouts.
- Task retention: 31 days.

## Tests

Targeted tests:

```bash
cd functions
npm test -- sessions-timeout-tasks.test.js sessions-finalizeDisconnected-trigger.test.js
```
