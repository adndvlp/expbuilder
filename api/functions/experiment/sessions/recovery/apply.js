import { db } from '../../../app.js';
import { planSessionExport } from '../export/request.js';
import { summarizeEvents } from '../export/contract.js';
import { recoveryHash, verifyHistoricalPlan } from './plan.js';

function encode(value) {
  if (Array.isArray(value)) return value.some(item => item && typeof item === 'object') ? { __json: JSON.stringify(value) } : value;
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) : value;
}
function requireState(condition, message) { if (!condition) throw new Error(message); }
export async function applyHistoricalPlan(plan, { projectId, inspectRemote }) {
  verifyHistoricalPlan(plan); requireState(projectId === plan.projectId, 'Recovery project differs from the approved plan');
  const experimentRef = db.collection('experiments').doc(plan.experimentID), ref = experimentRef.collection('sessions').doc(plan.sessionId);
  const journal = ref.collection('recovery_plans').doc(plan.planId);
  const previous = await journal.get();
  if (previous.exists && previous.data().status === 'export_requested') return previous.data().result;
  const remote = await inspectRemote(plan.destination);
  requireState(recoveryHash(remote) === recoveryHash(plan.remote), 'The provider changed after inspection');
  await db.runTransaction(async transaction => {
    const experiment = await transaction.get(experimentRef), parent = await transaction.get(ref), record = await transaction.get(journal);
    const metadata = await transaction.get(experimentRef.collection('session_metadata').doc(plan.sessionId));
    const sources = await transaction.get(ref.collection('trials'));
    const existingReceipts = await transaction.get(ref.collection('event_receipts'));
    requireState(experiment.exists && !experiment.data().deleting && !parent.data()?.deleting, 'The source is being deleted or missing');
    if (record.exists) {
      requireState(parent.data()?.historicalRecovery?.planId === plan.planId, 'Another recovery owns this session'); return;
    }
    requireState(existingReceipts.empty, 'Existing event identities require versioned export reconciliation');
    requireState(recoveryHash({ session: parent.data() || {}, metadata: metadata.data() || {}, owner: experiment.data().owner }) === plan.sourceStateHash, 'Session identity changed after inspection');
    requireState(sources.size === plan.sources.length && sources.docs.every(doc => plan.sources.some(source => source.id === doc.id && source.hash === recoveryHash(doc.data()))), 'Source payloads changed after inspection');
    requireState(!plan.events.some(event => plan.sources.some(source => source.id === event.eventId)), 'Recovery identity collides with a source');
    transaction.set(ref, { ...plan.identity, experimentID: plan.experimentID, sessionId: plan.sessionId, sessionProtocolVersion: 2,
      eventProtocolVersion: 1, lifecycle: 'expired', closedAt: new Date().toISOString(), closeReason: 'historical_recovery',
      exportDestination: plan.destination, receivedEventCount: 0, trialCount: 0, receiptRevision: 0,
      historicalRecovery: { planId: plan.planId, status: 'preparing', sourceDocumentCount: plan.sources.length } }, { merge: true });
    transaction.set(journal, { planId: plan.planId, status: 'preparing', createdAt: Date.now(), sourceCount: plan.sources.length, eventCount: plan.events.length });
    transaction.set(experimentRef, { sessionExportProtocolVersion: 1 }, { merge: true });
  });
  for (const source of plan.sources) {
    const sourceRef = ref.collection('trials').doc(source.id), archiveRef = ref.collection('recovery_sources').doc(source.id);
    await db.runTransaction(async transaction => {
      const current = await transaction.get(sourceRef), archive = await transaction.get(archiveRef), parent = await transaction.get(ref);
      requireState(!parent.data()?.deleting && parent.data()?.historicalRecovery?.planId === plan.planId, 'Recovery ownership changed');
      if (archive.exists) { requireState(archive.data().hash === source.hash, 'The original archive differs'); return; }
      requireState(current.exists && recoveryHash(current.data()) === source.hash, 'The original payload changed');
      transaction.set(archiveRef, { planId: plan.planId, hash: source.hash, data: current.data() });
    });
  }
  for (let offset = 0; offset < plan.events.length; offset += 100) {
    const events = plan.events.slice(offset, offset + 100);
    await db.runTransaction(async transaction => {
      const parent = await transaction.get(ref);
      const receipts = await Promise.all(events.map(event => transaction.get(ref.collection('event_receipts').doc(event.eventId))));
      requireState(!parent.data()?.deleting && parent.data()?.historicalRecovery?.planId === plan.planId, 'Recovery ownership changed');
      let inserted = 0; const revision = (parent.data().receiptRevision || 0) + 1;
      events.forEach((event, index) => {
        if (receipts[index].exists) { requireState(receipts[index].data().payloadHash === event.payloadHash && receipts[index].data().sequence === event.sequence, 'An event receipt differs'); return; }
        transaction.set(ref.collection('trials').doc(event.eventId), { ...encode(event.payload), event_id: event.eventId, event_sequence: event.sequence });
        transaction.set(ref.collection('event_receipts').doc(event.eventId), { eventId: event.eventId, sequence: event.sequence, payloadHash: event.payloadHash, receiptRevision: revision, receivedAt: new Date().toISOString() });
        inserted++;
      });
      if (inserted) transaction.set(ref, { receivedEventCount: parent.data().receivedEventCount + inserted, trialCount: parent.data().trialCount + inserted, receiptRevision: revision }, { merge: true });
    });
  }
  // The durable original archive and converted event payloads both exist before
  // removing a legacy container. An interruption resumes with the same IDs.
  for (const source of plan.sources) {
    await db.runTransaction(async transaction => {
      const sourceRef = ref.collection('trials').doc(source.id), current = await transaction.get(sourceRef);
      const archive = await transaction.get(ref.collection('recovery_sources').doc(source.id));
      const parent = await transaction.get(ref);
      requireState(!parent.data()?.deleting && parent.data()?.historicalRecovery?.planId === plan.planId && archive.data()?.hash === source.hash, 'Original backup is unavailable');
      if (!current.exists) return;
      requireState(recoveryHash(current.data()) === source.hash, 'A legacy source changed during recovery');
      transaction.delete(sourceRef);
    });
  }
  return db.runTransaction(async transaction => {
    const parent = await transaction.get(ref), experiment = await transaction.get(experimentRef), recorded = await transaction.get(journal);
    const receipts = await transaction.get(ref.collection('event_receipts')), trials = await transaction.get(ref.collection('trials'));
    requireState(!parent.data()?.deleting && !experiment.data()?.deleting && parent.data()?.historicalRecovery?.planId === plan.planId, 'Recovery ownership changed');
    if (recorded.data()?.status === 'export_requested') return recorded.data().result;
    requireState(summarizeEvents(receipts.docs.map(doc => doc.data())).eventsHash === summarizeEvents(plan.events).eventsHash
      && trials.size === plan.events.length && trials.docs.every(doc => plan.events.some(event => event.eventId === doc.id)), 'Unexpected or missing payloads require reconciliation');
    const revision = planSessionExport(transaction, ref, parent.data(), receipts.docs.map(doc => doc.data()), experiment.data(),
      { historicalRecovery: { planId: plan.planId, status: 'export_requested', sourceDocumentCount: plan.sources.length } });
    const result = { planId: plan.planId, revision, eventCount: plan.events.length, status: 'export_requested' };
    transaction.set(journal, { status: 'export_requested', result }, { merge: true });
    return result;
  });
}
