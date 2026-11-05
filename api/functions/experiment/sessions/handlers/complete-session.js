import { createHash } from "node:crypto";
import { db } from "../../../app.js";
import { canonicalEventJson } from "../validation/event-contract.js";
import { finalizeSession } from "../finalization/finalize.js";

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
export async function handleCompleteSession(req, res) {
  const { experimentID, sessionId, expectedEventCount, expectedLastSequence, eventsHash } = req.body;
  const expected = { expectedEventCount, expectedLastSequence, eventsHash };
  if (!experimentID || !sessionId || !Number.isSafeInteger(expectedEventCount) || expectedEventCount < 0
      || !Number.isSafeInteger(expectedLastSequence) || expectedLastSequence < -1 || !/^[a-f0-9]{64}$/.test(eventsHash ?? "")) {
    res.status(400).json({ success: false, message: "Invalid expected event set" }); return;
  }
  const session = db.collection("experiments").doc(experimentID).collection("sessions").doc(sessionId);
  let acquired = false;
  try {
    const decision = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(session);
      if (!snapshot.exists) fail("Session not found", 404);
      const data = snapshot.data();
      const received = await transaction.get(session.collection("event_receipts"));
      const events = received.docs.map(doc => {
        const { eventId, sequence, payloadHash } = doc.data();
        return { eventId, sequence, payloadHash };
      }).sort((a, b) => a.sequence - b.sequence);
      const actualHash = createHash("sha256").update(canonicalEventJson(events)).digest("hex");
      if (expectedLastSequence !== expectedEventCount - 1 || events.length !== expectedEventCount || events.some((event, index) => event.sequence !== index)
          || actualHash !== eventsHash) fail("Received events do not match the expected complete set");
      const trials = await transaction.get(session.collection("trials"));
      const pending = new Map(trials.docs.map(doc => [doc.id, doc.data()]));
      const byId = new Map(received.docs.map(doc => [doc.id, doc.data()]));
      if (trials.docs.some(doc => !byId.has(doc.id) || doc.data().event_id !== doc.id
          || doc.data().event_sequence !== byId.get(doc.id).sequence || byId.get(doc.id).exported === true)
          || received.docs.some(doc => doc.data().exported !== true && !pending.has(doc.id))) {
        fail("Some expected payloads are unavailable or contain unaccounted legacy rows");
      }
      const exportedCount = received.docs.filter(doc => doc.data().exported === true).length;
      if (exportedCount && exportedCount < events.length) {
        fail("A previous partial export requires revision reconciliation before verified completion");
      }
      const previous = data.completion;
      if (previous && (previous.eventsHash !== eventsHash || previous.expectedEventCount !== expectedEventCount
          || previous.expectedLastSequence !== expectedLastSequence)) fail("Session was closed with a different event set");
      if (previous?.confirmed) return { completion: previous, acquired: false };
      if (previous?.status === "running") return { completion: previous, acquired: false };
      const completion = { ...expected, confirmed: false, status: "running" };
      transaction.set(session, { lifecycle: "completed", closedAt: data.closedAt ?? new Date().toISOString(), completion }, { merge: true });
      return { completion, acquired: true, exportNeeded: trials.docs.length > 0 };
    });
    acquired = decision.acquired;
    if (!acquired) {
      res.status(decision.completion.confirmed ? 200 : 202).json({ success: true, experimentID, sessionId, completion: decision.completion });
      return;
    }
    if (expectedEventCount > 0 && decision.exportNeeded) await finalizeSession(experimentID, sessionId);
    const completion = { ...expected, confirmed: true, status: expectedEventCount ? "confirmed" : "empty", resultsSent: expectedEventCount };
    await session.set({ completion }, { merge: true });
    res.status(200).json({ success: true, experimentID, sessionId, completion });
  } catch (error) {
    if (acquired) {
      await session.set({ completion: { ...expected, confirmed: false, status: "pending", lastError: error.message } }, { merge: true });
    }
    if (!error.status) console.error("Error completing session:", error);
    res.status(error.status ?? 503).json({ success: false, message: error.status ? error.message : "Session storage was not confirmed" });
  }
}
