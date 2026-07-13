import type { DocSection } from "./types";

export const SessionPublicSection: DocSection = {
  id: "session-public",
  title: "Session — Published Mode",
  content: `# Session — Published Mode

Generated from \`ExperimentCode/PublicConfiguration.ts\`. Completely self-contained: no Express server required.

## Firebase Realtime Database

The Firebase SDK is loaded dynamically from CDN:

\`\`\`js
// Sequential loading: first app-compat, then database-compat
function waitForFirebase() {
return new Promise(resolve => {
  const check = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.database) {
      clearInterval(check); resolve();
    }
  }, 50);
});
}

const firebaseConfig = { /* baked-in credentials */ };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
\`\`\`

### Session Node Structure in Firebase

\`\`\`text
/experiments/:experimentID/sessions/:sessionId
├── state:          "pending" | "in-progress" | "completed"
├── connected:      true | false
├── participantNumber: 42
├── startedAt:      ServerValue.TIMESTAMP
├── finishedAt:     ServerValue.TIMESTAMP
├── lastUpdate:     ServerValue.TIMESTAMP
└── recruitment:    { platform, pid, studyId, ... }
\`\`\`

### onDisconnect Cleanup

If the participant closes the browser unexpectedly, Firebase detects the disconnection and updates the state:

\`\`\`js
const sessionRef = db.ref("experiments/" + experimentID + "/sessions/" + sessionId);
sessionRef.onDisconnect().update({ connected: false, state: 'disconnected' });
\`\`\`

## IndexedDB — TrialDB

Wrapper for buffering trials before sending them in batch. Minimizes HTTP requests and handles connection loss.

\`\`\`js
const TrialDB = {
dbName: 'jsPsychTrialsDB',
storeName: 'trials',
ttl: 3 * 24 * 60 * 60 * 1000, // 3 days

init()            // Creates/opens DB with indexes: sessionId, timestamp, createdAt
add(trial)        // Inserts a trial with timestamp + sessionId
getAll()          // All pending trials
getN(n)           // First N trials (for batch sending)
count()           // Total trials in buffer
deleteN(n)        // Deletes first N (after successful send)
clear()           // Empties the entire store
cleanExpiredData() // Deletes trials with TTL > 3 days
};
\`\`\`

### Batching Configuration

Obtained from Firestore at experiment start:

\`\`\`js
const BATCH_CONFIG = {
useIndexedDB: true,  // false → trial-by-trial directly to Firebase
size: 10,            // send batch every N trials. 0 → all together at the end
currentBatchNumber: 0,
};
\`\`\`

### Data Flow in on_data_update

\`\`\`mermaid
flowchart TD
  A["Trial completed"] --> B["Add clientTimestamp, sessionId, experimentID"]
  B --> C{"BATCH_CONFIG.useIndexedDB?"}

  C -->|true| D["TrialDB.add(data)"]
  D --> E{"count >= BATCH_CONFIG.size?"}
  E -->|yes| F["getN(size) → sendBatchConcatenated()"]
  F --> G["deleteN(size)"]
  E -->|no| H["Wait for next trial"]

  C -->|false| I["fetch POST directly to Firebase"]
  I --> J["sessionRef.update({ lastUpdate })"]
\`\`\`

### sendBatchConcatenated vs sendCompleteExperiment

| Function | When used | How it sends |
|---|---|---|
| \`sendBatchConcatenated\` | \`BATCH_CONFIG.size > 0\` | Concatenates trials with \`\\n\`, single POST |
| \`sendCompleteExperiment\` | \`BATCH_CONFIG.size === 0\` (on_finish) | All trials together at the end |

## CAPTCHA Gate (published only)

\`\`\`js
// Supports hCaptcha and reCAPTCHA v2
const token = await _showCaptchaGate(siteKey, 'hcaptcha');
// → full-screen overlay "Please verify you are human"
// → dynamic script loading (js.hcaptcha.com or google.com/recaptcha)
// → experiment does not start until CAPTCHA is resolved
// → skipped on jump reloads (resume)
\`\`\`

## Recruitment (published only)

At the end of the experiment, if a recruitment platform is detected, automatic redirection occurs:

\`\`\`js
// Prolific: query string → ?PROLIFIC_PID=...&STUDY_ID=...&SESSION_ID=...
if (PROLIFIC_PID) {
window.location.href = "https://app.prolific.com/submissions/complete?cc=XXXX";
}

// MTurk: query string → ?workerId=...&assignmentId=...&hitId=...
if (assignmentId && assignmentId !== 'ASSIGNMENT_ID_NOT_AVAILABLE') {
document.getElementById('mturk-form').submit();
}

// MTurk preview mode: assignmentId === 'ASSIGNMENT_ID_NOT_AVAILABLE'
// → experiment does not start (blocked at startup)

// No platform → _showSuccess()
\`\`\`
`,
};
