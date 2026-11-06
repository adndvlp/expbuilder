import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { dispatchSessionExport, reconcileSessionExports } from './dispatch.js';
import { processSessionExport } from './process.js';

export const enqueueSessionExport = onDocumentWritten({ region: 'us-central1', maxInstances: 5, retry: true,
  document: 'experiments/{experimentID}/sessions/{sessionId}/export_jobs/{revision}',
}, async event => {
  if (!event.data?.after.exists || !event.data.after.data()?.dispatchDue) return;
  const { experimentID, sessionId, revision } = event.params;
  await dispatchSessionExport({ experimentID, sessionId, revision: Number(revision) });
});
export const processSessionExportTask = onTaskDispatched({ region: 'us-central1', maxInstances: 5, timeoutSeconds: 300, memory: '512MiB',
  retryConfig: { maxAttempts: 8, minBackoffSeconds: 30, maxBackoffSeconds: 900, maxDoublings: 5 },
  rateLimits: { maxConcurrentDispatches: 5, maxDispatchesPerSecond: 5 },
}, request => processSessionExport(request.data));
export const reconcilePendingSessionExports = onSchedule({ region: 'us-central1', maxInstances: 5, schedule: 'every 1 minutes', timeZone: 'UTC', timeoutSeconds: 120 },
  () => reconcileSessionExports());
