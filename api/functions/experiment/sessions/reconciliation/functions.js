import { onSchedule } from 'firebase-functions/v2/scheduler';
import { reconcileSessionTimeouts } from '../timeout/dispatch.js';
import { reconcileSessionExports } from '../export/dispatch.js';

export const reconcilePendingSessions = onSchedule({ region: 'us-central1', schedule: 'every 1 minutes',
  timeZone: 'UTC', maxInstances: 5, timeoutSeconds: 120 }, async () => {
  const cutoff = Date.now();
  const results = await Promise.allSettled([reconcileSessionTimeouts, reconcileSessionExports]
    .map(reconcile => Promise.resolve().then(() => reconcile(cutoff))));
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length) throw new AggregateError(failures, 'Pending session reconciliation failed');
});
