import { db } from '../../../app.js';
import { exportError } from './contract.js';
import { sessionReference } from './references.js';

export async function prepareSessionExportDeletion(experimentID, sessionId) {
  const ref = sessionReference(experimentID, sessionId);
  const initial = await ref.get(), initialData = initial?.data?.();
  if (!initialData || !(initialData.sessionProtocolVersion === 2 || initialData.exportProtocolVersion === 1)) return null;
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref), data = snapshot?.data?.();
    if (!data || !(data.sessionProtocolVersion === 2 || data.exportProtocolVersion === 1)) return null;
    const revision = (data.exportConfirmedRevision || 0) + 1;
    const job = revision <= (data.exportRequestedRevision || 0)
      ? (await transaction.get(ref.collection('export_jobs').doc(String(revision)))).data() : null;
    if (data.exportLeaseUntil > Date.now() || (job?.phase === 'writing' && !['confirmed', 'empty'].includes(job.status))) {
      throw exportError('Reconcile the active or uncertain export before deleting this session', { status: 409 });
    }
    transaction.set(ref, { deleting: true, exportFence: (data.exportFence || 0) + 1 }, { merge: true });
    return data;
  });
}
async function drain(collection) {
  while (true) {
    const page = await collection.limit(200).get();
    if (page.empty) return;
    const batch = db.batch(); page.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit();
  }
}
export async function purgeSessionExportData(ref) {
  while (true) {
    const page = await ref.collection('export_jobs').limit(100).get();
    if (page.empty) break;
    for (const doc of page.docs) await drain(doc.ref.collection('chunks'));
    const batch = db.batch(); page.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit();
  }
  await drain(ref.collection('event_receipts')); await drain(ref.collection('trials')); await ref.delete();
}
export async function prepareExperimentExportDeletion(experimentRef) {
  await experimentRef.set({ deleting: true, active: false }, { merge: true });
  const uncertain = await db.collectionGroup('export_jobs').where('experimentID', '==', experimentRef.id)
    .where('phase', '==', 'writing').where('status', 'in', ['running', 'reconciling', 'needs_attention', 'retry_wait']).limit(1).get();
  if (!uncertain.empty) throw exportError('Reconcile active or uncertain session exports before deleting this experiment', { status: 409 });
}
