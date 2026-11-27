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
      lastErrorCode: job.lastErrorCode || null,
      resource: data.exportReceipt?.resource || null } : {
      status: ['completed', 'expired'].includes(data.lifecycle) ? 'needs_attention' : 'not_requested', confirmed: false, revision: 0 } };
}

/**
 * Pure evaluation of whether a job may be reactivated, shared by the public
 * `retryExport` action and the administrative CLI so both enforce the same
 * invariants. No writes.
 */
export function evaluateExportJobForReactivation(data, job, experiment, { expectedCodes = null, now = Date.now } = {}) {
  if (!job) return { ok: false, reason: 'job_missing' };
  if (!['needs_attention', 'retry_wait', 'reconciling'].includes(job.status)) {
    return { ok: false, reason: 'status_not_retryable' };
  }
  if (expectedCodes && !expectedCodes.includes(job.lastErrorCode)) {
    return { ok: false, reason: 'code_filter' };
  }
  if (data?.deleting || !experiment || experiment.deleting) {
    return { ok: false, reason: 'deleting' };
  }
  if ((data?.exportLeaseUntil || 0) > now()) {
    return { ok: false, reason: 'lease_active' };
  }
  return { ok: true };
}

/**
 * Reactivates an existing export job revision in a transaction. Shared by the
 * public `retryExport` action and the administrative CLI so both behave
 * identically. Only `needs_attention`, `retry_wait` and `reconciling` jobs can
 * be reactivated; when `expectedCodes` is provided, the job's `lastErrorCode`
 * must be included (jobs without a code never match a code filter).
 */
export async function reactivateExportJob(ref, { expectedCodes = null, expectedRevision = null } = {}) {
  return db.runTransaction(async transaction => {
    const session = await transaction.get(ref);
    if (!session.exists || !session.data().exportRequestedRevision) {
      return { ok: false, reason: 'no_export_job' };
    }
    const data = session.data();
    const revision = Math.min(data.exportRequestedRevision, (data.exportConfirmedRevision || 0) + 1);
    if (expectedRevision != null && revision !== expectedRevision) {
      return { ok: false, reason: 'revision_mismatch', revision };
    }
    const jobRef = ref.collection('export_jobs').doc(String(revision));
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) return { ok: false, reason: 'job_missing', revision };
    const job = snapshot.data();
    const experimentSnapshot = await transaction.get(db.collection('experiments').doc(job.experimentID));
    const verdict = evaluateExportJobForReactivation(
      data,
      job,
      experimentSnapshot.exists ? experimentSnapshot.data() : null,
      { expectedCodes },
    );
    if (!verdict.ok) return { ok: false, reason: verdict.reason, revision };
    const status = job.phase === 'writing' ? 'reconciling' : 'pending';
    transaction.set(jobRef, { status, attempts: 0, dispatchDue: true, nextDispatchAt: 0,
      lastError: null, lastErrorCode: null }, { merge: true });
    transaction.set(ref, { exportStatus: status }, { merge: true });
    return { ok: true, revision, status };
  });
}

export async function handleExportStatus(req, res, retry = false) {
  const { experimentID, sessionId } = req.body;
  try {
    validateExportIdentity({ experimentID, sessionId });
    if (retry) {
      const ref = sessionReference(experimentID, sessionId);
      const reactivated = await reactivateExportJob(ref);
      if (!reactivated.ok && reactivated.reason === 'no_export_job') {
        throw exportError('No export job to retry', { status: 404 });
      }
    }
    res.status(200).json(await readSessionExportStatus(experimentID, sessionId));
  } catch (error) { res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Export status unavailable' }); }
}
