import { createHash } from 'node:crypto';
import { getDatabase } from 'firebase-admin/database';
import { app, db } from '../../../app.js';
import { planSessionExport } from '../export/request.js';
import { sessionReference } from '../export/references.js';

export const closedSession = data => ['completed', 'expired'].includes(data.lifecycle);
export const tokenHash = value => createHash('sha256').update(value || '').digest('hex');
export function writerMatches(data, body) {
  return data.connectionId === body.connectionId && data.connectionGeneration === body.connectionGeneration
    && data.writeTokenHash === tokenHash(body.writeToken);
}
export function timeoutPatch(data, kind, expiresAt) {
  return { timeoutPending: true, timeoutKind: kind, timeoutExpiresAt: expiresAt,
    timeoutGeneration: data.connectionGeneration, timeoutNextDispatchAt: 0 };
}

// This read is shared by HTTP, presence and timeout paths. Buffer writes only
// after the caller has finished all Firestore reads in its transaction.
export async function resolveLifecycle(transaction, ref, previous, experiment, now = Date.now) {
  let data = { ...previous }, patch = {}, receipts = null, trials = null;
  if (data.sessionProtocolVersion !== 3) return { data, commit() {} };
  if (closedSession(data)) return { data, commit() {
    if (data.presenceCheckPending) transaction.set(ref, { presenceCheckPending: false }, { merge: true });
  } };
  patch = { presenceCheckPending: true, presenceCheckAt: now() + 60000 };
  const presence = (await getDatabase(app).ref(`session_connections/${data.experimentID}/${data.sessionId}/${data.connectionId}`).once('value')).val();
  const matches = presence?.generation === data.connectionGeneration && tokenHash(presence?.token) === data.writeTokenHash;
  if (matches && presence.connected === false && Number.isFinite(presence.changedAt) && data.connectionPhase !== 'disconnected') {
    const disconnectedAt = data.disconnectedAt ?? presence.changedAt;
    const resumeExpiresAt = disconnectedAt + data.configuration.batchConfig.resumeTimeoutMinutes * 60000;
    patch = { ...patch, lifecycle: 'disconnected', connectionPhase: 'disconnected', disconnectedAt, resumeExpiresAt,
      ...timeoutPatch(data, 'deadline', resumeExpiresAt) };
  } else if (data.connectionPhase === 'connecting' && now() >= data.connectionSetupExpiresAt && !matches) {
    const disconnectedAt = data.connectionSetupExpiresAt;
    const resumeExpiresAt = disconnectedAt + data.configuration.batchConfig.resumeTimeoutMinutes * 60000;
    patch = { ...patch, lifecycle: 'disconnected', connectionPhase: 'disconnected', disconnectedAt, resumeExpiresAt,
      ...timeoutPatch(data, 'deadline', resumeExpiresAt) };
  }
  data = { ...data, ...patch };
  if (data.lifecycle === 'disconnected' && now() >= data.resumeExpiresAt) {
    patch = { ...patch, lifecycle: 'expired', closedAt: new Date(data.resumeExpiresAt).toISOString(),
      closeReason: 'timeout', timeoutPending: false, presenceCheckPending: false };
    receipts = await transaction.get(ref.collection('event_receipts'));
    trials = await transaction.get(ref.collection('trials'));
    data = { ...data, ...patch };
  }
  return { data, patch, presence: matches ? presence : null, commit() {
    if (receipts) {
      const known = new Set(receipts.docs.map(doc => doc.id));
      planSessionExport(transaction, ref, previous, receipts.docs.map(doc => doc.data()), experiment, patch,
        trials.docs.some(doc => !known.has(doc.id)));
    } else if (Object.keys(patch).length) transaction.set(ref, patch, { merge: true });
  } };
}

export async function refreshLifecycle(experimentID, sessionId, expected, now = Date.now) {
  const ref = sessionReference(experimentID, sessionId);
  return db.runTransaction(async transaction => {
    const session = await transaction.get(ref);
    if (!session.exists || session.data().sessionProtocolVersion !== 3) return null;
    const previous = session.data();
    if (expected && (previous.connectionId !== expected.connectionId || previous.connectionGeneration !== expected.connectionGeneration)) return previous;
    const experiment = await transaction.get(db.collection('experiments').doc(experimentID));
    if (previous.deleting || !experiment.exists || experiment.data().deleting) {
      transaction.set(ref, { presenceCheckPending: false, timeoutPending: false }, { merge: true }); return previous;
    }
    const resolution = await resolveLifecycle(transaction, ref, previous, experiment.data(), now);
    resolution.commit(); return resolution.data;
  });
}

export function lifecycleRejection(data, body) {
  if (closedSession(data)) return { decision: `session_${data.lifecycle}`, lifecycle: data.lifecycle };
  if (!writerMatches(data, body) || data.connectionPhase !== 'active' || data.lifecycle !== 'active') {
    return { decision: 'resume_required', lifecycle: data.lifecycle };
  }
  return null;
}
