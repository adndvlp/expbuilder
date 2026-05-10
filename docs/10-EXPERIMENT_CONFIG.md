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
- **Firebase Firestore** (`client/src/lib/firebase.ts`): For published-experiment settings (batch, recruitment, captcha). These only appear after the experiment has been published.
- **Local Express API + LowDB**: For local-only settings (session naming, appearance, tunnel).

---

## Data Configuration (Batch)

Stored in Firebase `experiments/{experimentID}.batchConfig`:

```typescript
type BatchConfig = {
  useIndexedDB: boolean;       // true: cache trials in browser IndexedDB, batch send
                               // false: send each trial directly to Firestore
  batchSize: number;           // 0: send all at end; >0: batch every N trials
  resumeTimeoutMinutes: number; // 1-1440: minutes before disconnected session data is deleted
};
```

### Behavior by provider
- **IndexedDB enabled**: Trials cached locally. `batchSize=0` → all at once on completion. `batchSize>0` → batches of N trials.
- **IndexedDB disabled**: Trials sent individually to Firestore. Google Drive/Dropbox: partial save on disconnect, append on completion. OSF: only saves after timeout or completion (no PATCH support).

---

## Session Name Configuration

Stored via `POST /api/session-name-config/:experimentID`. Allows composing automatic session names for each participant run.

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
1. Session names with `participantId`/`counter` tokens are resolved after session creation
2. First, session is created with a temporary ID
3. Participant number is calculated from existing sessions
4. `PATCH /api/rename-session/:experimentID` updates the session ID

---

## Recruitment Platforms

Stored in Firebase `experiments/{experimentID}.recruitmentConfig`:

```typescript
type RecruitmentConfig = {
  platform: "none" | "prolific" | "mturk";
  prolificCompletionCode: string;
};
```

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

1. When `enabled: true`, the generated public experiment code includes the CAPTCHA gate
2. Before the experiment starts, a fullscreen overlay appears with a CAPTCHA widget
3. The participant must pass the challenge
4. On success, `sessionStorage.setItem('jsPsych_captchaPassed', '1')` is set
5. On page refresh, `sessionStorage.removeItem('jsPsych_captchaPassed')` clears it

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

### Priority during compilation
```
1. Request body (canvasStyles from frontend)
2. DB: First trial's __canvasStyles columnMapping
3. Experiment's appearanceSettings (always wins for backgroundColor and fullScreen)
```

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

The Firebase Firestore client is initialized in `client/src/lib/firebase.ts` and uses `doc()`, `getDoc()`, `setDoc()` from the Firebase Web SDK.
