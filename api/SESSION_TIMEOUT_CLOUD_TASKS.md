# Public session timeout and export queues

Publication scope update (2026-11-12): the [single publication SDD](../docs/publication-versioning-removal-sdd.md) specifies removal of publication history and old-HTML redirection as a separate, pending change. It preserves session configuration, compatible resume, timeout and export guarantees. Existing GitHub/Firestore cleanup belongs to the user; no cleanup scripts are included. The publication-history implementation described below is the current implementation scheduled for removal, not a requirement to preserve it.

Implementation status: persistence SDD points 1–5 are verified locally. Seven
provider HTTP contracts and all 51 browser/emulator cases passed using the
published Firebase 9.23.0 SDK. Provider services and Cloud Tasks delivery are
controlled locally; production IAM, scheduler and queue configuration still
require deployment verification. The [coordinated release and historical recovery
plan](../docs/public-session-release-plan.md) includes the prepared recovery tool.
No production deployment, republication or recovery was performed.

## Protocol 3 lifecycle

A session freezes its publication, execution revision, batch configuration,
validation rules, provider and destination when it is created. New publications
apply to new sessions. `Resume Timeout` is an integer from 1 to 1440 minutes and
has the same meaning with either IndexedDB mode and all three providers.

The HTTP handshake grants one connection ID, generation and random write
capability. Only its hash is kept in Firestore. A private, server-written RTDB
lease authorizes presence under:

```text
session_connection_leases/{experimentID}/{sessionId}/{connectionId}
session_connections/{experimentID}/{sessionId}/{connectionId}
```

The client registers and awaits `onDisconnect().set(...)` before publishing
connected presence, then confirms activation through the API before running
trials. Presence is established before CAPTCHA/resource preparation and checked
again before execution. `.info/connected` pauses progression on network loss
and renews the handshake on reconnect without requiring a reload. An initial
handshake that never establishes presence has a 30-second setup window before
the ordinary resume deadline starts; it cannot reserve the session forever.

RTDB rules require a valid capability and generation and a server timestamp.
They disallow replaying a disconnect to extend its date and reopening the same
generation. A private lease also blocks legacy writes to the old session node.

`resumeSession`, activation, event reception, completion, status, presence and
timeout use the same lifecycle resolver. It reads the current connection even
if its trigger is delayed. The deadline is the server disconnect timestamp plus
the frozen timeout. At `now >= resumeExpiresAt`, execution closes as `expired`
and the export request commits in the same Firestore transaction. Provider
latency never extends permission to continue. Old generations cannot write new
events or expire a replacement connection. Identical received-event retries can
still be acknowledged after expiry.

Returning before the deadline retains the same participant, condition and
checkpoint. Returning after it recovers pending events into the original
session and offers an explicit new participation with a different ID, subject
to participation limits. An unbacked in-memory response must be saved before
that choice can navigate away. Earlier recovery references are separate from
the active session; later visits retry their original-session delivery.

## Durable timeout dispatch

- `onSessionConnectionWritten`: RTDB trigger for connection presence.
- `enqueueSessionTimeout`: Firestore trigger for durable session timeout intent.
- `reconcilePendingSessionTimeouts`: every minute, retries due timeout intents.
- `processSessionTimeout`: task queue worker, target
  `locations/us-central1/functions/processSessionTimeout`.

The session stores `timeoutPending`, `timeoutKind`, `timeoutExpiresAt`,
`timeoutGeneration` and `timeoutNextDispatchAt`. Enqueue failure preserves that
intent and retries after 30 seconds. A claimed dispatch becomes eligible again
after its intended deadline plus one minute. Delivery may repeat. Its payload
includes connection ID/generation; obsolete work cannot affect a newer owner.
Activation cancels the intent logically. The scheduler also inspects sessions
with `presenceCheckPending` and a due `presenceCheckAt`, so a lost RTDB trigger
cannot strand a disconnect indefinitely. It advances each check date and uses
the same deadline resolver; terminal/deleting sessions stop being inspected.
This is necessary because the installed RTDB trigger SDK does not encode
`retry: true` into its endpoint metadata. Source and packaged manifest both
retain its supported `retry: false` behavior, with the scheduler as repair.
Expiry commits closure and export;
empty sessions close without producing a fictitious CSV.

The worker has a 300-second function timeout, five attempts, 30–300 second
backoff, and limits of 20 concurrent dispatches and 20 dispatches/second. The
queue dispatch deadline remains 120 seconds. Both the SDK exports and the
checked-in Functions manifest declare the new trigger and scheduler.

`finalizeDisconnectedSessions` remains for older publications. Both IndexedDB
modes now schedule their disconnect timeout for all providers, using the
recorded disconnect timestamp when available. Drive/Dropbox no longer request
an immediate partial export on disconnect. This compatibility path does not
invent immutable revisions or writer capabilities for old clients. New runtime
sessions use protocol 3; an older session without a compatible artifact stops
visibly and retains its data for the separate transition work.

## Export confirmation

Closing and requesting an export revision commit together. `enqueueSessionExport`
dispatches persisted jobs, `processSessionExportTask` writes/reconciles their
stable provider resource, and `reconcilePendingSessionExports` repairs delivery
gaps every minute. The export task target is:

```text
locations/us-central1/functions/processSessionExportTask
```

Each job fixes its event set, hash, destination and session metadata. It keeps
CSV chunks and payloads until the provider bytes have been verified. Only the
IDs in that confirmed snapshot can be cleaned. Recovery requests another
revision of the same file, never a new participant or a reopened execution.
Uncertain writes remain recoverable for reconciliation or explicit retry.

HTTP 202 and execution state `completed` do not mean storage succeeded. The
runtime checks a matching confirmed receipt before reporting success or
redirecting to a recruitment platform. `retryExport` reactivates a blocked job.

## Publications and local retention

The generated runtime embeds its publication configuration. Cloud publishing
validates it and saves immutable HTML and media under
`publications/{publicationId}/`, plus a Firestore publication manifest. The root
entry is updated only after the artifact is ready. A publication lease prevents
competing entry/manifest updates; experiment deletion waits for that lease.
The publisher's 300-second timeout is shorter than its ten-minute lease.
Switching providers retains earlier folders required by existing sessions.

Active sessions with another execution revision return their original artifact
URL. Missing manifests produce an explicit error instead of applying an old
checkpoint to the current graph. Closed-session recovery does not execute the
old graph.

IndexedDB retains unacknowledged events without age-based deletion. Cleanup is
scoped to the current session and exact acknowledged IDs. With batch 0, the
server cannot export responses that have never left the browser; closing that
browser does not create a background delivery guarantee.

## Eventual coordinated release

Point 5 must verify the emulator/provider matrix and transition before release.
Deploy the Functions exports and manifest together with RTDB rules and Firestore
indexes, then republish the compatible runtime. Deploying only Functions does
not update an already published HTML file or provision the required indexes.
The timeout dispatcher requires Cloud Tasks enqueue/invoke permissions. Cloud
Tasks and Cloud Scheduler are declared required APIs; no new npm dependency or
environment variable is introduced.

Session deletion removes receipts, jobs/chunks and connection records. Experiment
deletion also removes publication manifests. Pending or uncertain provider writes
must be reconciled before deleting their remaining recoverable copies.
