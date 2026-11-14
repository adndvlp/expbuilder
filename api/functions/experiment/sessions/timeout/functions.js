import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { dispatchSessionTimeout } from './dispatch.js';

export const enqueueSessionTimeout = onDocumentWritten({ region: 'us-central1', retry: true, maxInstances: 5,
  document: 'experiments/{experimentID}/sessions/{sessionId}' }, event => {
  if (event.data?.after.exists && event.data.after.data()?.timeoutPending) return dispatchSessionTimeout(event.params);
});
