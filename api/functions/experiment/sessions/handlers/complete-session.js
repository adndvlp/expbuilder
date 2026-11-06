import { resolveLifecycle, lifecycleRejection } from "../lifecycle/state.js";
import { sessionReference } from "../export/references.js";
import { db } from "../../../app.js";
import { planSessionExport } from "../export/request.js";
import { readSessionExportStatus } from "../export/status.js";
import { exportError, summarizeEvents, validateExportIdentity } from "../export/contract.js";

export async function handleCompleteSession(req, res) {
  const { experimentID, sessionId, expectedEventCount, expectedLastSequence, eventsHash } = req.body;
  try {
    validateExportIdentity({ experimentID, sessionId });
    if (!Number.isSafeInteger(expectedEventCount) || expectedEventCount < 0 || !Number.isSafeInteger(expectedLastSequence)
        || expectedLastSequence < -1 || !/^[a-f0-9]{64}$/.test(eventsHash ?? "")) throw exportError("Invalid expected event set", { status: 400 });
    const ref = sessionReference(experimentID, sessionId);
    const rejected = await db.runTransaction(async transaction => {
      const session = await transaction.get(ref);
      const experiment = await transaction.get(db.collection("experiments").doc(experimentID));
      const received = await transaction.get(ref.collection("event_receipts"));
      const trials = await transaction.get(ref.collection("trials"));
      if (!session.exists || !experiment.exists) throw exportError("Session not found", { status: 404 });
      const resolution = await resolveLifecycle(transaction, ref, session.data(), experiment.data());
      const data = resolution.data, receipts = received.docs.map(doc => doc.data());
      if (data.deleting || experiment.data().deleting) throw exportError('Session is being deleted', { status: 410 });
      if (data.sessionProtocolVersion === 3 && !data.completion) {
        const rejection = lifecycleRejection(data, req.body);
        if (rejection) { resolution.commit(); return rejection; }
      }
      resolution.commit();
      const target = summarizeEvents(receipts), byId = new Map(receipts.map(item => [item.eventId, item]));
      const pending = new Set(trials.docs.map(doc => doc.id));
      if (expectedLastSequence !== expectedEventCount - 1 || target.eventCount !== expectedEventCount || target.eventsHash !== eventsHash
          || target.events.some((item, index) => item.sequence !== index)) throw exportError("Received events do not match the expected complete set", { status: 409 });
      if (data.lifecycle === 'expired') throw exportError('The session has expired; use recovery', { status: 409 });
      if (trials.docs.some(doc => !byId.has(doc.id) || doc.data().event_id !== doc.id || doc.data().event_sequence !== byId.get(doc.id).sequence)
          || receipts.some(item => item.exported !== true && !pending.has(item.eventId))) {
        throw exportError("Some expected payloads are unavailable or contain unaccounted legacy rows", { status: 409 });
      }
      const expected = { expectedEventCount, expectedLastSequence, eventsHash };
      if (data.completion && Object.keys(expected).some(key => data.completion[key] !== expected[key])) {
        throw exportError("Session was closed with a different event set", { status: 409 });
      }
      if (data.completion?.revision) return;
      const revision = (data.exportRequestedRevision || 0) + 1;
      planSessionExport(transaction, ref, data, receipts, experiment.data(), { lifecycle: 'completed', presenceCheckPending: false, timeoutPending: false,
        closedAt: data.closedAt || new Date().toISOString(), closeReason: 'completed',
        completion: { ...expected, revision, confirmed: false, status: 'pending' } });
    });
    if (rejected) { res.status(409).json({ success: false, ...rejected }); return; }
    const result = await readSessionExportStatus(experimentID, sessionId);
    res.status(result.completion?.confirmed ? 200 : 202).json(result);
  } catch (error) {
    if (!error.status) console.error('Error closing public session:', error);
    res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Session closure could not be committed' });
  }
}
