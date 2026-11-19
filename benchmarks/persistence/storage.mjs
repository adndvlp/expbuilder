import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { URL } from 'node:url';

// Use the same native value classes as the measured backend. Duck typing a
// toMillis() method would silently count an unsupported object as a timestamp.
const require = createRequire(new URL('../../api/functions/package.json', import.meta.url));
const { Timestamp, GeoPoint, DocumentReference } = require('@google-cloud/firestore');
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const utf8 = value => Buffer.byteLength(value, 'utf8') + 1;
const nameBytes = path => path ? path.split('/').reduce((sum, part) => sum + utf8(part), 16) : 0;
const coverage = reason => { throw new Error('Firestore storage coverage: ' + reason); };
const simple = /^[A-Za-z_][A-Za-z_0-9]*$/;
const fieldPath = parts => parts.map(part => simple.test(part) ? part : '`' + part.replaceAll('\\', '\\\\').replaceAll('`', '\\`') + '`').join('.');

function parseFieldPath(path) {
  if (typeof path !== 'string' || !path) coverage('nonempty field path required');
  const parts = []; let offset = 0;
  while (offset < path.length) {
    let part = '';
    if (path[offset] === '`') {
      offset++; let closed = false;
      while (offset < path.length) {
        const char = path[offset++];
        if (char === '`') { closed = true; break; }
        if (char === '\\') {
          const escaped = path[offset++];
          if (escaped !== '`' && escaped !== '\\') coverage('unsupported field path escape: ' + path);
          part += escaped;
        } else part += char;
      }
      if (!closed || !part) coverage('invalid quoted field path: ' + path);
    } else {
      const start = offset;
      while (offset < path.length && path[offset] !== '.') offset++;
      part = path.slice(start, offset);
      if (!simple.test(part)) coverage('invalid field path: ' + path);
    }
    if (part === '__name__') coverage('explicit document-name index configuration is not supported');
    parts.push(part);
    if (offset === path.length) break;
    if (path[offset++] !== '.' || offset === path.length) coverage('invalid field path: ' + path);
  }
  return parts;
}
function keys(value, allowed, label) {
  if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key))) coverage('unsupported ' + label);
}
function collection(value) {
  if (typeof value !== 'string' || !value || /[/*]/.test(value)) coverage('invalid collection group');
}
function scope(value) {
  if (!['COLLECTION', 'COLLECTION_GROUP'].includes(value)) coverage('unsupported query scope');
}
function mode(value, allowed, label) {
  keys(value, allowed, label);
  if ((Object.hasOwn(value, 'order') ? 1 : 0) + (Object.hasOwn(value, 'arrayConfig') ? 1 : 0) !== 1
    || (Object.hasOwn(value, 'order') && !['ASCENDING', 'DESCENDING'].includes(value.order))
    || (Object.hasOwn(value, 'arrayConfig') && value.arrayConfig !== 'CONTAINS')) coverage('unsupported index mode');
  return value.order || value.arrayConfig;
}

export function validateIndexConfiguration(config) {
  keys(config, ['indexes', 'fieldOverrides'], 'index configuration');
  for (const key of ['indexes', 'fieldOverrides']) {
    if (Object.hasOwn(config, key) && !Array.isArray(config[key])) coverage(key + ' must be an array');
  }
  const identities = new Set();
  const indexes = (config.indexes || []).map(index => {
    keys(index, ['collectionGroup', 'queryScope', 'fields', 'apiScope', 'density'], 'manual index configuration');
    collection(index.collectionGroup); scope(index.queryScope);
    if ((Object.hasOwn(index, 'apiScope') && index.apiScope !== 'ANY_API')
      || (Object.hasOwn(index, 'density') && index.density !== 'SPARSE_ALL')) coverage('unsupported index API/density');
    if (!Array.isArray(index.fields) || index.fields.length < 2 || index.fields.length > 100) coverage('manual index requires 2–100 fields');
    const fields = index.fields.map(field => {
      const fieldMode = mode(field, ['fieldPath', 'order', 'arrayConfig'], 'manual index field');
      return { path: fieldPath(parseFieldPath(field.fieldPath)), mode: fieldMode };
    });
    if (new Set(fields.map(field => field.path)).size !== fields.length || fields.filter(field => field.mode === 'CONTAINS').length > 1) coverage('duplicate field or multiple arrays in manual index');
    const normalized = { collectionGroup: index.collectionGroup, queryScope: index.queryScope, fields };
    const identity = JSON.stringify(normalized);
    if (identities.has(identity)) coverage('duplicate manual index');
    identities.add(identity); return normalized;
  });
  const overrides = new Map();
  for (const override of config.fieldOverrides || []) {
    keys(override, ['collectionGroup', 'fieldPath', 'indexes'], 'field override (TTL is outside this model)');
    collection(override.collectionGroup);
    const parts = override.fieldPath === '*' ? [] : parseFieldPath(override.fieldPath);
    if (!Array.isArray(override.indexes)) coverage('field override indexes must be an array');
    const seen = new Set();
    const modes = override.indexes.map(index => {
      const indexMode = mode(index, ['queryScope', 'order', 'arrayConfig'], 'single-field index');
      const setting = { queryScope: index.queryScope, mode: indexMode };
      scope(setting.queryScope);
      const identity = JSON.stringify(setting);
      if (seen.has(identity)) coverage('duplicate single-field index');
      seen.add(identity); return setting;
    });
    const identity = JSON.stringify([override.collectionGroup, parts]);
    if (overrides.has(identity)) coverage('duplicate field override');
    overrides.set(identity, modes);
  }
  return { indexes, overrides };
}

function fieldsBytes(data, ancestors) {
  return Object.entries(data).reduce((sum, [key, value]) => sum + utf8(key) + valueBytes(value, ancestors), 0);
}
function valueBytes(value, ancestors = new Set()) {
  if (value === null || typeof value === 'boolean') return 1;
  if (typeof value === 'number' || value instanceof Timestamp) return 8;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) coverage('invalid date');
    return 8;
  }
  if (typeof value === 'string') return utf8(value);
  if (value instanceof Uint8Array) return value.byteLength;
  if (value instanceof GeoPoint) return 16;
  if (value instanceof DocumentReference) return nameBytes(value.path);
  if (!plain(value) && !Array.isArray(value)) coverage('unsupported Firestore value; do not substitute JSON bytes');
  if (ancestors.has(value)) coverage('cyclic value');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      let bytes = 0;
      for (const item of value) {
        if (Array.isArray(item)) coverage('directly nested arrays are not Firestore values');
        bytes += valueBytes(item, ancestors);
      }
      return bytes;
    }
    if (Object.getOwnPropertySymbols(value).length) coverage('symbol field name');
    return 32 + fieldsBytes(value, ancestors);
  } finally { ancestors.delete(value); }
}

const time = value => value instanceof Date ? Timestamp.fromDate(value) : value;
function equalValue(left, right) {
  if (left === right || (typeof left === 'number' && typeof right === 'number' && Number.isNaN(left) && Number.isNaN(right))) return true;
  if ((left instanceof Date || left instanceof Timestamp) && (right instanceof Date || right instanceof Timestamp)) return time(left).isEqual(time(right));
  if (left instanceof Uint8Array && right instanceof Uint8Array) return Buffer.from(left).equals(Buffer.from(right));
  if (left instanceof GeoPoint && right instanceof GeoPoint) return left.isEqual(right);
  if (left instanceof DocumentReference && right instanceof DocumentReference) return left.isEqual(right);
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equalValue(item, right[index]));
  if (!plain(left) || !plain(right)) return false;
  return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.hasOwn(right, key) && equalValue(left[key], right[key]));
}
const distinct = values => values.filter((value, index) => values.findIndex(other => equalValue(value, other)) === index);
function walk(data, prefix = []) {
  return Object.entries(data).flatMap(([key, value]) => {
    const parts = [...prefix, key];
    return [{ parts, path: fieldPath(parts), value }, ...(plain(value) ? walk(value, parts) : [])];
  });
}
const defaults = [{ queryScope: 'COLLECTION', mode: 'ASCENDING' }, { queryScope: 'COLLECTION', mode: 'DESCENDING' }, { queryScope: 'COLLECTION', mode: 'CONTAINS' }];
function automaticModes(overrides, group, parts) {
  for (let length = parts.length; length >= 0; length--) {
    const modes = overrides.get(JSON.stringify([group, parts.slice(0, length)]));
    if (modes) return modes;
  }
  return defaults;
}

// Standard edition, native values, explicit single-field configuration and
// sparse manual ordered/array indexes. Formulas and entry enumeration:
// https://firebase.google.com/docs/firestore/storage-size
// https://firebase.google.com/docs/firestore/query-data/index-overview
// https://firebase.google.com/docs/reference/firestore/indexes
export function documentStorage(path, data, config = { indexes: [], fieldOverrides: [] }) {
  if (typeof path !== 'string' || !path || path.split('/').length % 2 || path.split('/').some(part => !part) || !plain(data)) coverage('Document path/data required');
  const { indexes, overrides } = validateIndexConfiguration(config);
  // Validate all values first, even when exempt or missing from a manual index.
  const documentName = nameBytes(path), parentName = nameBytes(path.split('/').slice(0, -2).join('/'));
  const documentBytes = documentName + valueBytes(data); // map overhead = document overhead (32 B).
  const fields = walk(data), byPath = new Map(fields.map(field => [field.path, field.value]));
  const group = path.split('/').at(-2);
  let automaticIndexBytes = 0, automaticIndexEntries = 0, compositeBytes = 0, compositeIndexEntries = 0;
  for (const field of fields) {
    for (const setting of automaticModes(overrides, group, field.parts)) {
      const values = setting.mode === 'CONTAINS' ? (Array.isArray(field.value) ? distinct(field.value) : []) : [field.value];
      for (const value of values) {
        automaticIndexBytes += documentName + (setting.queryScope === 'COLLECTION' ? parentName + 32 : 48)
          + utf8(field.path) + Math.min(1500, valueBytes(value));
        automaticIndexEntries++;
      }
    }
  }
  for (const index of indexes) {
    if (index.collectionGroup !== group || index.fields.some(field => !byPath.has(field.path))) continue;
    let orderedBytes = 0, members = [0];
    for (const field of index.fields) {
      const value = byPath.get(field.path);
      if (field.mode === 'CONTAINS') members = Array.isArray(value) ? distinct(value).map(item => Math.min(1500, valueBytes(item))) : [];
      else orderedBytes += Math.min(1500, valueBytes(value));
    }
    for (const member of members) {
      compositeBytes += documentName + (index.queryScope === 'COLLECTION' ? parentName : 0) + 32 + orderedBytes + member;
      compositeIndexEntries++;
    }
  }
  const indexBytes = automaticIndexBytes + compositeBytes, indexEntries = automaticIndexEntries + compositeIndexEntries;
  return { documentBytes, automaticIndexBytes, automaticIndexEntries, compositeBytes, compositeIndexEntries,
    indexBytes, indexEntries, storedBytes: documentBytes + indexBytes };
}
