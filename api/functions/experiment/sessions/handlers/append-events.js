import { db } from "../../../app.js";
import { validatePublicEvents } from "../validation/event-contract.js";
import { planSessionExport } from "../export/request.js";

import { resolveLifecycle, lifecycleRejection } from "../lifecycle/state.js";

export async function handleAppendEvents({ res, experimentID, sessionId, data, experiment, sanitize, recovering = false, body = {} }) {
  try {
    let events;
    const session = db.collection("experiments").doc(experimentID).collection("sessions").doc(sessionId);
    const outcome = await db.runTransaction(async transaction => {
      const sessionSnapshot = await transaction.get(session);
      const resolution = await resolveLifecycle(transaction, session, sessionSnapshot.exists ? sessionSnapshot.data() : {}, experiment);
      const previous = resolution.data;
      events = validatePublicEvents(data, previous.configuration?.validation || experiment);
      const receipts = await Promise.all(events.map(event => transaction.get(session.collection("event_receipts").doc(event.eventId))));
      if (previous.deleting || experiment.deleting) throw Object.assign(new Error('Session is being deleted'), { status: 410 });
      const allReceipts = recovering ? await transaction.get(session.collection('event_receipts')) : null;
      if (receipts.every((receipt, index) => receipt.exists && receipt.data().sequence === events[index].sequence && receipt.data().payloadHash === events[index].payloadHash)) {
        resolution.commit(); return 0;
      }
      if (!recovering && previous.sessionProtocolVersion === 3) {
        const rejection = lifecycleRejection(previous, body);
        if (rejection) { resolution.commit(); return rejection; }
      }
      const fresh = events.filter((_event, index) => !receipts[index].exists).sort((a, b) => a.sequence - b.sequence);
      if (recovering && (!sessionSnapshot.exists || !['expired', 'completed'].includes(previous.lifecycle))) {
        throw Object.assign(new Error('Recovery requires an existing closed session'), { status: 409 });
      }
      if (recovering && fresh.some(event => allReceipts.docs.some(doc => doc.data().sequence === event.sequence && doc.id !== event.eventId))) {
        throw Object.assign(new Error('An event sequence is already occupied'), { status: 409 });
      }
      if (!recovering && fresh.length && ['completed', 'expired'].includes(previous.lifecycle)) {
        throw Object.assign(new Error("Session is already closed"), { status: 409 });
      }
      const receivedCount = previous.receivedEventCount ?? previous.trialCount ?? 0;
      if (!recovering && previous.sessionProtocolVersion >= 2 && fresh.some((event, index) => event.sequence !== receivedCount + index)) {
        throw Object.assign(new Error("An earlier event is still missing"), { status: 409 });
      }
      if (!recovering || !fresh.length) resolution.commit();
      let inserted = 0;
      const receiptRevision = (previous.receiptRevision || 0) + 1;
      for (const [index, event] of events.entries()) {
        const existing = receipts[index];
        if (existing.exists && (existing.data().payloadHash !== event.payloadHash || existing.data().sequence !== event.sequence)) {
          throw Object.assign(new Error("Event identity already has different content or sequence"), { status: 409 });
        }
      }
      for (const [index, event] of events.entries()) {
        if (receipts[index].exists) continue;
        transaction.set(session.collection("trials").doc(event.eventId), {
          ...sanitize(event.payload), event_id: event.eventId, event_sequence: event.sequence,
        });
        transaction.set(session.collection("event_receipts").doc(event.eventId), {
          eventId: event.eventId, sequence: event.sequence, payloadHash: event.payloadHash,
          receiptRevision,
          receivedAt: new Date().toISOString(),
        });
        inserted++;
      }
      if (inserted) {
        const checkpointEvent = fresh.filter(event => event.checkpoint != null).at(-1);
        const update = {
          ...(recovering && resolution.patch),
          ...(!sessionSnapshot.exists && { createdAt: new Date().toISOString(), experimentID, sessionId }),
          eventProtocolVersion: 1,
          trialCount: (previous.trialCount ?? 0) + inserted,
          receivedEventCount: receivedCount + inserted,
          receiptRevision,
          ...(!recovering && checkpointEvent && { resumeCheckpoint: sanitize(checkpointEvent.checkpoint), resumeCheckpointSequence: checkpointEvent.sequence }),
        };
        if (recovering) {
          const combined = [...allReceipts.docs.map(doc => doc.data()), ...fresh.map(({ eventId, sequence, payloadHash }) => ({ eventId, sequence, payloadHash, receiptRevision }))];
          planSessionExport(transaction, session, previous, combined, experiment, update);
        } else transaction.set(session, update, { merge: true });
      }
      return inserted;
    });
    if (typeof outcome === 'object') { res.status(409).json({ success: false, ...outcome }); return; }
    res.status(outcome ? 201 : 200).json({
      success: true, experimentID, sessionId,
      acknowledged: events.map(({ eventId, sequence, payloadHash }) => ({ eventId, sequence, payloadHash })),
    });
  } catch (error) {
    if (!error.status) console.error("Error receiving public events:", error);
    res.status(error.status ?? 503).json({ success: false, message: error.status ? error.message : "Event reception could not be committed" });
  }
}
