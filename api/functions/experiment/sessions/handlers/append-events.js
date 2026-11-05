import { db } from "../../../app.js";
import { validatePublicEvents } from "../validation/event-contract.js";

export async function handleAppendEvents({ res, experimentID, sessionId, data, experiment, sanitize }) {
  try {
    const events = validatePublicEvents(data, experiment);
    const session = db.collection("experiments").doc(experimentID).collection("sessions").doc(sessionId);
    const outcome = await db.runTransaction(async transaction => {
      const sessionSnapshot = await transaction.get(session);
      const receipts = await Promise.all(events.map(event => transaction.get(session.collection("event_receipts").doc(event.eventId))));
      const previous = sessionSnapshot.exists ? sessionSnapshot.data() : {};
      const fresh = events.filter((_event, index) => !receipts[index].exists).sort((a, b) => a.sequence - b.sequence);
      if (fresh.length && previous.lifecycle === "completed") {
        throw Object.assign(new Error("Session is already closed"), { status: 409 });
      }
      const receivedCount = previous.receivedEventCount ?? previous.trialCount ?? 0;
      if (previous.sessionProtocolVersion === 2 && fresh.some((event, index) => event.sequence !== receivedCount + index)) {
        throw Object.assign(new Error("An earlier event is still missing"), { status: 409 });
      }
      let inserted = 0;
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
          receivedAt: new Date().toISOString(),
        });
        inserted++;
      }
      if (inserted) {
        const checkpointEvent = fresh.filter(event => event.checkpoint != null).at(-1);
        transaction.set(session, {
          ...(!sessionSnapshot.exists && { createdAt: new Date().toISOString(), experimentID, sessionId }),
          eventProtocolVersion: 1,
          trialCount: (previous.trialCount ?? 0) + inserted,
          receivedEventCount: receivedCount + inserted,
          ...(checkpointEvent && { resumeCheckpoint: sanitize(checkpointEvent.checkpoint), resumeCheckpointSequence: checkpointEvent.sequence }),
        }, { merge: true });
      }
      return inserted;
    });
    res.status(outcome ? 201 : 200).json({
      success: true, experimentID, sessionId,
      acknowledged: events.map(({ eventId, sequence, payloadHash }) => ({ eventId, sequence, payloadHash })),
    });
  } catch (error) {
    if (!error.status) console.error("Error receiving public events:", error);
    res.status(error.status ?? 503).json({ success: false, message: error.status ? error.message : "Event reception could not be committed" });
  }
}
