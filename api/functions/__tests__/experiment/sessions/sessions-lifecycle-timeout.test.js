import { jest } from '@jest/globals';
import { setup, create, activate, presence, store, base, enqueue } from './lifecycle-test-harness.js';
const { handleConnectionPresence } = await import('../../../experiment/sessions/lifecycle/presence.js');

let time = 100000;
beforeEach(() => { setup(); time = 100000; jest.spyOn(Date, 'now').mockImplementation(() => time); });
afterEach(() => jest.restoreAllMocks());
test.each([true, false].flatMap(indexed => ['googledrive', 'dropbox', 'osf'].map(provider => [indexed, provider])))('%s / %s starts its minute at the server disconnect timestamp, even with a delayed trigger', async (indexed, provider) => {
    setup(indexed, provider); await create(); presence('C1', 1, true, time); await activate();
    presence('C1', 1, false, 120000); time = 179999;
    await handleConnectionPresence({ experimentID: 'EID', sessionId: 'S1', connectionId: 'C1' }, { generation: 1 });
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'disconnected', resumeExpiresAt: 180000, timeoutPending: true });
    expect(store.records.has(base + '/export_jobs/1')).toBe(false);
    time = 180000;
    const { handleSessionTimeoutTask } = await import('../../../experiment/sessions/timeout/tasks.js');
    await handleSessionTimeoutTask({ experimentID: 'EID', sessionId: 'S1', connectionId: 'C1', connectionGeneration: 1, expiresAt: 180000 });
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'expired', timeoutPending: false });
  });
test('a durable timeout can be enqueued again after enqueue failure without changing the deadline', async () => {
  await create();
  const { dispatchSessionTimeout, reconcileSessionTimeouts } = await import('../../../experiment/sessions/timeout/dispatch.js');
  enqueue.mockRejectedValueOnce(new Error('queue unavailable'));
  await expect(dispatchSessionTimeout({ experimentID: 'EID', sessionId: 'S1' })).rejects.toThrow('queue unavailable');
  expect(store.records.get(base)).toMatchObject({ timeoutPending: true, timeoutExpiresAt: 130000 });
  time += 30001; await reconcileSessionTimeouts();
  expect(enqueue).toHaveBeenLastCalledWith(expect.objectContaining({ expiresAt: 130000, connectionId: 'C1', connectionGeneration: 1 }), expect.any(Object));
});
test.each([true, false])('the scheduler discovers a missed disconnect trigger in IndexedDB mode %s', async indexed => {
  setup(indexed); await create(); presence('C1', 1, true, time); await activate();
  presence('C1', 1, false, 120000); time = 180000;
  const { reconcileSessionTimeouts } = await import('../../../experiment/sessions/timeout/dispatch.js');
  await reconcileSessionTimeouts();
  expect(store.records.get(base)).toMatchObject({ lifecycle: 'expired', closedAt: new Date(180000).toISOString() });
  expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ status: 'empty' });
});
