import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { readCapture } from '../core/artifacts.mjs';
import { compareReferences } from '../core/comparison.mjs';
import { fixture, q, sealFixture } from './comparison-fixtures.mjs';
import { validateTemporalStoragePolicy } from '../core/temporal-storage-policy.mjs';

const copy = value => globalThis.structuredClone(value);
const canonical = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fingerprint = value => hash(canonical(value));
function repack(capture) {
  // A loaded capture contains JSON values, including omission of undefined model inputs.
  capture.bundle = JSON.parse(JSON.stringify(capture.bundle));
  capture.files = { 'reference.json': Buffer.from(JSON.stringify(capture.bundle.reference)),
    'budget.json': Buffer.from(JSON.stringify(capture.bundle.budgets)) };
  return capture;
}
function inputs() {
  const bundle = fixture();
  const method = { id: 'storage-arithmetic/1', sources: { 'storage-fixture.mjs': 'a'.repeat(64) }, sdk: { name: 'fixture', version: '1' } };
  method.sha256 = fingerprint(method);
  const config = { indexes: [], fieldOverrides: [] };
  for (const scenario of bundle.reference.scenarios) scenario.storageModel = { method,
    indexConfiguration: { value: config, sha256: fingerprint(config) } };
  bundle.reference.measuredCode = { sha256: 'b'.repeat(64) };
  const baseline = repack({ bundle }), candidate = copy(baseline);
  const profile = bundle.budgets.scenarios[0].nominal.profile;
  const policy = { format: 1, metrics: [], money: [], performance: [], temporalStorage: {
    component: 'session-firestore-storage', unit: 'byte-second',
    scope: {
      baseline: { id: 'arithmetic-b0', referenceSha256: hash(baseline.files['reference.json']),
        budgetSha256: hash(baseline.files['budget.json']), measuredCodeSha256: bundle.reference.measuredCode.sha256 },
      conditionsSha256: bundle.reference.repeatability.sha256,
      assumptionsSha256: fingerprint(bundle.budgets.assumptions),
      storageMethod: { id: method.id, sha256: method.sha256 }, indexConfigurationSha256: fingerprint(config),
      profile: { id: profile.id, sha256: fingerprint(profile), currency: profile.currency, basis: profile.basis },
      windowSeconds: 2592000, billingPeriodSeconds: 2592000,
      variants: ['low', 'nominal', 'high'], volumes: [1, 1000, 10000],
    },
    review: { reason: 'Known arithmetic review: 80 bytes for 0.25 additional seconds.',
      specification: 'arithmetic-spec/section-18', evidence: { file: 'review.json', sha256: 'c'.repeat(64),
        candidateReferenceSha256: 'd'.repeat(64), candidateMeasuredCodeSha256: 'e'.repeat(64) } },
    limits: [{ scenario: 'normal', maxIncreaseByteSeconds: '20', reason: 'Reviewed 20 byte-second limit.' }],
  } };
  return { policy, baseline, candidate };
}
const invalid = { status: 'invalid_input', exitCode: 6 };
const incompatible = { status: 'incompatible', exitCode: 4 };
const validate = data => validateTemporalStoragePolicy(data.policy, { baseline: data.baseline, candidate: data.candidate, ...data.options });

test('CO16: validates a reviewed declaration without evaluating or mutating measurements', () => {
  const data = inputs(), before = copy(data);
  const result = validate(data);
  assert.deepEqual(result, data.policy); assert.notEqual(result, data.policy);
  assert.deepEqual(copy(data), before);
  result.temporalStorage.limits[0].maxIncreaseByteSeconds = '999';
  assert.equal(data.policy.temporalStorage.limits[0].maxIncreaseByteSeconds, '20');
});

for (const [name, change] of [
  ['missing declaration', p => { delete p.temporalStorage; }],
  ['unknown top-level option', p => { p.epsilon = 1; }],
  ['generic money allowance', p => { p.money = [{ scenario: '*', path: '*', currency: 'USD', maxIncreaseAbsolute: '1', reason: 'Broad' }]; }],
  ['generic metric allowance', p => { p.metrics = [{}]; }],
  ['generic performance allowance', p => { p.performance = [{}]; }],
  ['wrong component', p => { p.temporalStorage.component = 'session-rtdb-storage'; }],
  ['wrong unit', p => { p.temporalStorage.unit = 'USD'; }],
  ['empty limits', p => { p.temporalStorage.limits = []; }],
  ['duplicate scenario', p => { p.temporalStorage.limits.push(copy(p.temporalStorage.limits[0])); }],
  ['wildcard', p => { p.temporalStorage.limits[0].scenario = '*'; }],
  ['unknown scenario', p => { p.temporalStorage.limits[0].scenario = 'not-recorded'; }],
  ['idle allowance', p => { p.temporalStorage.limits[0].scenario = 'idle'; }],
  ['missing reason', p => { p.temporalStorage.limits[0].reason = ' '; }],
  ['missing review', p => { delete p.temporalStorage.review; }],
  ['missing evidence identity', p => { delete p.temporalStorage.review.evidence.sha256; }],
  ['extra rule field', p => { p.temporalStorage.limits[0].maxIncreasePercent = '1'; }],
  ['invalid baseline digest', p => { p.temporalStorage.scope.baseline.referenceSha256 = 'no-hash'; }],
  ['duplicate volumes', p => { p.temporalStorage.scope.volumes = [1, 1]; }],
  ['missing variant', p => { p.temporalStorage.scope.variants = ['nominal']; }],
]) test('CO16: rejects ' + name, () => {
  const data = inputs(); change(data.policy);
  assert.throws(() => validate(data), invalid);
});

for (const value of ['-1', 'NaN', 'Infinity', '20x', '1e3', ' 20', null, 20]) test('CO16: rejects an inexact or invalid cap ' + JSON.stringify(value), () => {
  const data = inputs(); data.policy.temporalStorage.limits[0].maxIncreaseByteSeconds = value;
  assert.throws(() => validate(data), invalid);
});

for (const [name, change] of [
  ['baseline reference', d => { d.baseline.files['reference.json'] = Buffer.concat([d.baseline.files['reference.json'], Buffer.from(' ')]); }],
  ['baseline budget', d => { d.baseline.files['budget.json'] = Buffer.concat([d.baseline.files['budget.json'], Buffer.from(' ')]); }],
  ['baseline code', d => { d.policy.temporalStorage.scope.baseline.measuredCodeSha256 = 'f'.repeat(64); }],
  ['workload digest', d => { d.candidate.bundle.reference.repeatability.sha256 = 'f'.repeat(64); repack(d.candidate); }],
  ['changed workload', d => { d.candidate.bundle.reference.scenarios[1].inputs.count++; sealFixture(d.candidate.bundle.reference); repack(d.candidate); }],
  ['storage method', d => { d.candidate.bundle.reference.scenarios[1].storageModel.method.id = 'changed'; repack(d.candidate); }],
  ['index configuration', d => { d.candidate.bundle.reference.scenarios[1].storageModel.indexConfiguration.value.fieldOverrides.push({ collectionGroup: 'tasks', fieldPath: '*', indexes: [] }); repack(d.candidate); }],
  ['assumptions', d => { d.candidate.bundle.budgets.assumptions.nominal.baseMs++; repack(d.candidate); }],
  ['high price variant', d => { d.candidate.bundle.budgets.scenarios[0].high.profile.rates.reads.price = '999'; repack(d.candidate); }],
  ['currency', d => { d.candidate.bundle.budgets.scenarios[0].nominal.profile.currency = 'EUR'; repack(d.candidate); }],
  ['horizon', d => { d.candidate.bundle.budgets.scenarios[0].nominal.windowSeconds++; repack(d.candidate); }],
  ['billing period', d => { d.candidate.bundle.budgets.scenarios[0].nominal.items.find(i => i.id === 'session-firestore-storage').quantity.inputs[0].billingPeriodSeconds++; repack(d.candidate); }],
  ['projection', d => { d.candidate.bundle.budgets.scenarios[0].low.projections[0].sessions = 2; repack(d.candidate); }],
  ['effective price override', d => { d.options = { profile: copy(d.baseline.bundle.budgets.scenarios[0].nominal.profile) }; d.options.profile.rates.reads.price = '999'; }],
  ['effective conditions override', d => { d.options = { conditions: copy(d.baseline.bundle.budgets.assumptions) }; d.options.conditions.nominal.baseMs++; }],
  ['effective horizon override', d => { d.options = { windowSeconds: 86400 }; }],
  ['effective volumes override', d => { d.options = { volumes: [1] }; }],
]) test('CO16: rejects a different ' + name, () => {
  const data = inputs(); change(data);
  assert.throws(() => validate(data), incompatible);
});

test('CO16: an inconsistent decoded capture cannot claim its original file identity', () => {
  const data = inputs(); data.baseline.bundle.reference.revision = 'tampered';
  assert.throws(() => validate(data), invalid);
});

test('CO16: candidate code and machine are descriptive, not an everlasting candidate lock', () => {
  const data = inputs(); data.candidate.bundle.reference.measuredCode.sha256 = 'f'.repeat(64);
  data.candidate.bundle.reference.machine.platform = 'another-host'; repack(data.candidate);
  assert.deepEqual(validate(data), data.policy);
});

test('CO16: a very small decimal cap stays exact', () => {
  const data = inputs(); const cap = '0.' + '0'.repeat(60) + '1';
  data.policy.temporalStorage.limits[0].maxIncreaseByteSeconds = cap;
  assert.equal(validate(data).temporalStorage.limits[0].maxIncreaseByteSeconds, cap);
});

test('declaring and validating limits cannot authorize an extra operation in the existing evaluator', () => {
  const data = inputs(); validate(data);
  data.candidate.bundle.reference.scenarios[1].metrics['firestore.readUnits'] = q(9);
  const options = { baseline: data.baseline.bundle, candidate: data.candidate.bundle };
  assert.equal(compareReferences(options).exitCode, 2);
  assert.notEqual(compareReferences({ ...options, policy: data.policy }).exitCode, 0);
});

test('the committed manifest preserves exactly the 21 reviewed caps and binds to real B0 R3', async () => {
  const file = new URL('../policies/persistence-temporal-storage.json', import.meta.url);
  const policy = JSON.parse(await readFile(file));
  const baseline = await readCapture(fileURLToPath(new URL('../references/persistence-b0-2026-11-14-r3/', import.meta.url)));
  assert.deepEqual(validateTemporalStoragePolicy(policy, { baseline, candidate: baseline }), policy);
  const expected = {
    'normal-true-0': '22134.705', 'normal-true-1': '22134.705', 'normal-true-3': '22134.705',
    'normal-false-0': '22134.705', 'normal-false-1': '22134.705', 'normal-false-3': '22134.705',
    'volume-3': '21560.535', 'volume-30': '20077.625', 'visual-true': '17742.485', 'visual-false': '17742.485',
    'resume-true': '43269.405', 'resume-false': '43269.405', 'expiry-true-0': '15552.935', 'expiry-true-3': '15552.935',
    'expiry-false-1': '17139.75', 'lost-ack-true': '22134.705', 'lost-ack-false': '22134.705', 'enqueue-failure': '26130.435',
    'provider-lost-googledrive': '17284.165', 'provider-lost-dropbox': '16145.71', 'provider-lost-osf': '21699.75',
  };
  assert.deepEqual(Object.fromEntries(policy.temporalStorage.limits.map(r => [r.scenario, r.maxIncreaseByteSeconds])), expected);
  const review = policy.temporalStorage.review;
  const evidenceBytes = await readFile(new URL('../../' + review.evidence.file, import.meta.url));
  const evidence = JSON.parse(evidenceBytes);
  assert.equal(review.evidence.sha256, hash(evidenceBytes));
  const origin = evidence.runs.find(run => run.source.files['reference.json'].sha256 === review.evidence.candidateReferenceSha256);
  assert.ok(origin, 'The reviewed candidate must be one of the verified captures');
  assert.equal(review.evidence.candidateMeasuredCodeSha256, origin.measuredCode.sha256);
  assert.equal(policy.temporalStorage.scope.conditionsSha256, origin.conditions);
  assert.equal(policy.temporalStorage.scope.baseline.referenceSha256, '1019b62878d9438f59ce04f2e0dfceecbcab5265382d13ec6dee89217f58d0a0');
  assert.deepEqual(JSON.parse(await readFile(new URL('../policies/no-increases.json', import.meta.url))), { format: 1, metrics: [], money: [], performance: [] });
});
