import { jest } from '@jest/globals';
import { store, base, setup, event, append, close, processJob, fakeAdapter, setRealtimeState, realtimeUpdates } from './export-test-harness.js';
jest.unstable_mockModule('firebase-functions/v2/tasks', () => ({ onTaskDispatched: (_options, handler) => handler }));
jest.unstable_mockModule('firebase-admin/functions', () => ({ getFunctions: () => ({ taskQueue: () => ({ enqueue: async () => {} }) }) }));
jest.unstable_mockModule('firebase-functions/v2/database', () => ({ onValueWritten: (_options, handler) => handler }));
const { handleSessionTimeoutTask } = await import('../../../experiment/sessions/timeout/tasks.js');
const { finalizeDisconnectedSessions } = await import('../../../experiment/sessions/finalization/triggers.js');
const payload = { experimentID: 'EID', sessionId: 'S1', expiresAt: 1000 };
beforeEach(() => { setup(); setRealtimeState({ state: 'disconnected', connected: false, resumeExpiresAt: 1000 }); });
describe('timeout delegates versioned sessions to the durable exporter', () => {
  test('closes at the existing timeout and leaves provider work pending without pretending it was saved', async () => {
    await append([event(0, 'A')]);
    const response = await handleSessionTimeoutTask(payload);
    expect(response).toMatchObject({ status: 'export_pending', revision: 1 });
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'expired', participantNumber: 23 });
    expect(store.records.get(base + '/export_jobs/1').status).toBe('pending');
    expect(realtimeUpdates.at(-1)).toMatchObject({ state: 'expired', exportStatus: 'pending', finalizationProcessed: false });
    const adapter = fakeAdapter(); await processJob(1, adapter);
    expect(adapter.rows()[0]).toMatchObject({ response: 'A', session_state: 'expired' });
  });
  test('a previously completed execution cannot be changed to expired by stale presence', async () => {
    await append([event(0)]); await close([event(0)]);
    expect(await handleSessionTimeoutTask(payload)).toMatchObject({ status: 'already_closed' });
    expect(store.records.get(base).lifecycle).toBe('completed');
    expect(store.records.get(base).exportRequestedRevision).toBe(1);
  });
  test('an empty timeout closes explicitly without scheduling a fake file', async () => {
    await handleSessionTimeoutTask(payload);
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'expired', exportStatus: 'empty', exportReceipt: { eventCount: 0, resource: null } });
    expect(store.records.get(base + '/export_jobs/1').dispatchDue).toBe(false);
  });
  test('a presence-triggered export request is reported pending until its worker confirms the bytes', async () => {
    await append([event(0)]);
    const update = jest.fn(async () => {});
    await finalizeDisconnectedSessions({ params: { experimentID: 'EID', sessionId: 'S1' }, data: {
      before: { val: () => ({ connected: true }) }, after: { ref: { update },
        val: () => ({ connected: false, useIndexedDB: false, state: 'completed', needsFinalization: true }) },
    } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ finalizationProcessed: false, exportStatus: 'pending' }));
    expect(store.records.get(base + '/export_jobs/1').status).toBe('pending');
  });
});
