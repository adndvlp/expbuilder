import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { store, base, setup, fakeAdapter, event, append, close, processJob, recover, requestExport } from './export-test-harness.js';

let reads, transactions;
const run = store.db.runTransaction.getMockImplementation();
function observeReads() {
  reads = []; transactions = [];
  const collection = store.db.collection;
  const wrapDoc = ref => ({ ...ref, collection: name => wrapCollection(ref.collection(name)) });
  const wrapCollection = ref => ({ ...ref, doc: id => wrapDoc(ref.doc(id)), get: async () => {
    reads.push(ref.path); return ref.get();
  } });
  jest.spyOn(store.db, 'collection').mockImplementation(path => wrapCollection(collection(path)));
  jest.spyOn(store.db, 'runTransaction').mockImplementation(callback => run(async tx => {
    const log = { reads: [], writes: [] }; transactions.push(log);
    const get = tx.get, set = tx.set;
    tx.get = async ref => { log.reads.push(ref.path); return get(ref); };
    tx.set = (ref, value, options) => { log.writes.push(ref.path); return set(ref, value, options); };
    return callback(tx);
  }));
}
beforeEach(() => setup());
afterEach(() => { jest.restoreAllMocks(); store.db.runTransaction.mockImplementation(run); });

test('CO11: receipt and payload queries belong to the lease transaction before any provider call', async () => {
  await append([event(0, 'A'), event(1, 'B')]); await close([event(0, 'A'), event(1, 'B')]);
  observeReads();
  const adapter = fakeAdapter(), reserve = adapter.reserve.getMockImplementation();
  adapter.reserve.mockImplementation(async (...args) => {
    expect(transactions).toHaveLength(1);
    expect(transactions[0].reads).toEqual([base, base + '/export_jobs/1', 'experiments/EID', base + '/event_receipts', base + '/trials']);
    expect(transactions[0].writes).toEqual([base, base + '/export_jobs/1']);
    return reserve(...args);
  });
  await processJob(1, adapter);
  expect(adapter.rows().map(row => row.response)).toEqual(['A', 'B']);
  // Preparation reads once; post-confirmation cleanup still reads a fresh target.
  expect(reads.filter(path => path === base + '/event_receipts')).toHaveLength(2);
  expect(reads.filter(path => path === base + '/trials')).toHaveLength(1);
});

test('CO11: payloads of a later frozen revision are known but excluded from the earlier CSV and cleanup', async () => {
  await append([event(0, 'A')]); store.records.get(base).lifecycle = 'expired'; await requestExport();
  await recover([event(1, 'B')]);
  observeReads(); const adapter = fakeAdapter();
  await processJob(1, adapter);
  expect(adapter.rows().map(row => row.response)).toEqual(['A']);
  expect(store.records.has(base + '/trials/event-1')).toBe(true);
  await processJob(2, adapter);
  expect(adapter.rows().map(row => row.response)).toEqual(['A', 'B']);
  expect(adapter.reserve).toHaveBeenCalledTimes(1);
});

test('CO11: recovery after acquiring the view cannot enter or invalidate its earlier target', async () => {
  await append([event(0, 'A')]); store.records.get(base).lifecycle = 'expired'; await requestExport();
  observeReads(); const adapter = fakeAdapter(), reserve = adapter.reserve.getMockImplementation();
  adapter.reserve.mockImplementationOnce(async (...args) => { await recover([event(1, 'B')]); return reserve(...args); });
  await processJob(1, adapter);
  expect(adapter.rows().map(row => row.response)).toEqual(['A']);
  expect(store.records.has(base + '/trials/event-1')).toBe(true);
  expect(store.records.get(base).exportReceipt).toMatchObject({ revision: 1, eventCount: 1 });
});

test('CO11: a retried lease rebuilds its view without provider effects inside the transaction', async () => {
  await append([event(0, 'A')]); store.records.get(base).lifecycle = 'expired'; await requestExport();
  observeReads(); const measuredRun = store.db.runTransaction.getMockImplementation(), adapter = fakeAdapter();
  const conflict = new Error('simulated transaction conflict');
  store.db.runTransaction.mockImplementationOnce(async callback => {
    await expect(measuredRun(async tx => { await callback(tx); throw conflict; })).rejects.toBe(conflict);
    expect(adapter.reserve).not.toHaveBeenCalled(); expect(adapter.read).not.toHaveBeenCalled(); expect(adapter.write).not.toHaveBeenCalled();
    await recover([event(1, 'B')]);
    return measuredRun(callback);
  });
  await processJob(1, adapter);
  const leases = transactions.filter(log => log.reads.includes(base + '/export_jobs/1') && log.reads.includes(base + '/trials'));
  expect(leases).toHaveLength(2);
  expect(adapter.reserve).toHaveBeenCalledTimes(1); expect(adapter.write).toHaveBeenCalledTimes(1);
  expect(adapter.rows().map(row => row.response)).toEqual(['A']);
  expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ fence: 1, attempts: 1, status: 'confirmed' });
  expect(store.records.has(base + '/trials/event-1')).toBe(true);
});

test.each(['changed target', 'unreceipted payload', 'missing payload'])('CO11: %s becomes durable attention without losing data or repeating a known invalid target', async reason => {
  await append([event(0)]); await close([event(0)]);
  if (reason === 'changed target') store.records.get(base + '/export_jobs/1').eventsHash = 'invalid-hash';
  if (reason === 'unreceipted payload') store.records.set(base + '/trials/unknown', { response: 'unaccounted' });
  if (reason === 'missing payload') store.records.delete(base + '/trials/event-0');
  observeReads(); const adapter = fakeAdapter();
  expect(await processJob(1, adapter)).toMatchObject({ status: 'needs_attention' });
  expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ status: 'needs_attention', dispatchDue: false, attempts: 1 });
  expect(store.records.get(base)).toMatchObject({ exportStatus: 'needs_attention', exportLeaseUntil: 0 });
  expect(store.records.has(base + '/event_receipts/event-0')).toBe(true);
  expect(adapter.write).not.toHaveBeenCalled();
  await processJob(1, adapter);
  expect(store.records.get(base + '/export_jobs/1').attempts).toBe(1);
});

test('CO12: an uncertain write retries from durable chunks without rereading preparation payloads', async () => {
  await append([event(0)]); await close([event(0)]);
  const adapter = fakeAdapter(), write = adapter.write.getMockImplementation();
  adapter.write.mockImplementationOnce(async (...args) => { await write(...args); throw new Error('response lost'); });
  await expect(processJob(1, adapter)).rejects.toThrow('response lost');
  observeReads();
  expect(await processJob(1, adapter)).toMatchObject({ status: 'confirmed', reconciled: true });
  expect(transactions[0].reads).toEqual([base, base + '/export_jobs/1', 'experiments/EID']);
  expect(reads.filter(path => path === base + '/trials')).toHaveLength(0);
  expect(reads.filter(path => path === base + '/event_receipts')).toHaveLength(1);
  expect(adapter.write).toHaveBeenCalledTimes(1);
});

test('CO12: a coherent view is not truncated at a write-batch-sized event count', async () => {
  const events = Array.from({ length: 507 }, (_, index) => event(index));
  for (let offset = 0; offset < events.length; offset += 100) await append(events.slice(offset, offset + 100));
  await close(events); observeReads(); const adapter = fakeAdapter();
  await processJob(1, adapter);
  expect(adapter.rows().map(row => row.event_sequence)).toEqual(events.map(item => String(item.sequence)));
  expect(new Set(adapter.rows().map(row => row.event_id)).size).toBe(507);
  expect(store.records.get(base).completion).toMatchObject({ confirmed: true, resultsSent: 507 });
  expect(reads.filter(path => path === base + '/event_receipts')).toHaveLength(2);
});
