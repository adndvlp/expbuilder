import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFunctions, state } from '../persistence/bridge.mjs';
import { deliveries } from '../../api/persistence-e2e/task-queue.mjs';
import { createMeter } from '../core/meter.mjs';

test('CO14: the enqueue fault belongs to the export queue and cannot consume a setup timeout', async t => {
  const previous = { active: state.active, failEnqueue: state.failEnqueue, clock: state.clock };
  t.after(() => { Object.assign(state, previous); deliveries.length = 0; });
  deliveries.length = 0; state.active = null; state.clock = { now: () => 1000 };
  state.failEnqueue = 'processSessionExportTask';
  const functions = getFunctions();
  const timeout = functions.taskQueue('locations/us-central1/functions/processSessionTimeout');
  const exports = functions.taskQueue('locations/us-central1/functions/processSessionExportTask');
  await timeout.enqueue({ sessionId: 'S1', kind: 'setup' }, { scheduleTime: new Date(30000) });
  assert.equal(state.failEnqueue, 'processSessionExportTask');
  await assert.rejects(exports.enqueue({ sessionId: 'S1', revision: 1 }), { code: 'BENCHMARK_TASK_PLATFORM_FAILURE' });
  assert.equal(state.failEnqueue, null);
  await exports.enqueue({ sessionId: 'S1', revision: 1 });
  assert.deepEqual(deliveries.map(item => ({ name: item.name.split('/').at(-1), data: item.data, due: item.due })), [
    { name: 'processSessionTimeout', data: { sessionId: 'S1', kind: 'setup' }, due: 30000 },
    { name: 'processSessionExportTask', data: { sessionId: 'S1', revision: 1 }, due: 1000 },
  ]);
});

test('CO14: successful setup, failed export and its retry remain fully observed', async t => {
  const previous = { active: state.active, failEnqueue: state.failEnqueue, clock: state.clock };
  t.after(() => { Object.assign(state, previous); deliveries.length = 0; });
  const meter = createMeter({ scenario: 'queue-fault', environment: 'isolated SDK boundary test' });
  deliveries.length = 0; state.active = { meter }; state.clock = { now: () => 1000 };
  state.failEnqueue = 'processSessionExportTask';
  const functions = getFunctions();
  await functions.taskQueue('processSessionTimeout').enqueue({ kind: 'setup' });
  await assert.rejects(functions.taskQueue('processSessionExportTask').enqueue({ revision: 1 }));
  await functions.taskQueue('processSessionExportTask').enqueue({ revision: 1 });
  const result = meter.snapshot();
  assert.equal(result.metrics['tasks.enqueueAttempts'].value, '3');
  assert.equal(result.metrics['tasks.enqueueFailures'].value, '1');
  assert.equal(result.metrics['tasks.enqueued'].value, '2');
  assert.equal(result.metrics['tasks.billableUnits'].value, '2');
  assert.deepEqual(result.coverageIssues, []);
});
