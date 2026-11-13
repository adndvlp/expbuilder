import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareReferences } from '../core/comparison.mjs';
import { fixture, profile, q } from './comparison-fixtures.mjs';
import { referenceBudgets } from '../persistence/budget.mjs';
const compare = (baseline, candidate, options = {}) => compareReferences({ baseline, candidate, ...options });
const normal = bundle => bundle.reference.scenarios.find(s => s.name === 'normal');

test('identical captured workload passes with exact zero changes and independently repriced totals', () => {
  const baseline = fixture(), result = compare(baseline, globalThis.structuredClone(baseline));
  assert.equal(result.status, 'passed'); assert.equal(result.exitCode, 0);
  assert.equal(result.captures.baseline.revision, baseline.reference.revision);
  assert.deepEqual(result.scenarios[1].inputs.baseline, normal(baseline).inputs);
  assert.ok(result.scenarios.find(s => s.name === 'normal').metrics.every(row => row.delta === '0'));
  assert.ok(result.scenarios.find(s => s.name === 'normal').money.every(row => row.delta === '0'));
});
test('one extra read fails even when the stored budget was not updated', () => {
  const baseline = fixture(), candidate = fixture(); normal(candidate).metrics['firestore.readUnits'] = q(9);
  const result = compare(baseline, candidate);
  assert.equal(result.status, 'regression'); assert.equal(result.exitCode, 2);
  const row = result.scenarios.find(s => s.name === 'normal').metrics.find(row => row.path === '/metrics/firestore.readUnits');
  assert.equal(row.delta, '1'); assert.equal(row.percent, '12.5');
  assert.ok(result.scenarios.find(s => s.name === 'normal').money.some(row => row.path.endsWith('/total') && row.state === 'increased'));
});
test('a metric disappearing is incomplete; an explicitly measured reduction to zero is a decrease', () => {
  const baseline = fixture(), candidate = fixture(); delete normal(candidate).metrics['firestore.writes'];
  assert.equal(compare(baseline, candidate).status, 'incomplete');
  normal(candidate).metrics['firestore.writes'] = q(0);
  const result = compare(baseline, candidate);
  assert.equal(result.status, 'passed');
  assert.equal(result.scenarios[1].metrics.find(row => row.path === '/metrics/firestore.writes').percent, '-100');
});
test('new quantities starting above zero are reported without infinity or division by zero', () => {
  const baseline = fixture(), candidate = fixture(); normal(candidate).metrics['new.calls'] = q(1);
  const result = compare(baseline, candidate);
  const row = result.scenarios[1].metrics.find(row => row.path === '/metrics/new.calls');
  assert.equal(row.state, 'new'); assert.equal(row.percent, null); assert.equal(row.delta, '1');
  assert.equal(result.status, 'regression'); assert.ok(!JSON.stringify(result).includes('Infinity'));
});
test('scenario omissions, duplicates and unsupported formats cannot pass', () => {
  const baseline = fixture(), candidate = fixture(); candidate.reference.scenarios.pop();
  candidate.budgets.scenarios = [];
  assert.equal(compare(baseline, candidate).status, 'incompatible');
  candidate.reference.scenarios.push(candidate.reference.scenarios[0]);
  assert.equal(compare(baseline, candidate).status, 'invalid_input');
  candidate.reference.format = 2;
  assert.equal(compare(baseline, candidate).status, 'incompatible');
});
test('failed CSV checks and unknown quantities block a cheap candidate', () => {
  const baseline = fixture(), candidate = fixture(); normal(candidate).functional.passed = false;
  assert.equal(compare(baseline, candidate).status, 'functional_failure');
  normal(candidate).functional.passed = true; normal(candidate).metrics['firestore.writes'] = q(null);
  assert.equal(compare(baseline, candidate).status, 'incomplete');
  normal(candidate).metrics['firestore.writes'] = q(0); normal(candidate).inventoryVerifiedAgainstEmulator = false;
  assert.equal(compare(baseline, candidate).status, 'incomplete');
});
test('workload and machine differences are rejected; explicit environment normalization remains visible', () => {
  const baseline = fixture(), candidate = fixture(); normal(candidate).inputs.count = 30;
  assert.equal(compare(baseline, candidate).status, 'incompatible');
  normal(candidate).inputs.count = 3; candidate.reference.machine.arch = 'another';
  assert.equal(compare(baseline, candidate).status, 'incompatible');
  const result = compare(baseline, candidate, { normalization: { reason: 'Counts compared under the same synthetic workload', allowMachineDifference: true } });
  assert.equal(result.status, 'passed'); assert.ok(result.normalization.machineDifference);
});
test('prices are normalized before comparison, and no saved monetary result is trusted', () => {
  const baseline = fixture(), candidate = fixture();
  for (const budget of candidate.budgets.scenarios) for (const variant of ['low', 'nominal', 'high']) {
    budget[variant].profile.rates.reads.price = '0.12'; budget[variant].projections[0].total = '999999';
  }
  const updated = globalThis.structuredClone(profile); updated.id = 'same-common-price'; updated.rates.reads.price = '0.09';
  const result = compare(baseline, candidate, { profile: updated });
  assert.equal(result.status, 'passed'); assert.equal(result.pricing.profile.id, updated.id);
  assert.equal(result.pricing.sourcePricesDiffer, true);
});
test('conditions and horizon must match or be normalized explicitly', () => {
  const baseline = fixture(), candidate = fixture(); candidate.budgets.assumptions.nominal.providerMs = 900;
  assert.equal(compare(baseline, candidate).status, 'incompatible');
  const result = compare(baseline, candidate, { conditions: baseline.budgets.assumptions, normalization: { reason: 'Common declared latency profile' } });
  assert.equal(result.status, 'passed'); assert.ok(result.normalization.conditions);
});
test('resource changes are priced and exposed without restoring the old CPU allocation', () => {
  const baseline = fixture(), candidate = fixture(); normal(candidate).registrations.find(r => r.name === 'apiData').cpu = 2;
  const result = compare(baseline, candidate);
  assert.equal(result.status, 'regression');
  assert.ok(result.scenarios[1].implementationChanges.some(row => row.path.includes('cpu') && row.after === 2));
  assert.ok(result.scenarios[1].money.some(row => row.path.includes('apiData-active-cpu') && row.state === 'increased'));
});
test('reviewed count allowances are precise and an unused selector fails', () => {
  const baseline = fixture(), candidate = fixture(); normal(candidate).metrics['new.calls'] = q(1);
  const policy = { format: 1, metrics: [{ scenario: 'normal', path: '/metrics/new.calls', unit: 'count', maxIncreaseAbsolute: '1', reason: 'One intentional extra operation' }] };
  assert.equal(compare(baseline, candidate, { policy }).status, 'passed');
  policy.metrics[0].path = '/metrics/typo';
  assert.equal(compare(baseline, candidate, { policy }).status, 'invalid_input');
});
test('absolute monetary caps are enforced with the selected currency and fixed cost included once', () => {
  const baseline = fixture(), candidate = fixture();
  const result = compare(baseline, candidate, { policy: { format: 1, money: [{ scenario: 'normal', path: '/nominal/1000/total', currency: 'USD', max: '0', reason: 'Deliberately failing cap' }] } });
  assert.equal(result.status, 'regression'); assert.ok(result.issues.some(issue => issue.code === 'limit_exceeded'));
});
test('local wall time and sampled RSS are descriptive unless a justified performance tolerance is supplied', () => {
  const baseline = fixture(), candidate = fixture(); normal(candidate).functions.apiData.metrics['functions.localDurationMs'] = q(20, 'millisecond');
  assert.equal(compare(baseline, candidate).status, 'passed');
  const policy = { format: 1, performance: [{ scenario: 'normal', path: '/functions/apiData/metrics/functions.localDurationMs', unit: 'millisecond', maxIncreasePercent: '10', minimumSamples: 1, machine: baseline.reference.machine, reason: 'Fixture timing tolerance, not a measured cloud allocation' }] };
  assert.equal(compare(baseline, candidate, { policy }).status, 'regression');
  policy.performance[0].minimumSamples = 2;
  assert.equal(compare(baseline, candidate, { policy }).status, 'incompatible');
});
test('stronger functional evidence may be added, but existing evidence cannot disappear', () => {
  const baseline = fixture(), candidate = fixture(); normal(candidate).functional.orderVerified = true;
  assert.equal(compare(baseline, candidate).status, 'passed');
  delete normal(candidate).functional.csvRows;
  assert.equal(compare(baseline, candidate).status, 'incomplete');
});
test('an observed counter replaced by an assumption loses coverage even if its value is unchanged', () => {
  const baseline = fixture(), candidate = fixture();
  normal(candidate).metrics['firestore.writes'] = { ...q(3), provenance: 'assumed', source: 'No longer measured' };
  assert.equal(compare(baseline, candidate).status, 'incomplete');
});
test('environment normalization requires a reason even when machine metadata itself is unchanged', () => {
  const baseline = fixture(), candidate = fixture(); normal(candidate).environment = 'different';
  assert.equal(compare(baseline, candidate, { normalization: { allowMachineDifference: true } }).status, 'invalid_input');
  candidate.reference.machine.arch = 'another';
  assert.equal(compare(baseline, candidate, { normalization: { allowMachineDifference: 'false', reason: 'Malformed boolean must not normalize' } }).status, 'invalid_input');
});
test('unknown tariffs, changed scopes, changed currency and unsupported resource locations cannot pass', () => {
  const baseline = fixture(), candidate = fixture();
  const missing = globalThis.structuredClone(profile); delete missing.rates.writes;
  assert.equal(compare(baseline, candidate, { profile: missing }).status, 'incomplete');
  candidate.budgets.scenarios[0].nominal.scope = 'Reduced runtime scope';
  assert.equal(compare(baseline, candidate).status, 'incompatible');
  candidate.budgets.scenarios[0].nominal.scope = baseline.budgets.scenarios[0].nominal.scope;
  candidate.budgets.scenarios[0].nominal.profile.currency = 'EUR';
  assert.equal(compare(baseline, candidate).status, 'incompatible');
  candidate.budgets.scenarios[0].nominal.profile.currency = 'USD';
  normal(candidate).registrations.find(r => r.name === 'apiData').location = 'us-east1';
  assert.equal(compare(baseline, candidate).status, 'incompatible');
});
test('a collection removed after independently verified cleanup is a measured zero, not lost inventory', () => {
  const baseline = fixture(), candidate = fixture(); delete normal(candidate).inventory.users;
  assert.equal(compare(baseline, candidate).status, 'passed');
});
test('scenario execution order is not a workload change', () => {
  const baseline = fixture();
  baseline.reference.scenarios.push({ ...globalThis.structuredClone(normal(baseline)), name: 'another' });
  baseline.budgets = referenceBudgets(baseline.reference, profile);
  const candidate = globalThis.structuredClone(baseline);
  candidate.reference.scenarios.reverse(); candidate.budgets.scenarios.reverse();
  assert.equal(compare(baseline, candidate).status, 'passed');
});
test('explicit zero evidence for a retired function prices zero without keeping its implementation registered', () => {
  const baseline = fixture(), candidate = fixture(), s = normal(candidate);
  s.registrations = s.registrations.filter(reg => reg.name !== 'apiData');
  for (const [name, input] of Object.entries(s.functions.apiData.metrics)) s.functions.apiData.metrics[name] = q(0, input.unit);
  s.functions.apiData.sampledRssMaxBytes = 0;
  s.metrics['functions.invocations'] = q(2); s.metrics['firestore.readUnits'] = q(3); s.metrics['firestore.readCalls'] = q(3); s.metrics['firestore.writes'] = q(0);
  assert.equal(compare(baseline, candidate).status, 'passed');
});
test('a fixed scheduled function may be retired with explicit zero measurements', () => {
  const baseline = fixture(), candidate = fixture();
  for (const s of candidate.reference.scenarios) {
    s.registrations = s.registrations.filter(reg => reg.name !== 'exports');
    for (const [name, input] of Object.entries(s.functions.exports.metrics)) s.functions.exports.metrics[name] = q(0, input.unit);
    s.functions.exports.sampledRssMaxBytes = 0;
    for (const name of ['functions.invocations','firestore.readUnits','firestore.readCalls']) s.metrics[name] = q(Number(s.metrics[name].value) - 1);
  }
  assert.equal(compare(baseline, candidate).status, 'passed');
});
test('a reviewed monetary allowance can cover an intentional CPU change without altering either capture', () => {
  const baseline = fixture(), candidate = fixture(); normal(candidate).registrations.find(reg => reg.name === 'apiData').cpu = 2;
  const before = JSON.stringify({ baseline, candidate });
  const result = compare(baseline, candidate, { policy: { format: 1, money: [{ scenario: 'normal', path: '*', currency: 'USD', maxIncreaseAbsolute: '1', reason: 'Explicit fixture allowance for the CPU change' }] } });
  assert.equal(result.status, 'passed'); assert.equal(JSON.stringify({ baseline, candidate }), before);
});
test('profile identity changes alone are not reported as a tariff change', () => {
  const baseline = fixture(), candidate = fixture();
  candidate.budgets.scenarios[0].nominal.profile.id = 'same-rates-new-name';
  const result = compare(baseline, candidate);
  assert.equal(result.status, 'passed'); assert.equal(result.pricing.sourcePricesDiffer, false);
});
test('external calibration is applied symmetrically and retains its source', () => {
  const baseline = fixture(), candidate = fixture();
  const calibration = { format: 1, id: 'read-latency', source: 'Controlled fixture', environment: 'fixture', recordedAt: '2026-11-13T01:00:00Z', parameters: {
    'nominal.firestoreReadMs': { ...q(40, 'millisecond'), provenance: 'external', source: 'file:fixture-latency.json' },
  } };
  const result = compare(baseline, candidate, { calibration });
  assert.equal(result.status, 'passed'); assert.equal(result.conditions.nominal.firestoreReadMs, 40);
  assert.equal(result.calibration.parameters['nominal.firestoreReadMs'].source, 'file:fixture-latency.json');
});
test('percentage limits include their exact boundary and reject a value above it', () => {
  const baseline = fixture(), candidate = fixture(); normal(baseline).metrics['client.checks'] = q(8); normal(candidate).metrics['client.checks'] = q(9);
  const policy = { format: 1, metrics: [{ scenario: 'normal', path: '/metrics/client.checks', unit: 'count', maxIncreasePercent: '12.5', reason: 'Known arithmetic boundary' }] };
  assert.equal(compare(baseline, candidate, { policy }).status, 'passed');
  normal(candidate).metrics['client.checks'] = q(10);
  assert.equal(compare(baseline, candidate, { policy }).status, 'regression');
});
test('common conditions cannot claim a location that the runtime cost model does not price', () => {
  const baseline = fixture(), conditions = globalThis.structuredClone(baseline.budgets.assumptions);
  conditions.placement.functions = 'europe-west1';
  assert.equal(compare(baseline, fixture(), { conditions, normalization: { reason: 'Unsupported location must fail' } }).status, 'incompatible');
});
