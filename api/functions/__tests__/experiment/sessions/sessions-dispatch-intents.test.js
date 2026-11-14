import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';

const timeout = jest.fn(), dispatch = jest.fn();
jest.unstable_mockModule('../../../experiment/sessions/timeout/dispatch.js', () => ({ dispatchSessionTimeout: timeout }));
jest.unstable_mockModule('../../../experiment/sessions/export/dispatch.js', () => ({ dispatchSessionExport: dispatch }));
jest.unstable_mockModule('../../../experiment/sessions/export/process.js', () => ({ processSessionExport: jest.fn() }));
jest.unstable_mockModule('firebase-functions/v2/firestore', () => ({ onDocumentWritten: (_options, handler) => handler }));
jest.unstable_mockModule('firebase-functions/v2/tasks', () => ({ onTaskDispatched: (_options, handler) => handler }));
const { enqueueSessionTimeout } = await import('../../../experiment/sessions/timeout/functions.js');
const { enqueueSessionExport } = await import('../../../experiment/sessions/export/functions.js');

const snapshot = data => ({ exists: data !== undefined, data: () => data });
const change = (before, after) => ({ params: { experimentID: 'EID', sessionId: 'S1', revision: String(after?.revision ?? before?.revision ?? 1) },
  data: { before: snapshot(before), after: snapshot(after) } });
const deadline = { timeoutPending: true, timeoutNextDispatchAt: 0, timeoutKind: 'deadline', timeoutExpiresAt: 180000,
  connectionId: 'C1', connectionGeneration: 1 };
const job = { revision: 1, dispatchDue: true, nextDispatchAt: 0, status: 'pending', cleanupPending: false, attempts: 0 };
beforeEach(() => { timeout.mockReset(); dispatch.mockReset(); jest.spyOn(Date, 'now').mockReturnValue(100000); });
afterEach(() => jest.restoreAllMocks());

test.each([
  { lastUpdate: 123 }, { presenceCheckAt: 160000 }, { timeoutNextDispatchAt: 240000 },
  { lifecycle: 'disconnected' }, { timeoutPending: false },
])('CO09: timeout progress %j does not read the dispatcher', async patch => {
  await enqueueSessionTimeout(change(deadline, { ...deadline, ...patch }));
  expect(timeout).not.toHaveBeenCalled();
});

test.each([
  ['initial request', undefined, deadline],
  ['pending reactivation', { ...deadline, timeoutPending: false }, deadline],
  ['new writer', deadline, { ...deadline, connectionId: 'C2', connectionGeneration: 2 }],
  ['new generation', deadline, { ...deadline, connectionGeneration: 2 }],
  ['new kind', deadline, { ...deadline, timeoutKind: 'setup' }],
  ['new deadline', deadline, { ...deadline, timeoutExpiresAt: 240000 }],
  ['retry due now', { ...deadline, timeoutNextDispatchAt: 240000 }, deadline],
])('CO09: timeout %s preserves dispatch and propagates enqueue failure', async (_name, before, after) => {
  timeout.mockRejectedValueOnce(new Error('queue unavailable'));
  await expect(enqueueSessionTimeout(change(before, after))).rejects.toThrow('queue unavailable');
  await enqueueSessionTimeout(change(before, after));
  expect(timeout).toHaveBeenCalledTimes(2);
  expect(timeout).toHaveBeenCalledWith(expect.objectContaining({ experimentID: 'EID', sessionId: 'S1' }));
});

test('CO09: a timeout intent with future retry availability waits for reconciliation', async () => {
  await enqueueSessionTimeout(change(undefined, { ...deadline, timeoutNextDispatchAt: 130000 }));
  expect(timeout).not.toHaveBeenCalled();
});

test.each([
  { dispatchGeneration: 1, lastDispatchAt: 100000, nextDispatchAt: 160000 },
  { status: 'running', attempts: 1 }, { status: 'reconciling', attempts: 1, startedAt: 100000 },
  { phase: 'prepared', intent: { csvHash: 'hash' } },
  { phase: 'writing' }, { observedResource: { id: 'stable' } }, { dispatchDue: false },
])('CO09: export progress %j does not read the dispatcher', async patch => {
  await enqueueSessionExport(change(job, { ...job, ...patch }));
  expect(dispatch).not.toHaveBeenCalled();
});

test.each([
  ['initial request', undefined, job],
  ['pending reactivation', { ...job, dispatchDue: false }, job],
  ['revision', job, { ...job, revision: 2 }],
  ['explicit retry', { ...job, status: 'needs_attention', dispatchDue: false, attempts: 8 }, job],
  ['retry same status', { ...job, status: 'reconciling', attempts: 3, nextDispatchAt: 200000 }, { ...job, status: 'reconciling' }],
  ['cleanup requested', { ...job, status: 'running' }, { ...job, status: 'confirmed', cleanupPending: true }],
  ['cleanup reactivated', { ...job, status: 'confirmed', cleanupPending: false }, { ...job, status: 'confirmed', cleanupPending: true }],
])('CO09: export %s dispatches the durable identity on each eligible delivery', async (_name, before, after) => {
  dispatch.mockRejectedValueOnce(new Error('queue unavailable'));
  await expect(enqueueSessionExport(change(before, after))).rejects.toThrow('queue unavailable');
  await enqueueSessionExport(change(before, after));
  expect(dispatch).toHaveBeenCalledTimes(2);
  expect(dispatch).toHaveBeenCalledWith({ experimentID: 'EID', sessionId: 'S1', revision: after.revision });
});

test.each(['retry_wait', 'reconciling'])('CO09: a future %s retry waits for reconciliation', async status => {
  await enqueueSessionExport(change(job, { ...job, status, nextDispatchAt: 130000 }));
  expect(dispatch).not.toHaveBeenCalled();
});

test('CO09: removed documents cannot dispatch', async () => {
  await enqueueSessionExport(change(job, undefined)); await enqueueSessionTimeout(change(deadline, undefined));
  expect(dispatch).not.toHaveBeenCalled(); expect(timeout).not.toHaveBeenCalled();
});
