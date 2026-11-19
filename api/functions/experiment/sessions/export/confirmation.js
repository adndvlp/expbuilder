import { db } from '../../../app.js';
import { staleWorker } from './lease.js';
import { targetReceipts } from './snapshot.js';

export async function confirmExport(ref, jobRef, job, fence, resource, now) {
  await db.runTransaction(async transaction => {
    const session = await transaction.get(ref), current = await transaction.get(jobRef);
    if (!session.exists || !current.exists || session.data().exportFence !== fence || current.data().fence !== fence
        || !['running', 'reconciling'].includes(current.data().status)) throw staleWorker();
    const data = session.data();
    const receipt = { revision: job.revision, eventCount: job.eventCount, eventsHash: job.eventsHash,
      csvHash: job.intent.csvHash, resource, confirmedAt: now };
    const update = { exportReceipt: receipt, exportResource: resource, exportConfirmedRevision: job.revision,
      exportLeaseUntil: 0, exportStatus: data.exportRequestedRevision === job.revision ? 'confirmed' : 'pending' };
    if (data.completion && data.completion.revision <= job.revision) {
      update.completion = { ...data.completion, confirmed: true, status: 'confirmed', resultsSent: data.completion.expectedEventCount };
    }
    transaction.set(ref, update, { merge: true });
    transaction.set(jobRef, { status: 'confirmed', receipt, cleanupPending: true, dispatchDue: true, confirmedAt: now, nextDispatchAt: 0 }, { merge: true });
    transaction.set(db.collection('experiments').doc(job.experimentID).collection('session_metadata').doc(job.sessionId), {
      sessionId: job.sessionId, state: data.lifecycle || job.state, createdAt: job.session.createdAt,
      participantNumber: job.session.participantNumber, condition: job.session.condition, sessionName: job.session.sessionName,
      metadata: job.session.metadata, storageProvider: job.destination.provider, exportStatus: update.exportStatus,
      exportedCount: job.eventCount, exportRevision: job.revision, completedAt: new Date(now).toISOString(),
      ...(resource.fileUrl && { fileUrl: resource.fileUrl }),
    }, { merge: true });
  });
}

export async function cleanupExport(ref, jobRef, job) {
  const receipts = await targetReceipts(ref, job);
  for (let offset = 0; offset < receipts.length; offset += 200) {
    const page = receipts.slice(offset, offset + 200);
    // Transactional maxima prevent an older cleanup downgrading a later receipt.
    await db.runTransaction(async transaction => {
      const current = await Promise.all(page.map(item => transaction.get(ref.collection('event_receipts').doc(item.eventId))));
      page.forEach((item, i) => {
        if ((current[i].data()?.exportRevision || 0) < job.revision) {
          transaction.set(ref.collection('event_receipts').doc(item.eventId), { exported: true, exportRevision: job.revision }, { merge: true });
        }
        transaction.delete(ref.collection('trials').doc(item.eventId));
      });
    });
  }
  const chunks = await jobRef.collection('chunks').get();
  for (let offset = 0; offset < chunks.docs.length; offset += 400) {
    const batch = db.batch(); chunks.docs.slice(offset, offset + 400).forEach(doc => batch.delete(doc.ref)); await batch.commit();
  }
  await jobRef.set({ cleanupPending: false, dispatchDue: false }, { merge: true });
}
