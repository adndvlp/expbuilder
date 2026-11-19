import { db } from "../../../app.js";

export async function cleanupTemporarySession(sessionRef, trialsSnapshot) {
  // Each event also retains a receipt of the confirmed provider write.
  const hasEvents = trialsSnapshot.docs.some(doc => doc.data()?.event_id);
  const CHUNK_SIZE = hasEvents ? 250 : 500;

  for (let i = 0; i < trialsSnapshot.docs.length; i += CHUNK_SIZE) {
    const batch = db.batch();
    trialsSnapshot.docs
      .slice(i, i + CHUNK_SIZE)
      .forEach((doc) => {
        const eventId = doc.data()?.event_id;
        if (eventId) batch.set(sessionRef.collection("event_receipts").doc(eventId), { exported: true }, { merge: true });
        batch.delete(doc.ref);
      });
    await batch.commit();
  }

  await db.runTransaction(async transaction => {
    const current = await transaction.get(sessionRef);
    if (current?.data?.()?.eventProtocolVersion !== 1) transaction.delete(sessionRef);
  });
}
