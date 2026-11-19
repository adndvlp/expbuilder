import assert from 'node:assert/strict';
import { test } from 'node:test';
import { documentStorage, indexReadUnits, changedDocuments, registration } from '../persistence/model.mjs';
import { createDispatcher } from '../persistence/dispatcher.mjs';
import { createMeter } from '../core/meter.mjs';

test('document storage follows the documented example and includes indexes separately from JSON', () => {
  const size = documentStorage('users/jeff/tasks/my_task_id', { type: 'Personal', done: false, priority: 1, description: 'Learn Cloud Firestore' });
  assert.equal(size.documentBytes, 147);
  assert.equal(size.indexBytes, 2 * (117 + 109 + 120 + 137));
  assert.equal(size.indexEntries, 8);
  const composite = documentStorage('users/jeff/tasks/my_task_id', { done: false, priority: 1 }, {
    indexes: [{ collectionGroup: 'tasks', queryScope: 'COLLECTION_GROUP', fields: [{ fieldPath: 'done', order: 'ASCENDING' }, { fieldPath: 'priority', order: 'ASCENDING' }] }], fieldOverrides: [],
  });
  assert.equal(composite.indexEntries, 5);
  assert.equal(composite.compositeBytes, 44 + 1 + 8 + 32);
});
test('index model permits only the documented one-range exemption and refuses unknown charges', () => {
  assert.equal(indexReadUnits({ query: { filters: [{ field: 'pending', operator: '==' }, { field: 'due', operator: '<=' }], orderBy: ['due'], offset: 0 } }).value, '0');
  assert.throws(() => indexReadUnits({ query: { filters: [{ field: 'a', operator: '>' }], orderBy: ['b'], offset: 0 } }), /index entries/);
  assert.throws(() => indexReadUnits({ query: { filters: [], orderBy: [], offset: 1 } }), /offset/);
  assert.throws(() => indexReadUnits({ query: { filters: [{ field: '__name__', operator: '==' }], orderBy: ['other'], offset: 0 } }), /index entries/);
});
test('a commit yields one event for each changed document and none for equal data', () => {
  const cache = new Map([['a', { value: 1 }]]);
  assert.deepEqual(changedDocuments(cache, [{ path: 'a', data: { value: 1 } }, { path: 'a', data: { value: 2 } }, { path: 'b', data: null }]), [{ path: 'a', before: { value: 1 }, after: { value: 2 } }]);
  assert.deepEqual(changedDocuments(cache, [{ path: 'a', data: null }]), [{ path: 'a', before: { value: 2 }, after: null }]);
});
test('registration reads actual endpoint options and rejects unsupported schedules', () => {
  const sdkReset = { toJSON: () => null };
  const defaults = registration('default', { run() {}, __endpoint: { availableMemoryMb: sdkReset, minInstances: sdkReset, httpsTrigger: {} } });
  assert.equal(defaults.memoryMiB, 256); assert.equal(defaults.minInstances, 0);
  const entry = registration('worker', { run() {}, __endpoint: { platform: 'gcfv2', region: ['us-central1'], availableMemoryMb: 512, taskQueueTrigger: { retryConfig: { maxAttempts: 8 } } } });
  assert.equal(entry.memoryMiB, 512); assert.equal(entry.cpu, 1); assert.equal(entry.origin, 'task');
  assert.throws(() => registration('bad', { run() {}, __endpoint: { scheduleTrigger: { schedule: '* * * * *' } } }), /schedule/);
});
test('dispatcher counts no-op triggers, retries tasks, and never calls schedules every pump', async () => {
  let now = 0, calls = 0;
  const meter = createMeter({ scenario: 'dispatch', environment: 'fixture' }), queue = [];
  const definitions = [
    { name: 'schedule', origin: 'schedule', intervalMs: 60000, handler: () => { calls++; } },
    { name: 'worker', origin: 'task', retry: { maxAttempts: 3, minBackoffSeconds: 30, maxBackoffSeconds: 60, maxDoublings: 1 }, handler: () => { if (++calls === 1) throw new Error('retry'); } },
    { name: 'noop', origin: 'firestore', handler: () => {} },
  ];
  const dispatcher = createDispatcher({ meter, definitions, queue, now: () => now });
  dispatcher.event('noop', {}); queue.push({ name: 'worker', data: {}, due: 0 });
  await dispatcher.pump();
  assert.equal(meter.snapshot().functions.noop.metrics['functions.invocations'].value, '1');
  assert.equal(meter.snapshot().metrics['tasks.deliveries'].value, '1');
  assert.equal(queue[0].due, 30000);
  now = 29999; await dispatcher.pump(); assert.equal(calls, 1);
  now = 30000; await dispatcher.pump(); assert.equal(calls, 2);
  now = 60000; await dispatcher.pump(); await dispatcher.pump(); assert.equal(calls, 3);
  assert.equal(meter.snapshot().metrics['tasks.retries'].value, '1');
  assert.equal(meter.snapshot().functions.schedule.metrics['functions.invocations'].value, '1');
});
test('dispatcher preserves event retries as extra invocations and fails exhausted tasks', async () => {
  let now = 0, attempts = 0;
  const meter = createMeter({ scenario: 'retry', environment: 'fixture' }), queue = [];
  const dispatcher = createDispatcher({ meter, queue, now: () => now, definitions: [
    { name: 'event', origin: 'firestore', retry: { maxAttempts: 2, minBackoffSeconds: 1, maxBackoffSeconds: 1, maxDoublings: 0 }, handler: () => { if (++attempts === 1) throw new Error('transient'); } },
    { name: 'task', origin: 'task', retry: { maxAttempts: 1 }, handler: () => { throw new Error('permanent'); } },
  ] });
  dispatcher.event('event', {}); await dispatcher.pump(); now = 1000; await dispatcher.pump();
  assert.equal(meter.snapshot().functions.event.metrics['functions.invocations'].value, '2');
  queue.push({ name: 'task', data: {}, due: now });
  await assert.rejects(dispatcher.pump(), /exhausted.*task/);
});
