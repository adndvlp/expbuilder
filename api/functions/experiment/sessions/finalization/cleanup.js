import { db } from "../../../app.js";

export async function cleanupTemporarySession(sessionRef, trialsSnapshot) {
  const CHUNK_SIZE = 500;

  for (let i = 0; i < trialsSnapshot.docs.length; i += CHUNK_SIZE) {
    const batch = db.batch();
    trialsSnapshot.docs
      .slice(i, i + CHUNK_SIZE)
      .forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  await db.runTransaction(async transaction => {
    const current = await transaction.get(sessionRef);
    if (current?.data?.()?.eventProtocolVersion !== 1) transaction.delete(sessionRef);
  });
}
