# 10 - Experiment Configuration & Settings

This covers the entire `ExperimentPanel` → Settings tab, which configures experiment behavior for local runs and published experiments.

## Overview

The Experiment Settings panel has these sections (from `ExperimentPanel/ExperimentSettings.tsx`):

```
Settings Tab
├── Experiment Data Configuration (Firebase-based, only after publish)
│   ├── Use IndexedDB (client-side persistence toggle)
│   ├── Batch Size (trials per batch to Firestore)
│   └── Resume Timeout (minutes to recover disconnected sessions)
├── Session Name Configuration (local API)
│   └── Token-based formula builder
├── Recruitment Platform (Firebase-based, only after publish)
│   ├── None
│   ├── Prolific (with completion code)
│   └── MTurk (automatic form submission)
├── Anti-Spam / CAPTCHA (Firebase-based, only after publish)
│   ├── hCaptcha
│   └── reCAPTCHA v2
├── Experiment Appearance (local API, always available)
│   ├── Background Color
│   ├── Full Screen Mode
│   └── Progress Bar
└── Tunnel Settings (local API, always available)
    ├── Custom domain (Cloudflare)
    └── Persistent toggle
```

### Storage Strategy

Settings use **two different** storage backends:
- **Firebase Firestore** (`client/src/lib/firebase.ts`): For public-session settings (batch, recruitment, CAPTCHA). These controls appear once the experiment exists in Firebase, normally after its first publication.
- **Local Express API + LowDB**: For session naming, appearance and tunnel settings. Names and appearance are included when generating public HTML.

### Save or republish?

For an experiment published with the current public generator:

| Setting | Action to apply a change |
|---|---|
| IndexedDB, batch size and resume timeout | **Save Configuration**. New sessions use the saved values without republishing. |
| Recruitment platform and Prolific completion code | **Save Configuration**. New sessions use the saved values without republishing. |
| CAPTCHA enabled, provider and site key | **Save Configuration**. New sessions use the saved values without republishing. |
| Session name formula and separator | **Save Session Name**, then republish the public experiment. |
| Background, fullscreen and progress bar | **Save Appearance**, then republish the public experiment. |
| Trials, loops, code, media, storage provider/destination and response validation | Publish the updated experiment. |
| Tunnel hostname | Save the tunnel settings; independent of public publication. |

Each **Save Configuration** button saves the complete batch, recruitment and CAPTCHA groups in one Firestore operation. It neither validates nor saves the session name. **Save Session Name** and **Save Appearance** have their own operations and results.

An existing session retains its original batch, recruitment, CAPTCHA, provider, destination and validation settings. Saving another timeout does not change its existing resume deadline. Retrying registration after a lost response also preserves the original session configuration and participant assignment.

---

## Data Configuration (Batch)

Stored in Firebase `experiments/{experimentID}.batchConfig`:

```typescript
type BatchConfig = {
  useIndexedDB: boolean;       // true: cache trials in browser IndexedDB, batch send
                               // false: send each trial directly to Firestore
  batchSize: number;           // 0: send all at end; >0: batch every N trials
  resumeTimeoutMinutes: number; // 1-1440: minutes available to resume after disconnection
};
```

`Batch Size` appears only when IndexedDB is enabled and accepts nonnegative safe integers. Its stored value is retained but does not control transport when IndexedDB is disabled. The timeout accepts whole minutes from 1 to 1440. New experiments default to IndexedDB enabled, batch 0 and a 30-minute timeout.

### Behavior in all providers

- **IndexedDB enabled**: Confirm the local event/checkpoint transaction before advancing. `batchSize=0` sends on completion; positive values send batches of N events with a final remnant. Pending events survive until acknowledged, subject to browser storage availability.
- **IndexedDB disabled**: Send each event to Firestore and await its durable acknowledgement before advancing. There is no durable browser copy; an unacknowledged response stays in memory while the page remains open.
- **Disconnect and timeout**: Drive, Dropbox and OSF use the same server deadline. Returning before it permits the same session to continue. Expiry closes execution and requests export of data already received by the server; it does not delete session identity or permit further trials. Normal completion requests export immediately.
- **Batch 0 limitation**: If the page closes before upload, the timeout cannot export responses that exist only in its browser. Returning with that stored data can recover them into the original session's file without reopening execution.

Saving writes `batchConfig`, `recruitmentConfig` and `captchaConfig` on `experiments/{experimentID}`. The session service reads and validates those fields transactionally when creating a new session, together with the provider, destination and validation confirmed by publication. The public HTML takes its settings from that session response. Publishing later does not overwrite the saved settings. Compatible progress resumes on the current HTML. See the [publication and verification plan](public-session-release-plan.md).

The form validates before writing, Firestore rules restrict administrative writes to the owner and valid values, and the session service validates before assigning a new participant. Missing or invalid settings block new sessions with an instruction to save valid settings. Existing sessions continue to use their own configuration.

---

## Session Name Configuration

Stored via `POST /api/session-name-config/:experimentID`. Allows composing automatic session names for each participant run.

Use **Save Session Name** independently of **Save Configuration**. The public generator embeds this formula and separator; republish to update the public HTML. Local execution resolves names through the local API.

### Token Types

| Type | Label | Configurable | Preview Example |
|------|-------|-------------|-----------------|
| `date` | Date | Format: YYYY-MM-DD, DD-MM-YYYY, MM-DD-YYYY, YYYYMMDD | `2026-04-09` |
| `time` | Time | Format: HH-mm-ss, HH-mm, HHmmss | `14-35-22` |
| `randomAlpha` | Random ID | Length: 4-16 chars | `aB3k9p` |
| `customText` | Custom Text | Any string | `pilot` |
| `counter` | Participant Number | Digits: 1-6 | `001` |

### Separator
Options: `_` (underscore), `-` (hyphen), or none (no separator).

### Validation
If tokens are configured, at least one must be `randomAlpha` or `counter` to guarantee uniqueness.

### Preview
The formula is previewed in real-time: e.g., `2026-04-09_pilot_001`

### How it works
1. A new local session receives a UUID and a server-assigned participant number.
2. Name tokens are resolved after that strict creation acknowledgement.
3. `PATCH /api/rename-session/:experimentID` stores the result as `displayName`.
4. The UUID used by results, IndexedDB, and files never changes.

---

## Recruitment Platforms

Stored in Firebase `experiments/{experimentID}.recruitmentConfig`:

```typescript
type RecruitmentConfig = {
  platform: "none" | "prolific" | "mturk";
  prolificCompletionCode: string;
};
```

Save changes with **Save Configuration**; republishing is unnecessary. A resumed session retains its platform and completion code. Redirects and form submission occur after the session's export is confirmed.

### Prolific
- Prolific appends `?PROLIFIC_PID=...` & `STUDY_ID=...` & `SESSION_ID=...` to the experiment URL
- User provides the **completion code** from Prolific
- On `on_finish`, participant is redirected to:
  ```
  https://app.prolific.com/submissions/complete?cc={code}
  ```

### MTurk
- MTurk appends `?workerId=...` & `assignmentId=...` & `hitId=...` & `turkSubmitTo=...`
- On `on_finish`, a form is automatically submitted to Amazon
- Preview detection: if `assignmentId=ASSIGNMENT_ID_NOT_AVAILABLE`, the experiment shows a message instead of starting

---

## CAPTCHA (Anti-Spam)

Stored in Firebase `experiments/{experimentID}.captchaConfig`:

```typescript
type CaptchaConfig = {
  enabled: boolean;
  provider: "hcaptcha" | "recaptcha";
  siteKey: string;           // Public key from the provider
};
```

### How it works

1. The generated HTML supports both CAPTCHA providers. The session response selects the enabled flag, provider and site key; these values are not embedded during publication.
2. A new session uses the saved settings; a resumed session keeps its original settings. When enabled, the key must contain a non-whitespace character.
3. Session registration and presence activation finish before the challenge overlay appears. Trials wait for the challenge to pass.
4. Success sets the experiment-scoped `expbuilder:public:<experimentID>:captcha-passed` marker in `sessionStorage`. Refreshing the same tab retains it; another tab can require the challenge again.
5. Successful completion or choosing a new participation clears the marker. Saving CAPTCHA changes does not require republishing.

### Generated Code (from `CaptchaCode.ts`)

```javascript
function _showCaptchaGate(siteKey, provider) {
  return new Promise((resolve) => {
    // 1. Dynamically load script: js.hcaptcha.com/1/api.js or google.com/recaptcha/api.js
    // 2. Create fullscreen overlay with "Please verify you are human" message
    // 3. Render widget in #captcha-widget div
    // 4. On callback(token): remove overlay, resolve with token
    // 5. On error: reset widget
  });
}
```

### Provider URLs
- **hCaptcha**: `https://js.hcaptcha.com/1/api.js?onload=_captchaReady&render=explicit`
- **reCAPTCHA v2**: `https://www.google.com/recaptcha/api.js?render=explicit&onload=_captchaReady`

### Site Key Sources
- hCaptcha: Get keys at `hcaptcha.com → Sites`
- reCAPTCHA: Get keys at `google.com/recaptcha → Admin Console` (v2 "I am not a robot" checkbox)

---

## Appearance Settings

Stored in `experiment.appearanceSettings` via `PUT /api/appearance-settings/:experimentID`:

**Save Appearance** is independent of public-session configuration. Republish to apply its changes to the public HTML.

```typescript
type AppearanceSettings = {
  backgroundColor: string;  // CSS hex color, max 20 chars. Default: "#ffffff"
  fullScreen: boolean;      // Default: true
  progressBar: boolean;     // Default: false
};
```

### How they apply
- **Background Color**: Injected as CSS `<style>` in both experiment and preview HTML during compilation
- **Full Screen**: When true, adds `plugin-fullscreen` trial at start of timeline and injects CDN script
- **Progress Bar**: Handled by jsPsych timeline configuration

### Appearance during compilation

The server resolves `experiment.appearanceSettings` for local execution, preview
and publication. Missing fields use the same defaults as GET appearance settings:
white (`#ffffff`), fullscreen enabled and progress bar disabled. Construction
requests do not accept a separate appearance. Dynamic surfaces are transparent;
trials do not store or apply a copy of the global background.

---

## Cloudflare Tunnel Settings

Stored in `experiment.tunnelSettings` via `PUT /api/tunnel-settings/:experimentID`:

```typescript
type TunnelSettings = {
  hostname: string;      // Empty = random *.trycloudflare.com URL
  persistent: boolean;   // Keep tunnel running across server restarts
};
```

### Tunnel Lifecycle

#### 1. Configuration (UI)
- User enters a custom domain (e.g., `experiment.mydomain.com`) or leaves blank
- Requirements: domain must be in a Cloudflare-managed DNS zone, `cloudflared tunnel login` must be run on the machine
- Persistent toggle: if on, tunnel starts automatically when the server boots

#### 2. Auto-start (server boot)
```javascript
// server/routes/tunnel.js - setImmediate block
for (const exp of db.data.experiments) {
  const s = exp.tunnelSettings;
  if (!s || !s.persistent || !s.hostname || tunnelProcess) continue;
  
  tunnelProcess = spawn(cloudflaredPath, [
    "tunnel", "--hostname", s.hostname,
    "--url", "http://localhost:3000", "--no-autoupdate"
  ]);
  exp.tunnelUrl = `https://${s.hostname}`;
}
```

#### 3. Manual Start
- `POST /api/create-tunnel` with optional `hostname` and `experimentID`
- Custom hostname: detects connection via `registered tunnel connection` output
- Quick tunnel (random URL): detects `*.trycloudflare.com` from stdout
- Max 3 attempts with 10s timeout each
- On success: persists `tunnelUrl` to experiment document

#### 4. Manual Stop
- `POST /api/close-tunnel` kills the process and clears `tunnelUrl`

### Binary Resolution
```javascript
function getCloudflaredPath() {
  // Platform-specific binary lookup:
  // darwin-arm64 → cloudflared-darwin-arm64
  // darwin-amd64 → cloudflared-darwin-amd64
  // win32-arm64  → cloudflared-windows-arm64.exe
  // win32-amd64  → cloudflared-windows-amd64.exe
  // linux-arm64  → cloudflared-linux-arm64
  // linux-amd64  → cloudflared-linux-amd64
  
  // In production: path.join(process.resourcesPath, "cloudflared", binaryName)
  // In development: path.join(__dirname, "cloudflared", binaryName)
}
```

### Tunnel Process State
- Single global `tunnelProcess` variable (only 1 tunnel at a time)
- Stderr/stdout piped to process output
- On exit: `tunnelProcess = null`

---

## Firebase Firestore Document Structure

For published experiments, Firebase stores:

```typescript
// Collection: "experiments" / Document ID: experimentID
{
  batchConfig: {
    useIndexedDB: boolean,
    batchSize: number,
    resumeTimeoutMinutes: number
  },
  recruitmentConfig: {
    platform: "none" | "prolific" | "mturk",
    prolificCompletionCode: string
  },
  captchaConfig: {
    enabled: boolean,
    provider: "hcaptcha" | "recaptcha",
    siteKey: string
  }
}
```

The fields above are the current editable settings. Successful publication separately replaces one server-confirmed `publishedConfiguration` containing only `storageProvider`, `exportDestination` and `validation`, and sets `sessionExportProtocolVersion: 1`. It does not copy or overwrite the three editable groups.

The protocol 3 document at `experiments/{experimentID}/sessions/{sessionId}` stores its own `configuration`: the current saved settings plus those published provider/destination/validation fields. It also stores the stable export destination. Retrying registration, activating a connection and resuming use that session copy. There is no history of published HTML or separate active settings collection.

The Firebase Firestore client is initialized in `client/src/lib/firebase.ts` and uses `doc()`, `getDoc()`, `setDoc()` from the Firebase Web SDK. The public handshake reads settings on the server; it does not accept replacement configuration supplied by the participant.
