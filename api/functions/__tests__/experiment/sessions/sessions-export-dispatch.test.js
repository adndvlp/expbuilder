import { jest } from '@jest/globals';
import { store, base, setup, event, append, close } from './export-test-harness.js';

const enqueue = jest.fn(async () => {});
jest.unstable_mockModule('firebase-admin/functions', () => ({ getFunctions: () => ({ taskQueue: () => ({ enqueue }) }) }));
jest.unstable_mockModule('firebase-functions/v2/firestore', () => ({ onDocumentWritten: (_options, handler) => handler }));
jest.unstable_mockModule('firebase-functions/v2/scheduler', () => ({ onSchedule: (_options, handler) => handler }));
jest.unstable_mockModule('firebase-functions/v2/tasks', () => ({ onTaskDispatched: (_options, handler) => handler }));
const queue = () => import('../../../experiment/sessions/export/dispatch.js');
const identity = { experimentID: 'EID', sessionId: 'S1', revision: 1 };
beforeEach(() => { setup(); enqueue.mockReset(); enqueue.mockResolvedValue(undefined); });
describe('durable export outbox', () => {
  test('an enqueue failure leaves a discoverable job, and a later scheduler dispatches the same identity', async () => {
    await append([event(0)]); expect((await close([event(0)])).statusCode).toBe(202);
    enqueue.mockRejectedValueOnce(new Error('Cloud Tasks unavailable'));
    const { dispatchSessionExport, reconcileSessionExports } = await queue();
    await expect(dispatchSessionExport(identity, () => 100)).rejects.toThrow();
    expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ dispatchDue: true, status: 'pending' });
    await reconcileSessionExports(40_000);
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[1][0]).toMatchObject(identity);
    expect(store.records.get('experiments/EID').sessions).toBe(1);
  });
  test('duplicate dispatcher delivery does not fan out another task while the dispatch claim is current', async () => {
    await append([event(0)]); await close([event(0)]);
    const { dispatchSessionExport } = await queue();
    await Promise.all([dispatchSessionExport(identity, () => 100), dispatchSessionExport(identity, () => 100)]);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][1]).toMatchObject({ dispatchDeadlineSeconds: 300 });
  });
  test('the scheduler can rediscover a crashed dispatch after its claim expires', async () => {
    await append([event(0)]); await close([event(0)]);
    const { reconcileSessionExports } = await queue();
    await reconcileSessionExports(100); await reconcileSessionExports(200); await reconcileSessionExports(100_000);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });
  test('a late enqueue error cannot reopen a confirmed job', async () => {
    await append([event(0)]); await close([event(0)]);
    let reject, entered;
    const arrived = new Promise(resolve => { entered = resolve; });
    enqueue.mockImplementationOnce(() => { entered(); return new Promise((_resolve, fail) => { reject = fail; }); });
    const { dispatchSessionExport } = await queue();
    const pending = dispatchSessionExport(identity, () => 100); await arrived;
    store.records.set(base + '/export_jobs/1', { ...store.records.get(base + '/export_jobs/1'), status: 'confirmed', dispatchDue: false });
    reject(new Error('late enqueue failure')); await expect(pending).rejects.toThrow();
    expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ status: 'confirmed', dispatchDue: false });
  });
});
