import { db } from '../../../app.js';
import { buildHistoricalPlan } from './plan.js';
import { exportHash, validateExportIdentity } from '../export/contract.js';

export async function inspectHistoricalSession(input, inspectRemote) {
  validateExportIdentity(input);
  const experimentRef = db.collection('experiments').doc(input.experimentID), ref = experimentRef.collection('sessions').doc(input.sessionId);
  const [experiment, session, metadata, trials, receipts] = await Promise.all([experimentRef.get(), ref.get(),
    experimentRef.collection('session_metadata').doc(input.sessionId).get(), ref.collection('trials').get(), ref.collection('event_receipts').limit(1).get()]);
  if (!experiment.exists) throw new Error('Experiment not found');
  const data = { ...input, experiment: experiment.data(), session: session.data() || {}, metadata: metadata.data() || {},
    hasReceipts: !receipts.empty, sources: trials.docs.map(doc => ({ id: doc.id, data: doc.data() })), remote: { exists: false } };
  const preflight = buildHistoricalPlan(data);
  if (preflight.status !== 'ready') return preflight;
  const remote = await inspectRemote(preflight.destination);
  return buildHistoricalPlan({ ...data, remote });
}
export function recoveryRemoteSnapshot(remote) {
  return remote.exists ? { exists: true, csvHash: exportHash(remote.csv), resource: remote.resource } : { exists: false };
}
