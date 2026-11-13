import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMeter } from '../core/meter.mjs';
import { observeFirestore } from '../core/firestore.mjs';
import { observeOperations, observeRealtimeDatabase, observeTaskQueue, observeTaskHandler } from '../core/adapters.mjs';
import { quantity } from '../core/quantity.mjs';
import { evidence, fakeFirestore } from './fixtures.mjs';

const meter = extra => createMeter({ scenario: 'observer-contracts', environment: 'in-memory SDK fixture', ...extra });
const value = (m, metric) => m.snapshot().metrics[metric]?.value;
const noIndexes = () => quantity(0, 'count', { provenance: 'not-applicable', source: 'Fixture has no indexed query charge' });
const wireBytes = () => quantity(32769, 'byte', { ...evidence, source: 'Declared request including envelope' });

describe('Firestore observer', () => {
  it('counts a missing lookup and each query page, including the empty-query minimum', async () => {
    const store = fakeFirestore(), m = meter(), db = observeFirestore(store.db, m, { queryIndexReads: noIndexes });
    store.records.set('items/a', { value: 1 }); store.records.set('items/b', { value: 2 });
    assert.equal((await db.collection('items').doc('absent').get()).exists, false);
    const first = await db.collection('items').limit(1).get();
    const second = await db.collection('items').startAfter(first.docs[0].ref).limit(1).get();
    await db.collection('items').startAfter(second.docs[0].ref).get();
    assert.equal(value(m, 'firestore.readCalls'), '4');
    assert.equal(value(m, 'firestore.queries'), '3');
    assert.equal(value(m, 'firestore.documentsReturned'), '2');
    assert.equal(value(m, 'firestore.readUnits'), '4');
    assert.equal(m.snapshot().metrics['firestore.readUnits'].provenance, 'derived');
    assert.equal(m.snapshot().coverageIssues.length, 0);
  });
  it('keeps snapshot refs instrumented and does not observe the same call twice', async () => {
    const store = fakeFirestore(), m = meter();
    const db = observeFirestore(store.db, m);
    assert.equal(observeFirestore(db, m), db);
    await db.collection('items').doc('a').set({ value: 1 });
    const result = await db.collection('items').doc('a').get();
    await result.ref.update({ value: 2 });
    await result.ref.delete();
    assert.equal(value(m, 'firestore.writes'), '2');
    assert.equal(value(m, 'firestore.deletes'), '1');
    assert.equal(value(m, 'firestore.readUnits'), '1');
    assert.equal(store.records.size, 0);
    assert.throws(() => observeFirestore(db, meter()), /already observed/);
  });
  it('records attempted writes and completed reads on rollback without claiming a committed write', async () => {
    const store = fakeFirestore(), m = meter(), db = observeFirestore(store.db, m);
    store.failNextCommit();
    await assert.rejects(db.runTransaction(async tx => {
      const ref = db.collection('items').doc('a');
      await tx.get(ref); tx.set(ref, { value: 1 });
    }), /commit unavailable/);
    assert.equal(store.records.size, 0);
    assert.equal(value(m, 'firestore.writeAttempts'), '1');
    assert.equal(value(m, 'firestore.writes'), '0');
    assert.equal(value(m, 'firestore.readUnits'), '1');
    assert.equal(value(m, 'firestore.transactionFailures'), '1');
  });
  it('counts each SDK retry but counts only the final transaction writes as committed', async () => {
    const store = fakeFirestore(), m = meter(), db = observeFirestore(store.db, m);
    store.retryNextTransaction();
    await db.runTransaction(async tx => {
      const ref = db.collection('items').doc('a');
      await tx.get(ref); tx.set(ref, { value: 1 });
    });
    assert.equal(value(m, 'firestore.transactionAttempts'), '2');
    assert.equal(value(m, 'firestore.writeAttempts'), '2');
    assert.equal(value(m, 'firestore.writes'), '1');
    assert.equal(value(m, 'firestore.readUnits'), '2');
  });
  it('measures individual batch mutations, keeps errors intact and rejects unobserved SDK operations', async () => {
    const store = fakeFirestore(), m = meter(), db = observeFirestore(store.db, m);
    const batch = db.batch();
    batch.set(db.collection('items').doc('a'), { value: 1 });
    batch.set(db.collection('items').doc('b'), { value: 2 });
    batch.delete(db.collection('items').doc('missing'));
    await batch.commit();
    assert.equal(value(m, 'firestore.writes'), '2');
    assert.equal(value(m, 'firestore.deletes'), '1');
    assert.throws(() => db.collection('items').count(), /Unobserved/);
    assert.ok(m.snapshot().coverageIssues.length);
  });
  it('marks index usage unknown when no query billing model was supplied', async () => {
    const store = fakeFirestore(), m = meter(), db = observeFirestore(store.db, m);
    await db.collection('items').get();
    assert.equal(value(m, 'firestore.readUnits'), '1');
    assert.equal(value(m, 'firestore.indexReadUnits'), null);
    assert.ok(m.snapshot().coverageIssues.length);
  });
  it('reports a failed index-cost model without turning a successful SDK query into a scenario failure', async () => {
    const store = fakeFirestore(), m = meter();
    const db = observeFirestore(store.db, m, { queryIndexReads: () => { throw new Error('invalid billing model'); } });
    assert.equal((await db.collection('items').get()).size, 0);
    assert.equal(value(m, 'firestore.readFailures'), '0');
    assert.equal(value(m, 'firestore.indexReadUnits'), null);
  });
  it('handles multi-document reads as one call and preserves failed batch/SDK reads', async () => {
    const store = fakeFirestore(), m = meter();
    store.records.set('items/a', { value: 1 });
    store.db.getAll = (...refs) => Promise.all(refs.map(ref => ref.get()));
    const db = observeFirestore(store.db, m);
    await db.getAll(db.collection('items').doc('a'), db.collection('items').doc('missing'));
    assert.equal(value(m, 'firestore.readCalls'), '1');
    assert.equal(value(m, 'firestore.readUnits'), '2');
    const batch = db.batch(); batch.set(db.collection('items').doc('b'), { value: 2 });
    store.failNextCommit();
    await assert.rejects(batch.commit(), /commit unavailable/);
    assert.equal(value(m, 'firestore.writes'), '0');
    assert.equal(value(m, 'firestore.batchFailures'), '1');
    const failure = new Error('read unavailable');
    store.db.getAll = async () => { throw failure; };
    await assert.rejects(db.getAll(db.collection('items').doc('a')), error => error === failure);
    assert.equal(value(m, 'firestore.readFailures'), '1');
  });
});

describe('function and service observers', () => {
  it('counts handlers that return immediately and failures, attributes SDK operations and preserves this/arguments', async () => {
    let time = 0;
    const m = meter({ clock: () => time, sampleMemory: () => 2048 });
    const handler = m.wrapFunction('write', async function (number) {
      m.add('test.calls', 1); time += 5;
      if (!number) throw new Error('retry');
      return this.prefix + number;
    }, { origin: 'firestore' });
    assert.equal(await handler.call({ prefix: 'value-' }, 3), 'value-3');
    await assert.rejects(handler(0), /retry/);
    await m.wrapFunction('noop', () => {}, { origin: 'schedule' })();
    const result = m.snapshot();
    assert.equal(value(m, 'functions.invocations'), '3');
    assert.equal(value(m, 'functions.failures'), '1');
    assert.equal(result.functions.write.metrics['test.calls'].value, '2');
    assert.equal(result.functions.write.metrics['functions.localDurationMs'].value, '10');
    assert.equal(result.functions.write.sampledRssMaxBytes, 2048);
    assert.ok(!JSON.stringify(result).includes('value-3'));
  });
  it('does not convert virtual scenario minutes into local function execution time', async () => {
    let realTime = 100, virtualTime = 0;
    const m = meter({ clock: () => realTime });
    await m.wrapFunction('timeout', async () => { virtualTime += 60000; realTime += 2; }, { origin: 'task' })();
    assert.equal(virtualTime, 60000);
    assert.equal(value(m, 'functions.localDurationMs'), '2');
  });
  it('exposes immutable snapshots, rejects invalid quantities and never substitutes zero for unknown values', () => {
    const m = meter();
    assert.throws(() => m.add('calls', -1));
    m.add('calls', 1);
    const snapshot = m.snapshot(); snapshot.metrics.calls.value = '999';
    assert.equal(value(m, 'calls'), '1');
    m.unknown('unmeasured.bytes', 'byte', 'Wire overhead not observed');
    assert.equal(value(m, 'unmeasured.bytes'), null);
  });
  it('does not replace the handler failure with a failed memory sample', async () => {
    let samples = 0;
    const failure = new Error('original handler failure');
    const m = meter({ sampleMemory: () => { if (++samples > 1) throw new Error('sampler failed'); return 100; } });
    const handler = m.wrapFunction('failing', async () => { throw failure; }, { origin: 'http' });
    await assert.rejects(handler(), error => error === failure);
    assert.equal(value(m, 'functions.failures'), '1');
    assert.ok(m.snapshot().coverageIssues.length);
  });
  it('bounds evidence aggregation while retaining counts and reporting truncated coverage', () => {
    const m = meter({ maxEvidencePerMetric: 1 });
    m.add('calls', 1, { source: 'one' }); m.add('calls', 1, { source: 'two' });
    assert.equal(value(m, 'calls'), '2');
    assert.ok(m.snapshot().coverageIssues.some(issue => /evidence/i.test(issue)));
    assert.equal(m.snapshot().metrics.calls.inputs.length, 1);
  });
  it('counts provider adapter attempts and failures, while preserving the actual response and error', async () => {
    const m = meter(), failure = new Error('provider unavailable');
    const provider = observeOperations({
      prefix: 'body-', async read(id) { return this.prefix + id; }, async write() { throw failure; },
    }, m, { service: 'provider.drive', operations: ['read', 'write'] });
    assert.equal(await provider.read('a'), 'body-a');
    await assert.rejects(provider.write(), error => error === failure);
    assert.equal(value(m, 'provider.drive.read.calls'), '1');
    assert.equal(value(m, 'provider.drive.write.failures'), '1');
    assert.ok(!JSON.stringify(m.snapshot()).includes('body-a'));
  });
});

describe('task and realtime observers', () => {
  it('counts task enqueue and delivery separately, including a retried delivery', async () => {
    const m = meter(), queue = observeTaskQueue({ async enqueue() { return { id: 'task' }; } }, m, { billableBytes: wireBytes, blockBytes: 32768 });
    assert.deepEqual(await queue.enqueue({ secret: 'must-not-be-recorded' }), { id: 'task' });
    let attempts = 0;
    const handler = observeTaskHandler(async () => { if (++attempts === 1) throw new Error('retry'); },
      m, { name: 'worker', billableBytes: wireBytes, blockBytes: 32768 });
    await assert.rejects(handler({ data: {} }), /retry/);
    await handler({ data: {} });
    assert.equal(value(m, 'tasks.enqueueAttempts'), '1');
    assert.equal(value(m, 'tasks.deliveries'), '2');
    assert.equal(value(m, 'tasks.billableUnits'), '6');
    assert.equal(value(m, 'functions.invocations'), '2');
    assert.ok(!JSON.stringify(m.snapshot()).includes('must-not-be-recorded'));
  });
  it('classifies failed task calls rather than treating every failure as either billed or free', async () => {
    const failure = new Error('bad request');
    const m = meter(), queue = observeTaskQueue({ async enqueue() { throw failure; } }, m,
      { billableBytes: wireBytes, blockBytes: 32768, classifyError: () => 'client' });
    await assert.rejects(queue.enqueue({}), error => error === failure);
    assert.equal(value(m, 'tasks.billableUnits'), '2');
    assert.equal(value(m, 'tasks.enqueueFailures'), '1');
    const unclassified = observeTaskQueue({ async enqueue() { throw failure; } }, m, { blockBytes: 32768 });
    await assert.rejects(unclassified.enqueue({}), error => error === failure);
    assert.equal(value(m, 'tasks.billableUnits'), null);
    assert.ok(m.snapshot().coverageIssues.length);
  });
  it('does not treat an invalid classification as a billable success or mask the SDK error', async () => {
    const failure = new Error('SDK failure'), m = meter();
    const queue = observeTaskQueue({ async enqueue() { throw failure; } }, m,
      { billableBytes: wireBytes, blockBytes: 32768, classifyError: () => 'invalid' });
    await assert.rejects(queue.enqueue({}), error => error === failure);
    assert.equal(value(m, 'tasks.billableUnits'), null);
  });
  it('keeps payload overhead assumptions visible in derived task-unit measurements', async () => {
    const m = meter(), queue = observeTaskQueue({ async enqueue() {} }, m, { billableBytes: wireBytes, blockBytes: 32768 });
    await queue.enqueue({});
    const serialized = JSON.stringify(m.snapshot().metrics['tasks.billableUnits']);
    assert.match(serialized, /Declared request including envelope/);
    assert.match(serialized, /assumed/);
  });
  it('does not cause a task retry solely because an accounting hypothesis failed', async () => {
    const m = meter(), queue = observeTaskQueue({ async enqueue() { return 'created'; } }, m,
      { blockBytes: 32768, billableBytes: () => { throw new Error('invalid size model'); } });
    assert.equal(await queue.enqueue({}), 'created');
    assert.equal(value(m, 'tasks.enqueued'), '1');
    assert.equal(value(m, 'tasks.enqueueFailures'), '0');
    assert.equal(value(m, 'tasks.billableUnits'), null);
  });
  it('tracks realtime payload separately from wire billing and observes listener deliveries and unsubscription', async () => {
    const callbacks = new Map(), m = meter(), payload = { connected: true };
    const snapshot = { val: () => payload };
    const nativeRef = {
      async once() { return snapshot; }, async set() {},
      on(event, callback) { callbacks.set(event, callback); return callback; },
      off(event, callback) { if (callbacks.get(event) === callback) callbacks.delete(event); },
    };
    const db = observeRealtimeDatabase({ ref: () => nativeRef }, m);
    const ref = db.ref('presence');
    await ref.set(payload); await ref.once('value');
    let received = 0;
    const callback = () => received++;
    ref.on('value', callback); callbacks.get('value')(snapshot); callbacks.get('value')(snapshot);
    ref.off('value', callback);
    assert.equal(received, 2); assert.equal(callbacks.size, 0);
    assert.equal(value(m, 'rtdb.readCalls'), '1');
    assert.equal(value(m, 'rtdb.listenerDeliveries'), '2');
    assert.equal(value(m, 'rtdb.writes'), '1');
    assert.equal(value(m, 'rtdb.payloadReadBytes'), '54');
    assert.equal(value(m, 'rtdb.downloadBytes'), null);
  });
  it('does not price uploaded content as downloaded bytes and keeps failed-transfer uncertainty visible', async () => {
    let fail = false;
    const failure = new Error('write unavailable'), m = meter();
    const db = observeRealtimeDatabase({ ref: () => ({ async set() { if (fail) throw failure; } }) }, m, {
      transferBytes: ({ outcome }) => ({
        download: quantity(outcome === 'failure' ? null : 20, 'byte', { ...evidence, source: 'Declared response including protocol' }),
        upload: quantity(100, 'byte', { ...evidence, source: 'Declared request including protocol' }),
      }),
    });
    await db.ref('presence').set({ value: 1 });
    assert.equal(value(m, 'rtdb.downloadBytes'), '20');
    assert.equal(value(m, 'rtdb.uploadBytes'), '100');
    fail = true;
    await assert.rejects(db.ref('presence').set({ value: 2 }), error => error === failure);
    assert.equal(value(m, 'rtdb.downloadBytes'), null);
    assert.equal(value(m, 'rtdb.uploadBytes'), '200');
    assert.equal(value(m, 'rtdb.writes'), '1');
  });
  it('preserves a realtime cancellation callback and records the failed subscription', () => {
    const failure = new Error('permission denied'), m = meter();
    const db = observeRealtimeDatabase({ ref: () => ({
      on(_event, callback, cancelled) { cancelled(failure); return callback; },
    }) }, m);
    let received;
    db.ref('presence').on('value', () => {}, error => { received = error; });
    assert.equal(received, failure);
    assert.equal(value(m, 'rtdb.listenerFailures'), '1');
    assert.equal(value(m, 'rtdb.downloadBytes'), null);
  });
});
