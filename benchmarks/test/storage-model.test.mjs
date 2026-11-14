import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { documentStorage } from '../persistence/model.mjs';

const require = createRequire(new URL('../../api/functions/package.json', import.meta.url));
const { Timestamp, GeoPoint, Firestore } = require('@google-cloud/firestore');
const path = 'users/jeff/tasks/my_task_id'; // document name 44 B, parent 27 B.
const order = (queryScope = 'COLLECTION') => ({ queryScope, order: 'ASCENDING' });
const exemption = (fieldPath, indexes = []) => ({ collectionGroup: 'tasks', fieldPath, indexes });
const config = (...fieldOverrides) => ({ indexes: [], fieldOverrides });

// Expected arithmetic is written from the published formulas, never generated
// by the model: https://firebase.google.com/docs/firestore/storage-size
// and https://firebase.google.com/docs/firestore/query-data/index-overview
test('CO01: whole maps, nested maps and their leaves each have ordered entries', () => {
  const size = documentStorage(path, { m: { n: { x: 1 }, a: ['x', 'y', 'x'] } });
  // n = 32 + 2 + 8 = 42; a = 6; m = 32 + 2 + 42 + 2 + 6 = 84.
  assert.equal(size.documentBytes, 44 + 2 + 84 + 32);
  // m, m.n, m.n.x, m.a ordered twice; m.a CONTAINS has two distinct values.
  const ordered = 2 * ((44 + 27 + 2 + 84 + 32) + (44 + 27 + 4 + 42 + 32)
    + (44 + 27 + 6 + 8 + 32) + (44 + 27 + 4 + 6 + 32));
  assert.equal(size.automaticIndexEntries, 10);
  assert.equal(size.automaticIndexBytes, ordered + 2 * (44 + 27 + 4 + 2 + 32));
  assert.equal(size.compositeBytes, 0);
  assert.equal(size.compositeIndexEntries, 0);
  assert.equal(size.indexBytes, size.automaticIndexBytes);
  assert.equal(size.indexEntries, 10);
  assert.equal(size.storedBytes, size.documentBytes + size.indexBytes);
});

test('CO01: empty maps and arrays keep ordered entries, without array membership entries', () => {
  const size = documentStorage(path, { m: {}, a: [] });
  assert.equal(size.documentBytes, 44 + 2 + 32 + 2 + 0 + 32);
  assert.equal(size.indexEntries, 4);
  assert.equal(size.indexBytes, 2 * (44 + 27 + 2 + 32 + 32) + 2 * (44 + 27 + 2 + 0 + 32));
});

test('CO01: array membership deduplicates by Firestore type/value, not JSON serialization', () => {
  const data = { a: [NaN, NaN, null, 0, -0, Buffer.from([1]), new Uint8Array([1]), { b: 1, a: true }, { a: true, b: 1 }] };
  const size = documentStorage(path, data);
  // Whole array = 8+8+1+8+8+1+1+45+45=125; five distinct member values.
  assert.equal(size.documentBytes, 44 + 2 + 125 + 32);
  assert.equal(size.indexEntries, 7);
  assert.equal(size.indexBytes, 2 * (44 + 27 + 2 + 125 + 32)
    + 5 * (44 + 27 + 2 + 32) + 8 + 1 + 8 + 1 + 45);
});

test('CO01: native timestamps, bytes, geographical points and references retain their documented sizes', () => {
  const db = new Firestore({ projectId: 'storage-size-fixture' });
  const size = documentStorage(path, { date: new Date(0), timestamp: Timestamp.fromMillis(0),
    bytes: Buffer.from([1, 2, 3]), point: new GeoPoint(1, 2), reference: db.doc('users/jeff'), number: Infinity });
  const fields = (5 + 8) + (10 + 8) + (6 + 3) + (6 + 16) + (10 + 27) + (7 + 8);
  assert.equal(size.documentBytes, 44 + fields + 32);
  assert.equal(size.indexBytes, 2 * (6 * (44 + 27 + 32) + fields));
  assert.equal(size.indexEntries, 12);
  const duplicateTimes = documentStorage(path, { a: [new Date(0), Timestamp.fromMillis(0), new Timestamp(0, 1000)] });
  assert.equal(duplicateTimes.indexEntries, 4, 'Date and Timestamp at the same instant share one membership entry');
});

test('CO01: index truncation never truncates document bytes or array membership cardinality', () => {
  const size = documentStorage(path, { a: ['é'.repeat(800), 'é'.repeat(800) + 'x'] });
  assert.equal(size.documentBytes, 44 + 2 + 1601 + 1602 + 32);
  assert.equal(size.indexEntries, 4);
  assert.equal(size.indexBytes, 4 * (44 + 27 + 2 + 1500 + 32));
});

test('CO01: literal dotted names and nested paths remain distinct, including quoted exemptions', () => {
  const data = { 'a.b': 1, a: { b: 2 }, 'x`y': false };
  const all = documentStorage(path, data);
  // Indexed field paths: `a.b` (6 B), a (2 B), a.b (4 B), `x\`y` (7 B).
  assert.equal(all.indexBytes, 2 * (4 * (44 + 27 + 32) + (6 + 8) + (2 + 42) + (4 + 8) + (7 + 1)));
  const excluded = documentStorage(path, data, config(exemption('`a.b`')));
  assert.equal(excluded.indexBytes, all.indexBytes - 2 * (44 + 27 + 6 + 8 + 32));
  assert.equal(excluded.documentBytes, all.documentBytes);
});

test('CO02: a map exemption applies to descendants, with explicit child re-enabling independent of order', () => {
  const data = { m: { n: { x: 1, y: false }, a: ['x'] }, keep: true };
  const overrides = [exemption('m.n.x', [order()]), exemption('m')];
  const size = documentStorage(path, data, config(...overrides));
  assert.equal(size.documentBytes, documentStorage(path, data).documentBytes);
  assert.equal(size.indexEntries, 3);
  assert.equal(size.indexBytes, (44 + 27 + 6 + 8 + 32) + 2 * (44 + 27 + 5 + 1 + 32));
  assert.deepEqual(documentStorage(path, data, config(...overrides.reverse())), size);
});

test('CO02: collection wildcard, nearest map override and collection isolation', () => {
  const data = { m: { n: { x: 1 }, y: false }, a: ['x'], other: true };
  const size = documentStorage(path, data, config(exemption('*'), exemption('m', [order()]), exemption('m.n')));
  assert.equal(size.indexEntries, 2, 'Only the whole m value and m.y are enabled');
  assert.equal(size.indexBytes, (44 + 27 + 2 + 79 + 32) + (44 + 27 + 4 + 1 + 32));
  const noAutomatic = documentStorage(path, data, config(exemption('*')));
  assert.equal(noAutomatic.indexBytes, 0);
  assert.equal(noAutomatic.storedBytes, size.documentBytes);
  assert.deepEqual(documentStorage('users/jeff/elsewhere/a', data, config(exemption('*'))),
    documentStorage('users/jeff/elsewhere/a', data));
});

test('CO02: collection-group single-field entries use their own overhead and do not become defaults', () => {
  const data = { done: false };
  const size = documentStorage(path, data, config(exemption('done', [order(), order('COLLECTION_GROUP')])));
  assert.equal(size.indexEntries, 2);
  assert.equal(size.indexBytes, 109 + 98);
  assert.equal(documentStorage('tasks/a', data, config(exemption('done', [order('COLLECTION_GROUP')]))).indexBytes,
    24 + 5 + 1 + 48);
});

test('CO02: array membership can be enabled separately and inherits through maps', () => {
  const size = documentStorage(path, { m: { a: ['x', 'x', 'y'], scalar: true } },
    config(exemption('m', [{ queryScope: 'COLLECTION_GROUP', arrayConfig: 'CONTAINS' }])));
  assert.equal(size.indexEntries, 2);
  assert.equal(size.indexBytes, 2 * (44 + 4 + 2 + 48));
});

test('CO02: automatic exemptions preserve manual composites at both scopes, including whole maps', () => {
  const fields = [{ fieldPath: 'm', order: 'ASCENDING' }, { fieldPath: 'done', order: 'DESCENDING' }];
  const size = documentStorage(path, { m: { x: 1 }, done: false }, {
    fieldOverrides: [exemption('*')], indexes: ['COLLECTION', 'COLLECTION_GROUP'].map(queryScope => ({ collectionGroup: 'tasks', queryScope, fields })),
  });
  assert.equal(size.automaticIndexBytes, 0);
  assert.equal(size.compositeIndexEntries, 2);
  assert.equal(size.compositeBytes, (44 + 27 + 42 + 1 + 32) + (44 + 42 + 1 + 32));
  assert.equal(size.storedBytes, size.documentBytes + size.compositeBytes);
});

test('CO01: manual array composites have one entry per distinct member and exclude missing fields', () => {
  const indexes = [{ collectionGroup: 'tasks', queryScope: 'COLLECTION', fields: [
    { fieldPath: 'a', arrayConfig: 'CONTAINS' }, { fieldPath: 'done', order: 'ASCENDING' },
  ] }];
  const cfg = { indexes, fieldOverrides: [exemption('*')] };
  assert.equal(documentStorage(path, { a: ['x', 'x', 'long'], done: null }, cfg).compositeBytes,
    (44 + 27 + 2 + 1 + 32) + (44 + 27 + 5 + 1 + 32));
  assert.equal(documentStorage(path, { a: [], done: null }, cfg).indexEntries, 0);
  assert.equal(documentStorage(path, { a: ['x'] }, cfg).indexEntries, 0);
  assert.equal(documentStorage(path, { a: 'x', done: null }, cfg).indexEntries, 0);
});

test('CO03: unsupported values never turn into zero, including in exempt fields', () => {
  for (const value of [undefined, () => 1, Symbol('x'), 1n, new Map(), new Set(), { toMillis: () => 0 }, new Date(NaN), [[1]]]) {
    assert.throws(() => documentStorage(path, { bad: value }, config(exemption('*'))), /storage.*coverage|Unsupported Firestore/i);
  }
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => documentStorage(path, cyclic), /storage.*coverage/i);
  for (const data of [[], new Date(), 'text', null]) assert.throws(() => documentStorage(path, data), /storage.*coverage|Document path/i);
  for (const p of ['', 'users', '/users/a', 'users/a/', 'users//tasks/a']) assert.throws(() => documentStorage(p, {}), /storage.*coverage|Document path/i);
});

test('CO03: invalid or unsupported index configurations fail even for empty/unrelated documents', () => {
  const composite = { collectionGroup: 'other', queryScope: 'COLLECTION_GROUP', fields: [
    { fieldPath: 'a', order: 'ASCENDING' }, { fieldPath: 'b', order: 'DESCENDING' },
  ] };
  for (const cfg of [null, { indexes: null }, { fieldOverrides: {} }, { unexpected: [] },
    { indexes: [null] }, { indexes: [{ ...composite, fields: [null, composite.fields[1]] }] },
    config(null), config(exemption('m', [null])),
    { indexes: [{ ...composite, queryScope: 'UNKNOWN' }] },
    { indexes: [{ ...composite, fields: [{ fieldPath: 'a', vectorConfig: { dimension: 3, flat: {} } }] }] },
    { indexes: [{ ...composite, fields: [{ fieldPath: 'a', order: 'SIDEWAYS' }, composite.fields[1]] }] },
    { indexes: [{ ...composite, fields: [{ fieldPath: 'a', order: 'ASCENDING', arrayConfig: 'CONTAINS' }, composite.fields[1]] }] },
    { indexes: [{ ...composite, fields: composite.fields.map(f => ({ fieldPath: f.fieldPath, arrayConfig: 'CONTAINS' })) }] },
    { indexes: [{ ...composite, density: 'DENSE' }] },
    config(exemption('m', [{ order: 'ASCENDING' }])), config(exemption('m', [{ queryScope: 'COLLECTION', arrayConfig: 'OTHER' }])),
    config(exemption('m', [order(), order()])), config(exemption('m'), exemption('m')),
    config({ ...exemption('m'), ttl: true }), config(exemption('a..b')), config(exemption('`unclosed')),
    config(exemption('m.*')), config(exemption('__name__')),
  ]) assert.throws(() => documentStorage('unrelated/a', {}, cfg), /storage.*coverage/i, JSON.stringify(cfg));
});
