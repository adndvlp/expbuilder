import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { store, base, setup, event, append, close } from './export-test-harness.js';
const { acquireExportLease, fencedExportUpdate } = await import('../../../experiment/sessions/export/lease.js');
const ref = () => store.db.collection('experiments').doc('EID').collection('sessions').doc('S1');
const run = store.db.runTransaction.getMockImplementation();
let writes;
beforeEach(async () => {
  setup(); await append([event(0)]); await close([event(0)]);
  await acquireExportLease(ref(), ref().collection('export_jobs').doc('1'), 1, 100);
  writes = [];
  jest.spyOn(store.db, 'runTransaction').mockImplementation(callback => run(async tx => {
    const set = tx.set;
    tx.set = (target, data, options) => { writes.push({ path: target.path, data }); return set(target, data, options); };
    return callback(tx);
  }));
});
afterEach(() => { jest.restoreAllMocks(); store.db.runTransaction.mockImplementation(run); });

test('CO10: resource reservation omits only the empty job patch', async () => {
  await fencedExportUpdate(ref(), ref().collection('export_jobs').doc('1'), 1, {}, { exportResource: { id: 'stable' } });
  expect(writes).toEqual([{ path: base, data: { exportResource: { id: 'stable' } } }]);
  expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ fence: 1, status: 'running' });
});

test('CO10: empty patches still validate ownership without writing documents', async () => {
  await fencedExportUpdate(ref(), ref().collection('export_jobs').doc('1'), 1);
  expect(writes).toEqual([]);
});

test.each(['session fence', 'job fence', 'session deleting', 'experiment deleting', 'experiment missing', 'session missing', 'job missing', 'confirmed'])('CO10: %s rejects an empty update', async reason => {
  const job = base + '/export_jobs/1';
  if (reason === 'session fence') store.records.get(base).exportFence = 2;
  if (reason === 'job fence') store.records.get(job).fence = 2;
  if (reason === 'session deleting') store.records.get(base).deleting = true;
  if (reason === 'experiment deleting') store.records.get('experiments/EID').deleting = true;
  if (reason === 'experiment missing') store.records.delete('experiments/EID');
  if (reason === 'session missing') store.records.delete(base);
  if (reason === 'job missing') store.records.delete(job);
  if (reason === 'confirmed') store.records.get(job).status = 'confirmed';
  await expect(fencedExportUpdate(ref(), ref().collection('export_jobs').doc('1'), 1)).rejects.toMatchObject({ code: 'EXPORT_STALE_WORKER' });
  expect(writes).toEqual([]);
});

test('CO10: session status still updates session metadata when the job patch is empty', async () => {
  await fencedExportUpdate(ref(), ref().collection('export_jobs').doc('1'), 1, {}, { exportStatus: 'running' });
  expect(writes.map(item => item.path)).toEqual([base, 'experiments/EID/session_metadata/S1']);
  expect(store.records.get('experiments/EID/session_metadata/S1')).toMatchObject({ exportStatus: 'running', lastExportError: null });
});
