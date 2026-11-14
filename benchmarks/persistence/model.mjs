import { isDeepStrictEqual } from 'node:util';
import { quantity } from '../core/quantity.mjs';
export { documentStorage } from './storage.mjs';

export function indexReadUnits({ query }) {
  if (!query || query.offset) throw new Error('Query offset billing not covered');
  const ranges = new Set(query.filters.filter(filter => filter.operator !== '==').map(filter => filter.field));
  if (query.filters.some(filter => filter.field === '__name__')) ranges.add('__name__');
  if (ranges.size) for (const field of query.orderBy) ranges.add(field);
  if (ranges.size > 1) throw new Error('Scanned index entries must be supplied for a multi-range query');
  return quantity(0, 'count', { provenance: 'derived', source: 'https://firebase.google.com/docs/firestore/pricing#reads_writes_and_deletes: at most one range field; no index-entry read charge' });
}
export function changedDocuments(cache, documents) {
  const final = new Map(documents.map(document => [document.path, document.data]));
  const changes = [];
  for (const [path, after] of final) {
    const before = cache.get(path) ?? null;
    if (!isDeepStrictEqual(before, after)) changes.push({ path, before, after });
    if (after === null) cache.delete(path); else cache.set(path, after);
  }
  return changes;
}

export function registration(name, cloudFunction) {
  const endpoint = cloudFunction.__endpoint;
  if (!endpoint || (typeof cloudFunction.run !== 'function' && !(endpoint.httpsTrigger && typeof cloudFunction === 'function'))) throw new Error('Missing registered handler: ' + name);
  const origin = endpoint.scheduleTrigger ? 'schedule' : endpoint.taskQueueTrigger ? 'task'
    : endpoint.eventTrigger?.eventType?.includes('firestore') ? 'firestore' : endpoint.eventTrigger ? 'database' : 'http';
  const schedule = endpoint.scheduleTrigger?.schedule;
  if (schedule && schedule !== 'every 1 minutes') throw new Error('Unsupported schedule: ' + schedule);
  const retry = origin === 'task' ? endpoint.taskQueueTrigger.retryConfig : endpoint.eventTrigger?.retry
    ? { maxAttempts: 8, minBackoffSeconds: 10, maxBackoffSeconds: 600, maxDoublings: 5 } : null;
  const option = (value, fallback) => value == null || value.toJSON?.() === null ? fallback : value;
  return { name, handler: cloudFunction.run || cloudFunction, origin, endpoint,
    memoryMiB: option(endpoint.availableMemoryMb, 256), cpu: option(endpoint.cpu, 1),
    location: endpoint.region?.[0] ?? 'us-central1', minInstances: option(endpoint.minInstances, 0),
    intervalMs: schedule ? 60000 : null, retry,
    resourceSource: 'Registered gcfv2 endpoint; missing options use documented 256MiB/1CPU/minInstances=0 defaults. Serial isolated-instance budget.',
    eventRetrySource: origin === 'firestore' ? 'Bounded benchmark fault workload: up to 8 deliveries, 10–600s exponential delay; registered retry flag retained, not a claim of platform delivery timing.' : null };
}
