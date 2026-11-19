import { getFunctions } from 'firebase-admin/functions';
import { app, db } from '../../../app.js';
import { sessionReference } from './references.js';
import { validateExportIdentity } from './contract.js';

export const EXPORT_TASK_QUEUE = 'locations/us-central1/functions/processSessionExportTask';
export async function dispatchSessionExport(payload, now = Date.now) {
  const identity = validateExportIdentity(payload, true);
  const ref = sessionReference(identity.experimentID, identity.sessionId), jobRef = ref.collection('export_jobs').doc(String(identity.revision));
  const generation = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(jobRef), session = await transaction.get(ref);
    const experiment = await transaction.get(db.collection('experiments').doc(identity.experimentID));
    if (!snapshot.exists || !session.exists) return null;
    if (session.data().deleting || !experiment.exists || experiment.data().deleting) return null;
    const job = snapshot.data(), data = session.data(), time = now();
    if (!job.dispatchDue || job.nextDispatchAt > time || data.exportLeaseUntil > time
        || (data.exportConfirmedRevision || 0) < identity.revision - 1) return null;
    const generation = (job.dispatchGeneration || 0) + 1;
    transaction.set(jobRef, { dispatchGeneration: generation, lastDispatchAt: time, nextDispatchAt: time + 60_000 }, { merge: true });
    return generation;
  });
  if (!generation) return { dispatched: false };
  try {
    await getFunctions(app).taskQueue(EXPORT_TASK_QUEUE).enqueue({ ...identity, dispatchGeneration: generation }, { dispatchDeadlineSeconds: 300 });
    return { dispatched: true };
  } catch (error) {
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(jobRef);
      if (!snapshot.exists || snapshot.data().dispatchGeneration !== generation || !snapshot.data().dispatchDue) return;
      transaction.set(jobRef, { nextDispatchAt: now() + 30_000, lastDispatchError: 'Task enqueue failed' }, { merge: true });
    });
    throw error;
  }
}

export async function reconcileSessionExports(time = Date.now()) {
  const snapshot = await db.collectionGroup('export_jobs').where('dispatchDue', '==', true)
    .where('nextDispatchAt', '<=', time).orderBy('nextDispatchAt').limit(100).get();
  const results = await Promise.allSettled(snapshot.docs.map(doc => {
    const job = doc.data(); return dispatchSessionExport({ experimentID: job.experimentID, sessionId: job.sessionId, revision: job.revision }, () => time);
  }));
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) throw new Error(`${failures.length} export jobs could not be enqueued`);
  return { inspected: snapshot.size };
}
