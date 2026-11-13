import { isDeepStrictEqual } from 'node:util';
import { Buffer } from 'node:buffer';
import { quantity } from '../core/quantity.mjs';

const utf8 = value => Buffer.byteLength(value, 'utf8') + 1;
const nameBytes = path => path ? path.split('/').reduce((sum, part) => sum + utf8(part), 16) : 0;
function fieldsBytes(value) { return Object.entries(value).reduce((sum, [key, item]) => sum + utf8(key) + valueBytes(item), 0); }
function valueBytes(value) {
  if (value === null || typeof value === 'boolean') return 1;
  if (typeof value === 'number' || value instanceof Date || typeof value?.toMillis === 'function') return 8;
  if (typeof value === 'string') return utf8(value);
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value.byteLength;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + valueBytes(item), 0);
  if (value && Object.getPrototypeOf(value) === Object.prototype) return 32 + fieldsBytes(value);
  throw new Error('Unsupported Firestore storage value; do not substitute JSON bytes');
}
function leaves(data, prefix = '') {
  return Object.entries(data).flatMap(([key, value]) => {
    const field = prefix + key;
    return value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length
      ? leaves(value, field + '.') : [{ field, value }];
  });
}
export function documentStorage(path, data, config = { indexes: [], fieldOverrides: [] }) {
  if (!data || !path || path.split('/').length % 2) throw new Error('Document path/data required');
  if (config.fieldOverrides?.length) throw new Error('Storage model does not support field overrides yet');
  const documentName = nameBytes(path), parentName = nameBytes(path.split('/').slice(0, -2).join('/'));
  const flat = leaves(data); let indexBytes = 0, indexEntries = 0, compositeBytes = 0;
  for (const { field, value } of flat) {
    const values = Array.isArray(value) ? [...new Map(value.map(item => [JSON.stringify(item), item])).values()] : [value, value];
    for (const item of values) {
      indexEntries++;
      indexBytes += documentName + parentName + utf8(field) + Math.min(1500, valueBytes(item)) + 32;
    }
  }
  for (const index of config.indexes || []) {
    if (path.split('/').at(-2) !== index.collectionGroup) continue;
    const values = index.fields.map(entry => flat.find(item => item.field === entry.fieldPath)?.value);
    if (values.some(value => value === undefined)) continue;
    if (index.fields.some(entry => entry.arrayConfig)) throw new Error('Composite array index model not supported');
    const bytes = documentName + (index.queryScope === 'COLLECTION' ? parentName : 0) + 32
      + values.reduce((sum, value) => sum + Math.min(1500, valueBytes(value)), 0);
    indexEntries++; indexBytes += bytes; compositeBytes += bytes;
  }
  const documentBytes = documentName + fieldsBytes(data) + 32;
  return { documentBytes, indexBytes, indexEntries, compositeBytes, storedBytes: documentBytes + indexBytes };
}

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
