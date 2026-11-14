import { sessionReference } from './references.js';
import { EXPORT_MAX_ATTEMPTS, exportError, exportHash, validateExportIdentity } from './contract.js';
import { acquireExportLease, fencedExportUpdate } from './lease.js';
import { buildExportCsv, loadExportChunks, saveExportChunks } from './snapshot.js';
import { cleanupExport, confirmExport } from './confirmation.js';

export async function processSessionExport(payload, options = {}) {
  const { experimentID, sessionId, revision } = validateExportIdentity(payload, true);
  const now = options.now || Date.now;
  const ref = sessionReference(experimentID, sessionId), jobRef = ref.collection('export_jobs').doc(String(revision));
  const lease = await acquireExportLease(ref, jobRef, revision, now());
  if (lease.missing || lease.attention) return { status: lease.missing ? 'missing' : 'needs_attention' };
  let job = lease.job;
  if (lease.confirmed) {
    if (job.cleanupPending) await cleanupExport(ref, jobRef, job);
    return { status: job.status, receipt: job.receipt };
  }
  const fence = lease.fence;
  try {
    const adapter = options.adapter || await (await import('./providers/index.js')).createExportAdapter(job.destination);
    let resource = job.observedResource || lease.session.exportResource;
    if (!resource) {
      resource = await adapter.reserve(job.destination);
      await fencedExportUpdate(ref, jobRef, fence, {}, { exportResource: resource });
    }
    const remote = await adapter.read(resource);
    resource = remote.resource || resource;
    let csv;
    if (job.intent) {
      csv = await loadExportChunks(jobRef, job.intent);
      if (job.phase === 'writing') {
        if (remote.exists && exportHash(remote.csv) === job.intent.csvHash) {
          await confirmExport(ref, jobRef, job, fence, resource, now());
          await cleanupExport(ref, jobRef, job);
          return { status: 'confirmed', reconciled: true };
        }
        const unchanged = remote.exists === job.intent.base.exists
          && (!remote.exists || exportHash(remote.csv) === job.intent.base.csvHash);
        const repeatable = adapter.canRetryWrite ? adapter.canRetryWrite(job.intent.base) : adapter.conditional;
        if (!unchanged || !repeatable || (remote.exists && !job.intent.base.version)) {
          throw exportError('An uncertain write cannot safely be repeated; reconciliation required', { attention: true });
        }
      }
    } else {
      const previous = lease.session.exportReceipt;
      if (previous?.eventCount) {
        if (!remote.exists || exportHash(remote.csv) !== previous.csvHash) throw exportError('Confirmed resource is missing or changed', { attention: true });
      } else if (remote.exists) throw exportError('Existing resource has no verified export receipt', { attention: true });
      csv = buildExportCsv(job, lease.snapshot, remote.exists ? remote.csv : '');
      const chunks = await saveExportChunks(jobRef, csv);
      const intent = { ...chunks, base: { exists: remote.exists, version: remote.version || null,
        csvHash: remote.exists ? exportHash(remote.csv) : null, resource } };
      job = { ...job, intent, phase: 'prepared' };
      await fencedExportUpdate(ref, jobRef, fence, { intent, phase: 'prepared' });
    }
    // This durable intent precedes the only external mutation of the attempt.
    await fencedExportUpdate(ref, jobRef, fence, { phase: 'writing', status: 'running' });
    job.phase = 'writing';
    resource = await adapter.write(resource, csv, job.intent.base);
    await fencedExportUpdate(ref, jobRef, fence, { observedResource: resource });
    const verified = await adapter.read(resource);
    if (!verified.exists || exportHash(verified.csv) !== job.intent.csvHash) throw exportError('Provider bytes do not confirm the export snapshot', { attention: true });
    resource = verified.resource || resource;
    await confirmExport(ref, jobRef, job, fence, resource, now());
    await cleanupExport(ref, jobRef, job);
    return { status: 'confirmed' };
  } catch (error) {
    if (error.code === 'EXPORT_STALE_WORKER') return { status: 'superseded' };
    const current = await jobRef.get();
    if (current.data()?.fence !== fence) return { status: 'superseded' };
    if (current.data()?.status === 'confirmed') throw error; // Only cleanup remains.
    const uncertain = job.phase === 'writing' && (!error.noEffect || [409, 412].includes(error.status));
    const attention = error.attention || job.attempts >= EXPORT_MAX_ATTEMPTS || [401, 403].includes(error.status);
    const status = attention ? 'needs_attention' : uncertain ? 'reconciling' : 'retry_wait';
    try {
      await fencedExportUpdate(ref, jobRef, fence, { status, phase: uncertain ? 'writing' : job.intent ? 'prepared' : 'preparing',
        lastError: error.message, dispatchDue: !attention, nextDispatchAt: now() + Math.min(900_000, 30_000 * 2 ** (job.attempts - 1)) },
      { exportLeaseUntil: 0, exportStatus: status });
    } catch (updateError) { if (updateError.code !== 'EXPORT_STALE_WORKER') throw updateError; }
    if (attention) return { status: 'needs_attention' };
    throw error;
  }
}
