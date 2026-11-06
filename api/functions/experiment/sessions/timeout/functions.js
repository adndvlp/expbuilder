import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { dispatchSessionTimeout, reconcileSessionTimeouts } from './dispatch.js';

export const enqueueSessionTimeout = onDocumentWritten({ region: 'us-central1', retry: true, maxInstances: 5,
  document: 'experiments/{experimentID}/sessions/{sessionId}' }, event => {
  if (event.data?.after.exists && event.data.after.data()?.timeoutPending) return dispatchSessionTimeout(event.params);
});
export const reconcilePendingSessionTimeouts = onSchedule({ region: 'us-central1', schedule: 'every 1 minutes', timeZone: 'UTC', maxInstances: 5, timeoutSeconds: 120 },
  () => reconcileSessionTimeouts());
