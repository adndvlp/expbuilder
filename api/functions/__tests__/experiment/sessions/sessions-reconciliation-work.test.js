import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { setup, create, resume, activate, presence, store, base, enqueue, rtdb } from './lifecycle-test-harness.js';

jest.unstable_mockModule('firebase-functions/v2/scheduler', () => ({ onSchedule: (_options, handler) => handler }));
const { reconcilePendingSessions } = await import('../../../experiment/sessions/reconciliation/functions.js');
const { handleSessionTimeoutTask } = await import('../../../experiment/sessions/timeout/tasks.js');
let time;
beforeEach(() => {
  setup(); time = 100000; enqueue.mockReset().mockResolvedValue(undefined);
  jest.spyOn(Date, 'now').mockImplementation(() => time);
});
afterEach(() => jest.restoreAllMocks());

async function pending() {
  await create();
  const session = { ...store.records.get(base), lifecycle: 'disconnected', connectionPhase: 'disconnected',
    disconnectedAt: 100000, resumeExpiresAt: 600000, timeoutKind: 'deadline', timeoutExpiresAt: 600000,
    timeoutPending: true, timeoutNextDispatchAt: 0, presenceCheckPending: false };
  store.records.set(base, session);
  const exportBase = 'experiments/EID/sessions/S2';
  store.records.set(exportBase, { ...session, sessionId: 'S2', lifecycle: 'completed', timeoutPending: false,
    exportRequestedRevision: 1, exportConfirmedRevision: 0, exportLeaseUntil: 0 });
  store.records.set(exportBase + '/export_jobs/1', { experimentID: 'EID', sessionId: 'S2', revision: 1,
    dispatchDue: true, nextDispatchAt: 0, status: 'pending' });
  return exportBase;
}

test('CO07: an empty tick performs only the existing three queries and creates no control documents', async () => {
  const groups = jest.spyOn(store.db, 'collectionGroup');
  const before = globalThis.structuredClone([...store.records]);
  await reconcilePendingSessions();
  expect(groups.mock.calls.map(([name]) => name).sort()).toEqual(['export_jobs', 'sessions', 'sessions']);
  expect([...store.records]).toEqual(before); expect(enqueue).not.toHaveBeenCalled();
});

test('CO07: a tick dispatches both classes of pending work with their original identities and deadlines', async () => {
  const exportBase = await pending(); time = 130000;
  await reconcilePendingSessions();
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(enqueue.mock.calls.map(([data]) => data)).toEqual(expect.arrayContaining([
    expect.objectContaining({ experimentID: 'EID', sessionId: 'S1', expiresAt: 600000, connectionId: 'C1', connectionGeneration: 1, kind: 'deadline' }),
    expect.objectContaining({ experimentID: 'EID', sessionId: 'S2', revision: 1, dispatchGeneration: 1 }),
  ]));
  expect(store.records.get(base)).toMatchObject({ timeoutPending: true, timeoutExpiresAt: 600000, timeoutNextDispatchAt: 660000 });
  expect(store.records.get(exportBase + '/export_jobs/1')).toMatchObject({ dispatchDue: true, nextDispatchAt: 190000, dispatchGeneration: 1 });
  await reconcilePendingSessions(); expect(enqueue).toHaveBeenCalledTimes(2);
});

test.each(['timeout', 'export', 'both'])('CO08: %s enqueue failure retains durable work while the sibling runs, and the next minute retries', async failed => {
  const exportBase = await pending(); time = 130000;
  enqueue.mockImplementation(async data => {
    if (failed === 'both' || (failed === 'timeout' ? data.sessionId === 'S1' : data.sessionId === 'S2')) throw new Error('Queue unavailable');
  });
  await expect(reconcilePendingSessions()).rejects.toBeInstanceOf(AggregateError);
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(store.records.get(base)).toMatchObject({ timeoutPending: true, timeoutExpiresAt: 600000 });
  expect(store.records.get(exportBase + '/export_jobs/1')).toMatchObject({ dispatchDue: true, status: 'pending' });
  enqueue.mockClear().mockResolvedValue(undefined); time += 60000;
  await reconcilePendingSessions();
  expect(enqueue.mock.calls.map(([data]) => data.sessionId).sort()).toEqual(failed === 'export' ? ['S2'] : ['S1', 'S2']);
});

test('CO08: a failed timeout query cannot prevent export dispatch and leaves timeout intent discoverable', async () => {
  await pending(); time = 130000;
  const groups = jest.spyOn(store.db, 'collectionGroup');
  groups.mockImplementationOnce(() => { throw new Error('Read unavailable'); });
  await expect(reconcilePendingSessions()).rejects.toBeInstanceOf(AggregateError);
  expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'S2', revision: 1 }), expect.any(Object));
  expect(store.records.get(base)).toMatchObject({ timeoutPending: true, timeoutNextDispatchAt: 0 });
  groups.mockRestore(); time += 60000; await reconcilePendingSessions();
  expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'S1', expiresAt: 600000 }), expect.any(Object));
});

test('CO07: presence evaluation uses the tick cutoff when its RTDB read crosses an expiry', async () => {
  await create(); presence('C1', 1, true, time); await activate();
  presence('C1', 1, false, 120000); time = 179999;
  const ref = rtdb.ref;
  jest.spyOn(rtdb, 'ref').mockImplementation(path => {
    const value = ref(path);
    return { ...value, once: async () => { time = 180001; return value.once(); } };
  });
  await reconcilePendingSessions();
  expect(store.records.get(base)).toMatchObject({ lifecycle: 'disconnected', resumeExpiresAt: 180000, presenceCheckAt: 239999 });
  expect(store.records.has(base + '/export_jobs/1')).toBe(false);
  expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'S1', expiresAt: 180000 }), expect.any(Object));
});

test.each([true, false])('CO08: a dispatched stale timeout cannot close a resumed writer (IndexedDB %s)', async indexed => {
  setup(indexed); await pending(); time = 130000; await reconcilePendingSessions();
  const stale = enqueue.mock.calls.map(([data]) => data).find(data => data.sessionId === 'S1');
  time = 200000; expect((await resume()).statusCode).toBe(200);
  presence('C2', 2, true, time); await activate('C2', 2); time = 600001;
  await handleSessionTimeoutTask(stale);
  expect(store.records.get(base)).toMatchObject({ lifecycle: 'active', connectionId: 'C2', connectionGeneration: 2 });
  expect(store.records.has(base + '/export_jobs/1')).toBe(false);
});
