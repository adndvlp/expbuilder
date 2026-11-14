import { refreshLifecycle } from '../lifecycle/state.js';
import { db } from '../../../app.js';
import { sessionReference } from '../export/references.js';
import { scheduleSessionTimeoutTask } from './queue.js';

export async function dispatchSessionTimeout({ experimentID, sessionId }, now = Date.now()) {
  const ref = sessionReference(experimentID, sessionId);
  const payload = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const experiment = await transaction.get(db.collection('experiments').doc(experimentID));
    const data = snapshot.data();
    if (!data?.timeoutPending || data.timeoutNextDispatchAt > now || data.deleting || !experiment.exists || experiment.data().deleting) return null;
    transaction.set(ref, { timeoutNextDispatchAt: Math.max(now, data.timeoutExpiresAt) + 60000 }, { merge: true });
    return { experimentID, sessionId, expiresAt: data.timeoutExpiresAt, connectionId: data.connectionId,
      connectionGeneration: data.connectionGeneration, kind: data.timeoutKind };
  });
  if (!payload) return;
  try { await scheduleSessionTimeoutTask(payload); }
  catch (error) {
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref), data = snapshot.data();
      if (data?.timeoutPending && data.connectionGeneration === payload.connectionGeneration && data.timeoutExpiresAt === payload.expiresAt) {
        transaction.set(ref, { timeoutNextDispatchAt: now + 30000 }, { merge: true });
      }
    });
    throw error;
  }
}
export async function reconcileSessionTimeouts(now = Date.now()) {
  const connections = await db.collectionGroup('sessions').where('presenceCheckPending', '==', true)
    .where('presenceCheckAt', '<=', now).orderBy('presenceCheckAt').limit(100).get();
  const checked = await Promise.allSettled(connections.docs.map(doc => {
    const data = doc.data(); return refreshLifecycle(data.experimentID, data.sessionId, undefined, () => now);
  }));
  const snapshot = await db.collectionGroup('sessions').where('timeoutPending', '==', true)
    .where('timeoutNextDispatchAt', '<=', now).orderBy('timeoutNextDispatchAt').limit(100).get();
  const results = await Promise.allSettled(snapshot.docs.map(doc => dispatchSessionTimeout(doc.data(), now)));
  if ([...checked, ...results].some(result => result.status === 'rejected')) throw new Error('Some session timeouts could not be enqueued');
}
