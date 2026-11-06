import { db } from '../../../app.js';
import { EXPORT_LEASE_MS, EXPORT_MAX_ATTEMPTS, exportError } from './contract.js';

export const staleWorker = () => exportError('Export worker superseded', { code: 'EXPORT_STALE_WORKER' });
export async function acquireExportLease(ref, jobRef, revision, now) {
  return db.runTransaction(async transaction => {
    const session = await transaction.get(ref), snapshot = await transaction.get(jobRef);
    if (!session.exists || !snapshot.exists) return { missing: true };
    const data = session.data(), job = snapshot.data();
    const experiment = await transaction.get(db.collection('experiments').doc(job.experimentID));
    if (!experiment?.exists || experiment.data().deleting || data.deleting) return { missing: true };
    if (['confirmed', 'empty'].includes(job.status)) return { job, session: data, confirmed: true };
    if (job.status === 'needs_attention') return { attention: true, job };
    if ((data.exportConfirmedRevision || 0) < revision - 1) throw exportError('Earlier export revision is still pending');
    if (data.exportLeaseUntil > now) throw exportError('An export worker is still active');
    if (job.attempts >= EXPORT_MAX_ATTEMPTS) {
      transaction.set(jobRef, { status: 'needs_attention', dispatchDue: false, lastError: 'Automatic export attempts exhausted' }, { merge: true });
      transaction.set(ref, { exportStatus: 'needs_attention' }, { merge: true });
      return { attention: true, job };
    }
    const fence = (data.exportFence || 0) + 1;
    const status = job.phase === 'writing' ? 'reconciling' : 'running';
    transaction.set(ref, { exportFence: fence, exportLeaseRevision: revision, exportLeaseUntil: now + EXPORT_LEASE_MS,
      ...(data.exportRequestedRevision === revision && { exportStatus: status }) }, { merge: true });
    transaction.set(jobRef, { fence, status, attempts: job.attempts + 1, startedAt: now }, { merge: true });
    return { session: data, job: { ...job, fence, status, attempts: job.attempts + 1 }, fence };
  });
}
export async function fencedExportUpdate(ref, jobRef, fence, jobPatch = {}, sessionPatch = {}) {
  return db.runTransaction(async transaction => {
    const session = await transaction.get(ref), job = await transaction.get(jobRef);
    const experiment = job.exists ? await transaction.get(db.collection('experiments').doc(job.data().experimentID)) : null;
    if (!session.exists || !job.exists || session.data().exportFence !== fence || job.data().fence !== fence
        || session.data().deleting || !experiment?.exists || experiment.data().deleting
        || ['confirmed', 'empty', 'needs_attention'].includes(job.data().status)) throw staleWorker();
    transaction.set(jobRef, jobPatch, { merge: true });
    if (Object.keys(sessionPatch).length) transaction.set(ref, sessionPatch, { merge: true });
    if (sessionPatch.exportStatus) transaction.set(db.collection('experiments').doc(job.data().experimentID).collection('session_metadata').doc(job.data().sessionId),
      { exportStatus: sessionPatch.exportStatus, lastExportError: jobPatch.lastError || null }, { merge: true });
  });
}
