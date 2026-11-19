import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { dispatchSessionTimeout } from './dispatch.js';

export const enqueueSessionTimeout = onDocumentWritten({ region: 'us-central1', retry: true, maxInstances: 5,
  document: 'experiments/{experimentID}/sessions/{sessionId}' }, event => {
  if (!event.data?.after.exists) return;
  const after = event.data.after.data(), before = event.data.before?.exists ? event.data.before.data() : null;
  if (!after?.timeoutPending || after.timeoutNextDispatchAt > Date.now()) return;
  const changedIdentity = ['connectionId', 'connectionGeneration', 'timeoutKind', 'timeoutExpiresAt']
    .some(key => before?.[key] !== after[key]);
  if (!before?.timeoutPending || changedIdentity || after.timeoutNextDispatchAt < before.timeoutNextDispatchAt) {
    return dispatchSessionTimeout(event.params);
  }
});
