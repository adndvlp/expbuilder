import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compareReferences, renderComparison } from '../core/comparison.mjs';
import { fixture, profile, q } from './comparison-fixtures.mjs';
import { createScenarioClock } from '../persistence/clock.mjs';

const copy = value => globalThis.structuredClone(value);
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
// A declared fixture contract, independent of the implementation being tested.
function declared() {
  const bundle = fixture();
  for (const s of bundle.reference.scenarios) s.controlledInputs = { scenario: s.name, seed: 'test-seed', epoch: 1794528000000, responseMs: 125,
    participantEnvironment: { locale: 'en-US', timezoneId: 'UTC' }, timing: createScenarioClock().conditions() };
  seal(bundle);
  return bundle;
}
function seal(bundle) {
  const conditions = { fixture: { id: 'arithmetic-fixture/1', sources: { 'fixture.mjs': 'a'.repeat(64) } },
    scenarios: bundle.reference.scenarios.map(({ name, inputs, controlledInputs }) => ({ name, inputs: copy(inputs), controlledInputs: copy(controlledInputs) })).sort((a,b) => a.name.localeCompare(b.name)) };
  bundle.reference.repeatability = { version: 1, conditions, sha256: createHash('sha256').update(canonical({ version: 1, conditions })).digest('hex') };
}
const compare = (baseline, candidate, options = {}) => compareReferences({ baseline, candidate, ...options });
const normal = bundle => bundle.reference.scenarios[1];
const normalization = { allowMachineDifference: true, reason: 'Same declared synthetic inputs on another host' };

test('BR09: capture dates, revision, local durations and RSS stay visible without changing any priced quantity', () => {
  const baseline = declared(), candidate = copy(baseline);
  candidate.reference.createdAt = '2026-11-14T18:00:00Z'; candidate.reference.revision = 'changed-product';
  candidate.reference.measuredCode = { sha256: 'b'.repeat(64) }; candidate.reference.benchmarkRuntimeMs = 999999;
  normal(candidate).functions.apiData.sampledRssMaxBytes = 999999;
  normal(candidate).functions.apiData.metrics['functions.localDurationMs'] = q(999999, 'millisecond');
  const report = compare(baseline, candidate);
  assert.equal(report.exitCode, 0);
  assert.equal(report.captures.candidate.createdAt, candidate.reference.createdAt);
  assert.equal(report.captures.candidate.benchmarkRuntimeMs, 999999);
  assert.deepEqual(report.captures.candidate.repeatability, candidate.reference.repeatability);
  assert.ok(report.scenarios[1].metrics.some(row => row.kind === 'performance' && row.state === 'increased' && !row.gated));
  assert.ok(report.scenarios.every(s => s.quantities.length > 0 && [...s.quantities, ...s.money].every(row => row.delta === '0')));
  assert.deepEqual(report.equality, { measurements: true, storage: true, quantities: true, money: true, functional: true });
});
test('BR10: missing contracts are incompatible even on both sides or with machine normalization', () => {
  const baseline = declared(), candidate = declared(); delete candidate.reference.repeatability;
  const report = compare(baseline, candidate, { normalization });
  assert.equal(report.exitCode, 4); assert.ok(report.issues.some(i => i.path === '/repeatability' && i.capture === 'candidate'));
  delete baseline.reference.repeatability; assert.equal(compare(baseline, candidate).exitCode, 4);
});
for (const field of ['seed', 'epoch', 'responseMs', 'participantEnvironment', 'timing']) test('BR10: changed ' + field + ' cannot be normalized away', () => {
  const baseline = declared(), candidate = declared();
  const value = normal(candidate).controlledInputs[field];
  normal(candidate).controlledInputs[field] = typeof value === 'object' ? { ...value, changed: true } : typeof value === 'number' ? value + 1 : value + '-other';
  if (field === 'epoch') normal(candidate).controlledInputs.timing.epoch = normal(candidate).controlledInputs.epoch;
  seal(candidate);
  const report = compare(baseline, candidate, { normalization });
  assert.equal(report.exitCode, 4); assert.ok(report.issues.some(i => i.path.includes('/controlledInputs/' + field)));
});
test('BR10: conditions and their fingerprint must agree with the captured scenario, with concrete diagnostics', () => {
  const baseline = declared(), candidate = declared(); delete normal(candidate).controlledInputs;
  assert.equal(compare(baseline, candidate).exitCode, 4);
  const changed = declared(); changed.reference.repeatability.sha256 = '0'.repeat(64);
  const result = compare(baseline, changed); assert.equal(result.exitCode, 4);
  assert.ok(result.issues.some(i => i.path === '/repeatability/sha256'));
  assert.match(renderComparison(result), /repeatability\/sha256/);
});
test('BR11: an extra read changes consumption and cost while keeping the same contract', () => {
  const baseline = declared(), candidate = declared(); normal(candidate).metrics['firestore.readUnits'] = q(9);
  const report = compare(baseline, candidate); assert.equal(report.exitCode, 2);
  assert.equal(candidate.reference.repeatability.sha256, baseline.reference.repeatability.sha256);
  assert.ok(report.scenarios[1].quantities.some(row => row.path.includes('firestore-readUnits') && row.state === 'increased'));
  assert.ok(report.scenarios[1].money.some(row => row.state === 'increased'));
});
test('BR11: extra transmitted bytes remain a regression even when their declared tariff is zero', () => {
  const baseline = declared(), candidate = declared(); normal(baseline).metrics['http.responseContentBytes'] = q(100, 'byte');
  normal(candidate).metrics['http.responseContentBytes'] = q(101, 'byte');
  const zero = copy(profile); delete zero.rates['internet-egress'].tiers;
  zero.rates['internet-egress'].price = '0'; zero.rates['internet-egress'].zeroReason = 'Deliberate zero-tariff test';
  const report = compare(baseline, candidate, { profile: zero }); assert.equal(report.exitCode, 2);
  assert.ok(report.scenarios[1].money.every(row => row.delta === '0'));
  const row = report.scenarios[1].quantities.find(row => row.path === '/nominal/quantities/per-session-internet');
  assert.equal(row.state, 'increased'); assert.equal(row.gated, true); assert.equal(row.unit, 'byte');
});
test('BR11: deleting the same bytes a second later increases integrated storage without changing final inventory', () => {
  const baseline = declared(), candidate = declared();
  normal(baseline).storageTimeline = [{atSeconds: 0, bytes: 100}, {atSeconds: 2, bytes: 0}];
  normal(candidate).storageTimeline = [{atSeconds: 0, bytes: 100}, {atSeconds: 3, bytes: 0}];
  const report = compare(baseline, candidate); assert.equal(report.exitCode, 2);
  assert.ok(report.scenarios[1].quantities.some(row => row.path.includes('session-firestore-storage') && row.state === 'increased'));
  assert.ok(report.scenarios[1].money.some(row => row.path.includes('session-firestore-storage') && row.state === 'increased'));
});
test('BR12: absent measurements on both sides and missing storage evidence never become free usage', () => {
  const baseline = declared(), candidate = declared();
  delete normal(baseline).metrics['firestore.readUnits']; delete normal(candidate).metrics['firestore.readUnits'];
  assert.equal(compare(baseline, candidate).exitCode, 3);
  const noStorage = declared(); delete normal(noStorage).storageTimeline;
  assert.equal(compare(declared(), noStorage).exitCode, 3);
});
test('BR12: missing metrics or failed CSV block a cheaper candidate', () => {
  const baseline = declared(), candidate = declared(); delete normal(candidate).metrics['firestore.writes'];
  assert.equal(compare(baseline, candidate).exitCode, 3);
  normal(candidate).metrics['firestore.writes'] = q(0); normal(candidate).functional.passed = false;
  assert.equal(compare(baseline, candidate).exitCode, 5);
});
test('BR12: every applicable pricing dependency needs measured evidence, including explicit zero', () => {
  for (const metric of ['firestore.indexReadUnits','firestore.writes','firestore.deletes','firestore.transactionAttempts','firestore.batchAttempts','firestore.directWriteCalls',
    'tasks.billableUnits','events.published','events.publishedPayloadBytes','events.deliveredPayloadBytes','rtdb.downloadBytes','rtdb.disconnectRegistrations','rtdb.readCalls','rtdb.writeAttempts',
    'http.requests','http.responseContentBytes','provider.googledrive.requests','provider.googledrive.requestContentBytes']) {
    const baseline=declared(),candidate=declared();
    delete normal(baseline).metrics[metric]; delete normal(candidate).metrics[metric];
    const report=compare(baseline,candidate); assert.equal(report.exitCode,3,metric);
    assert.ok(report.issues.some(i=>i.path==='/metrics/'+metric),metric);
  }
});
test('the equality projection covers every raw cost item and every volume in every budget variant', () => {
  const bundle = declared(), report = compare(bundle, bundle);
  for (const s of report.scenarios) {
    const budgets = s.name === 'idle' ? bundle.budgets.idle.map(b => ['/idle-' + b.windowSeconds,b])
      : ['low','nominal','high'].map(v => ['/' + v,bundle.budgets.scenarios[0][v]]);
    for (const [prefix,budget] of budgets) for (const item of budget.items) {
      assert.ok(s.quantities.some(row => row.path === prefix + '/quantities/' + item.id), item.id);
      for (const projection of budget.projections) assert.ok(s.quantities.some(row => row.path === `${prefix}/${projection.sessions}/quantities/${item.id}`), item.id);
    }
  }
});
test('equal totals cannot hide a different storage timeline from the repetition equality check', () => {
  const baseline=declared(),candidate=declared();
  normal(baseline).storageTimeline=[{atSeconds:0,bytes:100},{atSeconds:2,bytes:0}];
  normal(candidate).storageTimeline=[{atSeconds:0,bytes:200},{atSeconds:1,bytes:0}];
  const report=compare(baseline,candidate); assert.equal(report.exitCode,0);
  assert.equal(report.equality.quantities,true); assert.equal(report.equality.money,true); assert.equal(report.equality.storage,false);
  assert.deepEqual(report.scenarios[1].storage.candidate.timeline,normal(candidate).storageTimeline);
  assert.equal(compare(declared(),{reference:{...candidate.reference,repeatability:undefined},budgets:candidate.budgets}).equality,null);
});
