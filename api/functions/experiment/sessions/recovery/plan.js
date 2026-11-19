import { canonicalEventJson } from '../validation/event-contract.js';
import { deserializeFromFirestore } from '../validation/serialize.js';
import { exportHash, validateExportIdentity } from '../export/contract.js';

export const recoveryHash = value => exportHash(canonicalEventJson(JSON.parse(JSON.stringify(value))));
export function recoveryDestination(experimentID, sessionId, experiment, session, override) {
  const provider = experiment.storageProvider || 'googledrive';
  const folder = provider === 'googledrive' ? experiment.driveFolderId : provider === 'dropbox' ? experiment.dropboxFolder
    : experiment.osfUploadLink || (experiment.osfComponentId ? `https://files.osf.io/v1/resources/${experiment.osfComponentId}/providers/osfstorage/` : null);
  return { provider, owner: experiment.owner, folder, ...session.exportDestination, ...override, name: `${experimentID}_${sessionId}.csv` };
}
export function buildHistoricalPlan(input) {
  validateExportIdentity(input);
  const { projectId, experimentID, sessionId, experiment, session = {}, metadata = {}, remote = { exists: false } } = input;
  if (!projectId) throw new Error('An explicit Firebase project is required');
  const originalIdentity = { participantNumber: session.participantNumber ?? metadata.participantNumber, condition: session.condition ?? metadata.condition,
    createdAt: session.createdAt ?? metadata.createdAt, sessionName: session.sessionName || metadata.sessionName || '', metadata: session.metadata || metadata.metadata || {} };
  const identity = { ...originalIdentity, ...Object.fromEntries(Object.entries(input.identity || {}).filter(([key]) => originalIdentity[key] == null)) };
  const destination = recoveryDestination(experimentID, sessionId, experiment, session, input.destination);
  const sources = input.sources.slice().sort((a, b) => a.id.localeCompare(b.id)).map(source => ({ ...source, hash: recoveryHash(source.data) }));
  const body = { schema: 1, projectId, experimentID, sessionId, identity, destination, sources, remote, events: [],
    sourceStateHash: recoveryHash({ session, metadata, owner: experiment.owner }), status: 'ready', reason: null };
  const blocked = reason => { body.status = 'blocked'; body.reason = reason; return seal(body); };
  if (Object.entries(input.identity || {}).some(([key, value]) => originalIdentity[key] != null && originalIdentity[key] !== value)) return blocked('identity_conflict');
  if (!sources.length && (session.trialCount || metadata.trialCount)) return blocked('missing_payloads');
  if (session.sessionProtocolVersion >= 2 || session.eventProtocolVersion === 1 || session.exportProtocolVersion === 1 || input.hasReceipts) return blocked('already_versioned');
  if (experiment.deleting || session.deleting) return blocked('being_deleted');
  if (!Number.isSafeInteger(identity.participantNumber) || !Number.isSafeInteger(identity.condition) || !identity.createdAt) return blocked('missing_identity');
  if (!['googledrive', 'dropbox', 'osf'].includes(destination.provider) || !destination.owner || !destination.folder) return blocked('missing_destination');
  if (remote.exists) return blocked('unverified_existing_file');
  try {
    const rows = sources.flatMap(source => {
      const data = deserializeFromFirestore(source.data);
      const batch = Object.hasOwn(data, 'trialsData');
      const payloads = batch ? JSON.parse(data.trialsData) : [data];
      if (!Array.isArray(payloads) || (batch && !payloads.length)) throw new Error('Invalid batch');
      return payloads.map((payload, index) => {
        if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('Invalid source row');
        const eventId = 'legacy_' + recoveryHash({ projectId, experimentID, sessionId, source: source.id, index });
        return { eventId, payload, payloadHash: recoveryHash(payload), sourceId: source.id, sourceIndex: index };
      });
    });
    rows.sort((a, b) => {
      const compare = key => Number.isFinite(Number(a.payload[key])) && Number.isFinite(Number(b.payload[key])) ? Number(a.payload[key]) - Number(b.payload[key]) : 0;
      return compare('clientTimestamp') || compare('trial_index') || a.sourceId.localeCompare(b.sourceId) || a.sourceIndex - b.sourceIndex;
    });
    body.events = rows.map((row, sequence) => ({ ...row, sequence }));
  } catch { return blocked('invalid_source'); }
  return seal(body);
}
function seal(body) { return { ...body, planId: recoveryHash(body) }; }
export function verifyHistoricalPlan(plan) {
  const { planId, ...body } = plan;
  if (body.schema !== 1 || recoveryHash(body) !== planId || body.status !== 'ready') throw new Error('The recovery plan is blocked, edited or invalid');
  validateExportIdentity(body);
  if (body.events.some((event, index) => event.sequence !== index || event.payloadHash !== recoveryHash(event.payload))) throw new Error('Invalid planned events');
  return true;
}
