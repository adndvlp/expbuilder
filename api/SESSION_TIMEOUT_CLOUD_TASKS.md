# Public session timeout and export queues

The current implementation uses one publication per experiment. The
[single publication SDD](../docs/publication-versioning-removal-sdd.md) records
its local regression results and the browser checks deferred by the user.
The [publication and verification plan](../docs/public-session-release-plan.md)
describes a concrete test publication. This task does not deploy or republish
real experiments. Existing GitHub/Firestore history cleanup belongs to the user.

## Protocol 3 lifecycle

A session copies the current server-confirmed `publishedConfiguration`, including
batch configuration, validation, recruitment, CAPTCHA, provider and destination,
when it is created. New publications
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
invent protocol 3 writer capabilities for old clients. The
[compatibility removal spec](../docs/retrocompatibility-removal-sdd.md) treats
retirement of that old trigger and transport separately. Current sessions do
not consult a publication history.

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

The generated runtime embeds its configuration. Cloud publishing validates it,
uploads media to `img/`, `aud/` and `vid/`, and updates the root `index.html`.
It then confirms the single `publishedConfiguration` on the experiment. A
publication lease prevents competing uploads; experiment deletion waits for it.
The publisher's 300-second timeout is shorter than its ten-minute lease.
Switching providers retains earlier folders required by existing sessions.

Existing sessions resume on the current HTML with their own configuration.
Navigation validates the saved destination, scope, queue, loop order and
repetition before execution. A changed authoring date alone cannot reject a
valid checkpoint. Invalid progress is reported without resetting identity or
deleting pending responses. Closed-session recovery sends data to the original
session without executing another graph. New participation reloads the current
location, preserving its origin, path, query and fragment.

IndexedDB retains unacknowledged events without age-based deletion. Cleanup is
scoped to the current session and exact acknowledged IDs. With batch 0, the
server cannot export responses that have never left the browser; closing that
browser does not create a background delivery guarantee.

## Publication and environment verification

The local suite verifies the provider/emulator matrix; its controlled task
delivery tests dispatch failures and retries without claiming production IAM.
Deploy the Functions exports and manifest together with RTDB rules and Firestore
indexes, then publish the selected test experiment. Deploying only Functions does
not update an already published HTML file or provision the required indexes.
The timeout dispatcher requires Cloud Tasks enqueue/invoke permissions. Cloud
Tasks and Cloud Scheduler are declared required APIs; no new npm dependency or
environment variable is introduced.

Session and experiment deletion remove receipts, jobs/chunks and connection
records without consulting a publication history. Pending or uncertain provider writes
must be reconciled before deleting their remaining recoverable copies.
