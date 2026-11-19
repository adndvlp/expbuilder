import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareReferences } from '../core/comparison.mjs';
import { referenceBudgets } from '../persistence/budget.mjs';
import { functionInventory, functionMeasurements } from '../persistence/function-inventory.mjs';
import { createDispatcher } from '../persistence/dispatcher.mjs';
import { createMeter } from '../core/meter.mjs';
import { fixture, profile, q } from './comparison-fixtures.mjs';
import { registeredExports } from './function-inventory-fixture.mjs';
import { createRepeatabilityContract } from '../core/repeatability.mjs';

async function captured(form = 'split') {
  const bundle = fixture();
  for (const scenario of bundle.reference.scenarios) {
    const { definitions, evidence } = functionInventory(registeredExports(form));
    const meter = createMeter({ scenario: scenario.name, environment: scenario.environment });
    for (const definition of definitions) definition.handler = () => {
      const reads = definition.name === 'reconcilePendingSessions' ? 3 : definition.name === 'reconcilePendingSessionTimeouts' ? 2 : 1;
      meter.add('firestore.readCalls', reads); meter.add('firestore.readUnits', reads);
    };
    let now = 0;
    const dispatcher = createDispatcher({ meter, definitions, queue: [], now: () => now });
    now = 60000; await dispatcher.pump();
    if (scenario.name !== 'idle') await meter.wrapFunction('apiData', () => {
      meter.add('firestore.readCalls', 5); meter.add('firestore.readUnits', 5); meter.add('firestore.writes', 3);
    }, { origin: 'http' })();
    const snapshot = meter.snapshot();
    scenario.functions = snapshot.functions;
    scenario.metrics = { ...scenario.metrics, ...snapshot.metrics };
    scenario.registrations = definitions.map(({ handler, ...entry }) => { void handler; return entry; });
    scenario.functionInventory = evidence;
  }
  bundle.budgets = referenceBudgets(bundle.reference, profile);
  return bundle;
}

test('CO05: split and consolidated handlers are compared through one explicit responsibility, with physical evidence', async () => {
  const baseline = await captured(), candidate = await captured('consolidated');
  const report = compareReferences({ baseline, candidate });
  assert.equal(report.exitCode, 0, JSON.stringify(report.issues));
  assert.deepEqual(report.scenarios[0].attribution.members, {
    baseline: ['reconcilePendingSessionExports', 'reconcilePendingSessionTimeouts'], candidate: ['reconcilePendingSessions'] });
  const calls = report.scenarios[0].metrics.find(row => row.path === '/responsibilities/session-reconciliation/metrics/functions.invocations');
  assert.equal(calls.before, '2'); assert.equal(calls.after, '1'); assert.equal(calls.gated, true);
  assert.ok(report.scenarios[0].metrics.some(row => row.path.includes('/functions/reconcilePendingSessionTimeouts/') && row.gated === false));
  assert.ok(report.scenarios[0].physicalQuantities.length > 0);
  assert.ok(report.scenarios[0].physicalMoney.length > 0);
  assert.ok(report.scenarios[0].quantities.some(row => row.path.includes('responsibility-session-reconciliation') && row.path.includes('memory')));
  assert.ok(report.scenarios[0].money.some(row => row.path.endsWith('/total') && row.state === 'decreased'));
});

for (const [metric, unit] of [['firestore.readUnits', 'count'], ['functions.invocations', 'count'], ['rtdb.downloadBytes', 'byte']]) {
  test('CO06: one extra ' + metric + ' is a regression within the same structure', async () => {
    const baseline = await captured(), candidate = await captured();
    for (const scenario of candidate.reference.scenarios) {
      scenario.functions.reconcilePendingSessionTimeouts.metrics[metric] = q(
        Number(functionMeasurements(scenario.functions.reconcilePendingSessionTimeouts)[metric].value) + 1, unit);
      scenario.metrics[metric] = q(Number(scenario.metrics[metric]?.value || 0) + 1, unit);
    }
    const report = compareReferences({ baseline, candidate });
    assert.equal(report.exitCode, 2, JSON.stringify(report.issues));
    assert.ok(report.issues.some(issue => issue.path?.startsWith('/responsibilities/session-reconciliation/') && issue.path.endsWith(metric)));
  });
}

test('CO06: members, inventory and known measurements cannot disappear, repeat, rename or become unknown', async () => {
  const baseline = await captured();
  for (const mutate of [
    s => { delete s.functions.reconcilePendingSessionTimeouts; },
    s => { s.functionInventory.responsibilities[0].members.pop(); },
    s => { s.functionInventory.responsibilities[0].members.push('reconcilePendingSessionTimeouts'); },
    s => { s.functionInventory.responsibilities[0].members = ['renamed']; },
    s => { delete s.functions.reconcilePendingSessionTimeouts.metrics['firestore.readUnits']; },
    s => { s.functions.reconcilePendingSessionTimeouts.metrics['firestore.readUnits'] = q(null); },
    s => { s.functions.reconcilePendingSessionTimeouts.metrics['unobserved.measurement'] = q(null); },
    s => { delete s.functions.reconcilePendingSessionTimeouts.observer.zeroMetrics['rtdb.downloadBytes']; },
    s => { delete s.functionInventory; },
  ]) {
    const candidate = await captured(); mutate(candidate.reference.scenarios[0]);
    const report = compareReferences({ baseline, candidate });
    assert.ok([3, 4].includes(report.exitCode), JSON.stringify(report.issues));
  }
});

test('CO05: allocation is priced per physical function before attribution, preserving phase and resource', async () => {
  const baseline = await captured(), candidate = await captured();
  for (const scenario of candidate.reference.scenarios) {
    const name = 'reconcilePendingSessionTimeouts';
    scenario.registrations.find(entry => entry.name === name).memoryMiB = 512;
    scenario.registrations.find(entry => entry.name === name).endpoint.availableMemoryMb = 512;
    const record = scenario.functionInventory.registered.find(entry => entry.name === name);
    record.memoryMiB = 512; record.endpoint.availableMemoryMb = 512;
  }
  const report = compareReferences({ baseline, candidate });
  assert.equal(report.exitCode, 2);
  const increased = report.scenarios[0].quantities.filter(row => row.path.includes('responsibility-session-reconciliation') && row.state === 'increased');
  assert.ok(increased.some(row => row.unit === 'GiB-second' && row.path.includes('startup')));
  assert.ok(increased.some(row => row.unit === 'GiB-second' && row.path.includes('active')));
  assert.ok(!increased.some(row => row.unit === 'vCPU-second'));
});

test('CO06: the declared inventory method requires coverage even when every inventory is removed on both sides', async () => {
  const baseline = await captured(), candidate = await captured();
  for (const bundle of [baseline, candidate]) {
    const definition = globalThis.structuredClone(bundle.reference.repeatability.conditions.fixture);
    definition.sources['benchmarks/persistence/function-inventory.mjs'] = 'c'.repeat(64);
    bundle.reference.repeatability = createRepeatabilityContract(bundle.reference.scenarios, definition);
    for (const scenario of bundle.reference.scenarios) delete scenario.functionInventory;
  }
  const report = compareReferences({ baseline, candidate });
  assert.equal(report.exitCode, 3);
  assert.ok(report.issues.some(issue => issue.code === 'function_inventory_missing'));
});
