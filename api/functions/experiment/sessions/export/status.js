import { refreshLifecycle } from "../lifecycle/state.js";
import { sessionReference } from './references.js';
import { db } from '../../../app.js';
import { exportError, validateExportIdentity } from './contract.js';

export async function readSessionExportStatus(experimentID, sessionId) {
  validateExportIdentity({ experimentID, sessionId });
  await refreshLifecycle(experimentID, sessionId);
  const ref = sessionReference(experimentID, sessionId), snapshot = await ref.get();
  if (!snapshot.exists) throw exportError('Session not found', { status: 404 });
  const data = snapshot.data();
  const blockingRevision = Math.min(data.exportRequestedRevision || 0, (data.exportConfirmedRevision || 0) + 1);
  const job = blockingRevision ? (await ref.collection('export_jobs').doc(String(blockingRevision)).get()).data() : null;
  return { success: true, experimentID, sessionId, lifecycle: data.lifecycle,
    completion: data.completion || null, export: job ? { revision: job.revision, status: job.status,
      confirmed: ['confirmed', 'empty'].includes(job.status), eventCount: job.eventCount, eventsHash: job.eventsHash,
      requestedRevision: data.exportRequestedRevision, confirmedRevision: data.exportConfirmedRevision || 0, lastError: job.lastError || null,
      resource: data.exportReceipt?.resource || null } : {
      status: ['completed', 'expired'].includes(data.lifecycle) ? 'needs_attention' : 'not_requested', confirmed: false, revision: 0 } };
}

export async function handleExportStatus(req, res, retry = false) {
  const { experimentID, sessionId } = req.body;
  try {
    validateExportIdentity({ experimentID, sessionId });
    if (retry) {
      const ref = sessionReference(experimentID, sessionId);
      await db.runTransaction(async transaction => {
        const session = await transaction.get(ref);
        if (!session.exists || !session.data().exportRequestedRevision) throw exportError('No export job to retry', { status: 404 });
        const revision = Math.min(session.data().exportRequestedRevision, (session.data().exportConfirmedRevision || 0) + 1);
        const jobRef = ref.collection('export_jobs').doc(String(revision));
        const snapshot = await transaction.get(jobRef), job = snapshot.data();
        if (!['needs_attention', 'retry_wait', 'reconciling'].includes(job.status)) return;
        const status = job.phase === 'writing' ? 'reconciling' : 'pending';
        transaction.set(jobRef, { status, attempts: 0, dispatchDue: true, nextDispatchAt: 0, lastError: null }, { merge: true });
        transaction.set(ref, { exportStatus: status }, { merge: true });
      });
    }
    res.status(200).json(await readSessionExportStatus(experimentID, sessionId));
  } catch (error) { res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Export status unavailable' }); }
}
