import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { persistenceRepeatability } from '../persistence/repeatability.mjs';
import { compareReferences } from '../core/comparison.mjs';
import { createRepeatabilityContract } from '../core/repeatability.mjs';
import { fixture } from './comparison-fixtures.mjs';
import * as measurement from '../persistence/storage-measurement.mjs';

test('storage identity hashes the real algorithm, with native SDK identity, independently of product indexes', async () => {
  const method = await measurement.storageMethod();
  assert.equal(method.id, 'firestore-standard-storage/2');
  assert.equal(method.sources['benchmarks/persistence/storage.mjs'], createHash('sha256')
    .update(await readFile(new URL('../persistence/storage.mjs', import.meta.url))).digest('hex'));
  assert.match(method.sdk.version, /^\d+\.\d+\.\d+/);
  const none = { indexes: [], fieldOverrides: [] };
  const exempt = { indexes: [], fieldOverrides: [{ collectionGroup: 'tasks', fieldPath: '*', indexes: [] }] };
  const before = await measurement.storageMeasurement(none), after = await measurement.storageMeasurement(exempt);
  assert.deepEqual(before.method, method); assert.deepEqual(after.method, method);
  assert.notEqual(before.indexConfiguration.sha256, after.indexConfiguration.sha256);
  assert.deepEqual(before.indexConfiguration.value, none); assert.deepEqual(after.indexConfiguration.value, exempt);
  assert.equal(before.provenance, 'derived'); assert.equal(before.unit, 'byte');
  assert.equal(before.indexConfiguration.provenance, 'observed');
  exempt.fieldOverrides.length = 0;
  assert.equal(after.indexConfiguration.value.fieldOverrides.length, 1, 'Captured configuration is detached');
  assert.deepEqual((await measurement.storageMeasurement({ fieldOverrides: [], indexes: [] })).indexConfiguration, before.indexConfiguration,
    'JSON property order does not alter configuration identity');
  await assert.rejects(measurement.storageMeasurement({ fieldOverrides: [{ collectionGroup: 'tasks', fieldPath: 'a', ttl: true, indexes: [] }] }), /storage.*coverage/i);
});

test('capture inventory separates document, automatic and composite bytes and still integrates their total', () => {
  assert.equal(typeof measurement.storageInventory, 'function');
  const inventory = measurement.storageInventory(new Map([['tasks/a', { v: 1 }], ['tasks/b', { v: 2 }]]), { indexes: [], fieldOverrides: [] });
  // name = 6 + 2 + 16 = 24; doc = 24+2+8+32 = 66;
  // each ordered index = 24+0+2+8+32 = 66; two per doc.
  assert.deepEqual(inventory, { tasks: { documents: 2, documentBytes: 132,
    automaticIndexBytes: 264, automaticIndexEntries: 4, compositeBytes: 0, compositeIndexEntries: 0,
    indexBytes: 264, indexEntries: 4, storedBytes: 396 } });
  assert.throws(() => measurement.storageInventory(new Map([['tasks/a', { x: undefined }]]), {}), /storage.*coverage/i);
  assert.throws(() => measurement.storageInventory(new Map(), { fieldOverrides: [null] }), /storage.*coverage/i,
    'An empty inventory does not imply support for unknown configuration');
});

test('algorithm changes are incompatible; product index changes remain comparable with their metadata visible', async () => {
  const baseline = fixture(), candidate = fixture();
  const baseStorage = await measurement.storageMeasurement({ indexes: [], fieldOverrides: [] });
  const candidateStorage = await measurement.storageMeasurement({ indexes: [], fieldOverrides: [{ collectionGroup: 'tasks', fieldPath: '*', indexes: [] }] });
  for (const [bundle, storage] of [[baseline, baseStorage], [candidate, candidateStorage]]) {
    for (const scenario of bundle.reference.scenarios) scenario.storageModel = storage;
    bundle.reference.repeatability = await persistenceRepeatability(bundle.reference.scenarios);
  }
  assert.deepEqual(baseline.reference.repeatability.conditions.fixture.storageMethod, baseStorage.method);
  assert.equal(baseline.reference.repeatability.sha256, candidate.reference.repeatability.sha256);
  for (const [bundle, storage] of [[baseline, baseStorage], [candidate, candidateStorage]]) {
    const scenario = bundle.reference.scenarios[1];
    const inventory = measurement.storageInventory(new Map([['tasks/a', { v: 1 }]]), storage.indexConfiguration.value);
    scenario.inventory = { ...scenario.inventory, ...inventory };
    scenario.storageTimeline = [{ atSeconds: 0, bytes: inventory.tasks.storedBytes }];
  }
  let report = compareReferences({ baseline, candidate });
  assert.equal(report.exitCode, 0);
  assert.deepEqual(report.scenarios[1].storage.candidate.model, candidateStorage);
  assert.ok(report.scenarios[1].metrics.some(row => row.path === '/inventory/tasks/automaticIndexEntries' && row.state === 'decreased'));
  assert.ok(report.scenarios[1].money.some(row => row.path.includes('session-firestore-storage') && row.state === 'decreased'));
  const changed = globalThis.structuredClone(candidate.reference.repeatability.conditions.fixture);
  changed.storageMethod.sources['benchmarks/persistence/storage.mjs'] = 'b'.repeat(64);
  candidate.reference.repeatability = createRepeatabilityContract(candidate.reference.scenarios, changed);
  report = compareReferences({ baseline, candidate });
  assert.equal(report.exitCode, 4);
  assert.ok(report.issues.some(issue => issue.path?.includes('/fixture/storageMethod')));
});
