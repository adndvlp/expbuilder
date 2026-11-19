import type { DocSection } from "./types";

export const SessionPublicSection: DocSection = {
  id: "session-public",
  title: "Session — Published Mode",
  content: `# Session — Published Mode

Generated from \`ExperimentCode/PublicConfiguration.ts\`. The published page connects to the Firebase backend without requiring the local Express server.

## Changing Public Settings

For an experiment published with the current generator:

| Setting | How to apply a change |
|---|---|
| IndexedDB, batch size and resume timeout | **Save Configuration**; applies to new sessions without republishing. |
| Recruitment platform and Prolific completion code | **Save Configuration**; applies to new sessions without republishing. |
| CAPTCHA enabled, provider and site key | **Save Configuration**; applies to new sessions without republishing. |
| Session name formula and separator | **Save Session Name**, then republish. |
| Background, fullscreen and progress bar | **Save Appearance**, then republish. |
| Trials, loops, code, media, storage destination and response validation | Publish the updated experiment. |

**Save Configuration** writes the complete batch, recruitment and CAPTCHA groups together. Saving a session name or appearance is independent. An existing session retains its original public-session settings and export destination, including its original resume timeout.

## Session Configuration

The server registers a stable session ID and participant assignment. In one creation transaction it reads the latest saved settings from the experiment and combines them with the published storage provider, destination and response validation. Retrying registration after a lost HTTP response returns the same session and configuration. A participant cannot replace those settings in the request.

The generated HTML uses the validated session response before starting trials. Missing or invalid settings block startup; save valid settings in the Builder. Publishing later does not overwrite the saved settings.

## Firebase Storage and Presence

Firestore keeps the session at \`experiments/{experimentID}/sessions/{sessionId}\`, including its configuration, checkpoint and export status. Trial payloads, event receipts and export jobs coordinate confirmed storage. Realtime Database tracks connection presence at \`session_connections/{experimentID}/{sessionId}/{connectionId}\`; it is not the trial-results store.

The participant first registers a connection, installs its \`onDisconnect\` action, publishes presence and confirms activation. Losing that connection pauses execution. Returning before the session's resume deadline can continue with the same participant, checkpoint and settings.

## IndexedDB and Batches

With IndexedDB enabled, each response and its checkpoint commit locally before the experiment advances. Pending events remain in the experiment-scoped database until the server acknowledges their exact IDs and hashes. They have no age-based expiry. Recovery requires the same browser data to remain available.

- **Batch 0**: Upload pending events at completion.
- **Batch 1**: Send each response after its local backup.
- **Batch N**: Send batches of N and send any remainder at completion.
- **IndexedDB disabled**: Send each response individually and await durable server acknowledgement before advancing. Unacknowledged responses remain only in memory while the page stays open; the stored batch-size setting does not control this mode.

**Batch Size** appears only with IndexedDB enabled. The setting accepts nonnegative safe integers; the resume timeout accepts whole minutes from 1 to 1440.

## Disconnection and Expiry

The same resume deadline applies to Google Drive, Dropbox and OSF, with either IndexedDB mode. Changing saved settings does not alter a session that already started.

At the deadline, the session closes and requests export of responses already received by the server. Provider retries may finish later. The expired session cannot continue answering trials. Any browser-held responses recovered later still belong to that session's file; a new participation requires the participant's choice.

With batch 0, closing the page before upload leaves responses only in the browser. The timeout cannot send data the server never received. Return using that browser to recover available pending responses.

## Completion and Recruitment

Completion waits for pending response writes, verifies the expected event set and confirms export to the storage provider before showing success or redirecting. Receipt by Firestore and confirmed storage in the provider are separate steps. A save error offers a retry and preserves pending data.

- **None**: Show the completion message after confirmed storage.
- **Prolific**: Use the session's completion code and Prolific URL parameters for the redirect after confirmed storage.
- **MTurk**: Block preview assignments at startup. Submit an accepted assignment after confirmed storage.

## CAPTCHA Gate

The HTML supports hCaptcha and reCAPTCHA v2. The session configuration chooses the enabled flag, provider and site key, including when resuming an older session after another settings save.

Presence activation finishes before waiting for the CAPTCHA challenge. A passed challenge is retained in experiment-scoped \`sessionStorage\` in the same tab; another tab can require it again. Successful completion or choosing a new participation clears the marker. Saving CAPTCHA changes requires no republication.
`,
};
