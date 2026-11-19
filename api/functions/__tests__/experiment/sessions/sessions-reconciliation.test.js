import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';

const timeouts = jest.fn(), exports = jest.fn();
const onSchedule = jest.fn((options, handler) => Object.assign(handler, { options }));
jest.unstable_mockModule('../../../experiment/sessions/timeout/dispatch.js', () => ({ reconcileSessionTimeouts: timeouts }));
jest.unstable_mockModule('../../../experiment/sessions/export/dispatch.js', () => ({ reconcileSessionExports: exports }));
jest.unstable_mockModule('firebase-functions/v2/scheduler', () => ({ onSchedule }));

const { reconcilePendingSessions } = await import('../../../experiment/sessions/reconciliation/functions.js');
beforeEach(() => {
  timeouts.mockReset().mockResolvedValue(undefined); exports.mockReset().mockResolvedValue({ inspected: 0 });
  jest.spyOn(Date, 'now').mockReturnValue(180000);
});
afterEach(() => jest.restoreAllMocks());

test('CO07: one minute registration retains the region, resource limits and both branches', async () => {
  expect(onSchedule).toHaveBeenCalledTimes(1);
  expect(reconcilePendingSessions.options).toEqual({ region: 'us-central1', schedule: 'every 1 minutes',
    timeZone: 'UTC', maxInstances: 5, timeoutSeconds: 120 });
  await reconcilePendingSessions();
  expect(timeouts).toHaveBeenCalledWith(180000); expect(exports).toHaveBeenCalledWith(180000);
  expect(timeouts).toHaveBeenCalledTimes(1); expect(exports).toHaveBeenCalledTimes(1);
});

test('CO07: both branches use the initial cutoff even when the clock advances', async () => {
  timeouts.mockImplementation(async () => { Date.now.mockReturnValue(240000); });
  await reconcilePendingSessions();
  expect(timeouts).toHaveBeenCalledWith(180000); expect(exports).toHaveBeenCalledWith(180000);
});

test('CO08: both branches start while a sibling is still pending', async () => {
  let finish;
  timeouts.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const tick = reconcilePendingSessions();
  await Promise.resolve(); await Promise.resolve();
  expect(exports).toHaveBeenCalledTimes(1);
  finish(); await tick;
});

test.each(['timeouts', 'exports', 'both'])('CO08: %s failure is reported after the other branch has run', async failed => {
  const timeoutError = new Error('timeouts unavailable'), exportError = new Error('exports unavailable');
  if (failed !== 'exports') timeouts.mockImplementation(() => { throw timeoutError; });
  if (failed !== 'timeouts') exports.mockRejectedValue(exportError);
  let failure;
  try { await reconcilePendingSessions(); } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(AggregateError);
  expect(failure.errors).toEqual(failed === 'both' ? [timeoutError, exportError] : [failed === 'timeouts' ? timeoutError : exportError]);
  expect(timeouts).toHaveBeenCalledTimes(1); expect(exports).toHaveBeenCalledTimes(1);
});
