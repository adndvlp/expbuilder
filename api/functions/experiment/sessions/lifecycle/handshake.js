import { getDatabase } from 'firebase-admin/database';
import { app, db } from '../../../app.js';
import { deserializeFromFirestore } from '../validation/serialize.js';
import { validateExportIdentity, exportError } from '../export/contract.js';
import { closedSession, resolveLifecycle, tokenHash, timeoutPatch, writerMatches } from './state.js';

function validateConnection(body) {
  if (!/^[\w-]{1,128}$/.test(body.connectionId || '') || typeof body.writeToken !== 'string'
      || body.writeToken.length < 32 || body.writeToken.length > 256) throw exportError('Invalid connection credentials', { status: 400 });
}
function grant(data, body) {
  const generation = (data.connectionGeneration || 0) + 1;
  const patch = { connectionId: body.connectionId, connectionGeneration: generation, writeTokenHash: tokenHash(body.writeToken),
    presenceCheckPending: true, presenceCheckAt: Date.now() + 60000,
    connectionPhase: 'connecting', connectionSetupExpiresAt: Date.now() + 30000,
    lifecycle: 'active', disconnectedAt: null, resumeExpiresAt: null };
  return { ...patch, ...timeoutPatch(patch, 'setup', patch.connectionSetupExpiresAt) };
}
function publicSession(data) {
  const safe = { ...data }; delete safe.writeTokenHash;
  return { ...safe, resumeCheckpoint: deserializeFromFirestore(data.resumeCheckpoint) ?? null,
    connection: { id: data.connectionId, generation: data.connectionGeneration, phase: data.connectionPhase } };
}
export async function handleSessionHandshake(req, res) {
  const body = req.body, { experimentID, sessionId, action } = body;
  try {
    validateExportIdentity(body); validateConnection(body);
    const experimentRef = db.collection('experiments').doc(experimentID), ref = experimentRef.collection('sessions').doc(sessionId);
    const outcome = await db.runTransaction(async transaction => {
      const experiment = await transaction.get(experimentRef), snapshot = await transaction.get(ref);
      if (!experiment.exists) throw exportError('Experiment not found', { status: 404 });
      const config = experiment.data();
      if (config.deleting || snapshot.data()?.deleting) throw exportError('Session is being deleted', { status: 410 });
      if (!snapshot.exists) {
        if (action === 'resumeSession' || action === 'activateConnection') throw exportError('Session not found', { status: 404 });
        if (!config.active) throw exportError('Data collection is not active', { status: 409 });
        if (config.limitSessions && (config.sessions || 0) >= config.maxSessions) throw exportError('Maximum sessions reached', { status: 409 });
        const publication = await transaction.get(experimentRef.collection('publications').doc(body.publicationId || '_missing'));
        if (!publication.exists || publication.data().status !== 'ready' || config.activePublicationId !== body.publicationId
            || publication.data().executionRevision !== body.executionRevision) throw exportError('Publication unavailable; reload the current experiment', { status: 409 });
        const published = publication.data(), participantNumber = config.currentCondition || 0;
        const data = { experimentID, sessionId, participantNumber, condition: participantNumber, sessionProtocolVersion: 3,
          eventProtocolVersion: 1, createdAt: new Date(Date.now()).toISOString(), lifecycle: 'active', trialCount: 0, receivedEventCount: 0,
          publicationId: body.publicationId, executionRevision: published.executionRevision, configuration: published.configuration,
          exportDestination: { ...published.configuration.exportDestination, name: `${experimentID}_${sessionId}.csv` },
          artifactUrl: published.artifactUrl, entryUrl: published.entryUrl, metadata: body.metadata || {},
          ...(body.sessionName && { sessionName: body.sessionName }), ...grant({}, body) };
        transaction.set(ref, data);
        transaction.set(experimentRef, { sessionExportProtocolVersion: 1, sessions: (config.sessions || 0) + 1, currentCondition:
          config.activeConditionAssignment !== false && config.nConditions > 1 ? (participantNumber + 1) % config.nConditions : participantNumber + 1 }, { merge: true });
        return { status: 201, decision: 'resume_allowed', data, lease: true };
      }
      const resolution = await resolveLifecycle(transaction, ref, snapshot.data(), config), data = resolution.data;
      const publication = data.publicationId ? await transaction.get(experimentRef.collection('publications').doc(data.publicationId)) : null;
      resolution.commit();
      if (closedSession(data)) return { status: 200, data, decision: `session_${data.lifecycle}` };
      if (data.sessionProtocolVersion !== 3) return { status: 409, data, decision: 'revision_unavailable' };
      if (body.publicationId && (body.publicationId !== data.publicationId || body.executionRevision !== data.executionRevision)) {
        return { status: 409, data, decision: publication?.data()?.status === 'ready' ? 'revision_mismatch' : 'revision_unavailable' };
      }
      if (action === 'activateConnection') {
        if (!writerMatches(data, body) || resolution.presence?.connected !== true) return { status: 409, data, decision: 'resume_required' };
        const activated = { ...data, connectionPhase: 'active', lifecycle: 'active', timeoutPending: false };
        transaction.set(ref, { connectionPhase: 'active', lifecycle: 'active', timeoutPending: false }, { merge: true });
        return { status: 200, data: activated, decision: 'resume_allowed' };
      }
      const same = data.connectionId === body.connectionId && data.writeTokenHash === tokenHash(body.writeToken);
      if (data.connectionPhase !== 'disconnected' && !same) return { status: 409, data, decision: 'session_in_use' };
      if (same && data.connectionPhase !== 'disconnected' && !body.renewConnection) return { status: 200, data, decision: 'resume_allowed', lease: true };
      const patch = grant(data, body); transaction.set(ref, patch, { merge: true });
      return { status: 200, data: { ...data, ...patch }, decision: 'resume_allowed', lease: true };
    });
    if (outcome.lease) await getDatabase(app).ref(`session_connection_leases/${experimentID}/${sessionId}/${body.connectionId}`)
      .set({ active: true, generation: outcome.data.connectionGeneration, token: body.writeToken });
    const receipts = await ref.collection('event_receipts').get();
    res.status(outcome.status).json({ success: outcome.status < 400, decision: outcome.decision, ...publicSession(outcome.data),
      receivedEvents: receipts.docs.map(doc => { const { eventId, sequence, payloadHash } = doc.data(); return { eventId, sequence, payloadHash }; }).sort((a,b) => a.sequence - b.sequence) });
  } catch (error) {
    if (!error.status) console.error('Session handshake failed', error);
    res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Session handshake unavailable' });
  }
}
