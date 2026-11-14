import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { dispatchSessionExport } from './dispatch.js';
import { processSessionExport } from './process.js';

export const enqueueSessionExport = onDocumentWritten({ region: 'us-central1', maxInstances: 5, retry: true,
  document: 'experiments/{experimentID}/sessions/{sessionId}/export_jobs/{revision}',
}, async event => {
  if (!event.data?.after.exists) return;
  const after = event.data.after.data(), before = event.data.before?.exists ? event.data.before.data() : null;
  if (!after?.dispatchDue || after.nextDispatchAt > Date.now()) return;
  const retryable = ['pending', 'retry_wait', 'reconciling'].includes(after.status);
  const cleanup = after.status === 'confirmed' && after.cleanupPending;
  if (!retryable && !cleanup) return;
  const requested = !before?.dispatchDue || before.revision !== after.revision
    || after.nextDispatchAt < before.nextDispatchAt
    || (retryable && ((before.status !== after.status && after.attempts <= before.attempts) || after.attempts < before.attempts))
    || (cleanup && !before.cleanupPending);
  if (!requested) return;
  const { experimentID, sessionId, revision } = event.params;
  await dispatchSessionExport({ experimentID, sessionId, revision: Number(revision) });
});
export const processSessionExportTask = onTaskDispatched({ region: 'us-central1', maxInstances: 5, timeoutSeconds: 300, memory: '512MiB',
  retryConfig: { maxAttempts: 8, minBackoffSeconds: 30, maxBackoffSeconds: 900, maxDoublings: 5 },
  rateLimits: { maxConcurrentDispatches: 5, maxDispatchesPerSecond: 5 },
}, request => processSessionExport(request.data));
