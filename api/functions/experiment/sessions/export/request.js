import { sessionReference } from './references.js';
import { db } from '../../../app.js';
import { exportError, exportHash, summarizeEvents, validateExportIdentity } from './contract.js';
import { canonicalEventJson } from '../validation/event-contract.js';
import { resolveFolderIdentifier } from '../finalization/storage-file.js';

// All reads belong to the caller's transaction; planning only buffers writes.
export function planSessionExport(transaction, ref, data, receipts, experiment, patch = {}, unaccounted = false) {
  const effective = { ...data, ...patch };
  const target = summarizeEvents(receipts);
  const state = effective.lifecycle || effective.state || 'active';
  const key = exportHash(canonicalEventJson({ eventsHash: target.eventsHash, state }));
  const completionAt = revision => patch.completion ? { ...patch, completion: { ...patch.completion, revision,
    confirmed: (data.exportConfirmedRevision || 0) >= revision && data.exportReceipt?.eventsHash === target.eventsHash,
  } } : patch;
  if (data.exportHeadKey === key) {
    if (Object.keys(patch).length) transaction.set(ref, completionAt(data.exportRequestedRevision), { merge: true });
    return data.exportRequestedRevision;
  }
  const revision = (data.exportRequestedRevision || 0) + 1;
  const provider = data.exportDestination?.provider || experiment.storageProvider || 'googledrive';
  const destination = data.exportDestination || { provider, owner: experiment.owner ?? null,
    folder: resolveFolderIdentifier(provider, experiment) ?? null, name: `${effective.experimentID}_${effective.sessionId}.csv` };
  const job = { experimentID: effective.experimentID, sessionId: effective.sessionId, revision,
    status: unaccounted ? 'needs_attention' : target.eventCount ? 'pending' : 'empty', dispatchDue: !unaccounted && target.eventCount > 0,
    targetReceiptRevision: effective.receiptRevision || 0,
    eventCount: target.eventCount, eventsHash: target.eventsHash, state,
    destination, session: { participantNumber: effective.participantNumber ?? null, condition: effective.condition ?? null,
      createdAt: effective.createdAt || new Date().toISOString(), sessionName: effective.sessionName || '', metadata: effective.metadata || {} },
    attempts: 0, createdAt: Date.now(), nextDispatchAt: 0, cleanupPending: false };
  const update = { ...completionAt(revision), exportProtocolVersion: 1, exportDestination: destination,
    exportRequestedRevision: revision, exportHeadKey: key, exportStatus: job.status };
  if (!target.eventCount && !unaccounted) {
    update.exportConfirmedRevision = revision;
    update.exportReceipt = { revision, eventCount: 0, eventsHash: target.eventsHash, csvHash: null, resource: null };
    if (effective.completion) update.completion = { ...effective.completion, confirmed: true, status: 'empty', resultsSent: 0, revision };
  }
  transaction.set(ref.collection('export_jobs').doc(String(revision)), job);
  transaction.set(db.collection('experiments').doc(effective.experimentID), { sessionExportProtocolVersion: 1 }, { merge: true });
  transaction.set(ref, update, { merge: true });
  transaction.set(db.collection('experiments').doc(effective.experimentID).collection('session_metadata').doc(effective.sessionId), {
    sessionId: effective.sessionId, state, exportStatus: job.status, requestedExportRevision: revision,
    participantNumber: job.session.participantNumber, condition: job.session.condition, createdAt: job.session.createdAt,
    ...(job.session.sessionName && { sessionName: job.session.sessionName }),
  }, { merge: true });
  return revision;
}

export async function requestSessionExport(experimentID, sessionId, patch = {}) {
  validateExportIdentity({ experimentID, sessionId });
  const ref = sessionReference(experimentID, sessionId);
  const revision = await db.runTransaction(async transaction => {
    const session = await transaction.get(ref);
    const experiment = await transaction.get(db.collection('experiments').doc(experimentID));
    const receipts = await transaction.get(ref.collection('event_receipts'));
    const trials = await transaction.get(ref.collection('trials'));
    if (!session.exists || !experiment.exists) throw exportError('Session or experiment not found', { status: 404 });
    if (session.data().deleting || experiment.data().deleting) throw exportError('Session is being deleted', { status: 410 });
    if (['completed', 'expired'].includes(session.data().lifecycle) && patch.lifecycle && patch.lifecycle !== session.data().lifecycle) {
      throw exportError('Session is already closed', { status: 409, code: 'SESSION_ALREADY_CLOSED' });
    }
    const known = new Set(receipts.docs.map(doc => doc.id));
    return planSessionExport(transaction, ref, session.data(), receipts.docs.map(doc => doc.data()), experiment.data(), patch,
      trials.docs.some(doc => !known.has(doc.id)));
  });
  const job = (await ref.collection('export_jobs').doc(String(revision)).get()).data();
  return { success: true, revision, pending: !['confirmed', 'empty'].includes(job.status), exportStatus: job.status,
    resultsSent: ['confirmed', 'empty'].includes(job.status) ? job.eventCount : 0 };
}
