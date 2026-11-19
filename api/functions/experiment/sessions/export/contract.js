import { createHash } from 'node:crypto';
import { canonicalEventJson } from '../validation/event-contract.js';

export const EXPORT_LEASE_MS = 360_000;
export const EXPORT_MAX_ATTEMPTS = 8;
export const exportHash = value => createHash('sha256').update(value).digest('hex');
export function exportError(message, options = {}) { return Object.assign(new Error(message), options); }
export function validateExportIdentity({ experimentID, sessionId, revision } = {}, requireRevision = false) {
  if (![experimentID, sessionId].every(value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !value.includes('/'))
      || (requireRevision && (!Number.isSafeInteger(revision) || revision < 1))) {
    throw exportError('Invalid session export identity', { status: 400 });
  }
  return { experimentID, sessionId, ...(revision !== undefined && { revision }) };
}
export function summarizeEvents(receipts) {
  const events = receipts.map(({ eventId, sequence, payloadHash }) => ({ eventId, sequence, payloadHash }))
    .sort((a, b) => a.sequence - b.sequence || a.eventId.localeCompare(b.eventId));
  if (new Set(events.map(event => event.eventId)).size !== events.length || new Set(events.map(event => event.sequence)).size !== events.length) {
    throw exportError('Conflicting event identities or sequences', { status: 409, attention: true });
  }
  return { events, eventCount: events.length, eventsHash: exportHash(canonicalEventJson(events)) };
}
