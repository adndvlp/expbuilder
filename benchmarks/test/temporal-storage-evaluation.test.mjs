import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { compareReferences, renderComparison } from '../core/comparison.mjs';
import { q } from './comparison-fixtures.mjs';
import { temporalFixture, comparisonInput, copy, inventoryFields, normal, repack } from './temporal-storage-fixtures.mjs';

const run = data => compareReferences(comparisonInput(data));
const scenario = report => report.scenarios.find(s => s.name === 'normal');
const issues = report => JSON.stringify(report.issues);
const fractionEquals = (actual, numerator, denominator) => assert.equal(BigInt(actual.numerator) * denominator, numerator * BigInt(actual.denominator));

test('CO17/CO19: exactly 80 bytes for 0.25 extra seconds authorizes only the 21 storage rows, preserving measurements', () => {
  const data = temporalFixture(), before = copy(data);
  const strict = compareReferences({ baseline: data.baseline.bundle, candidate: data.candidate.bundle });
  assert.equal(strict.exitCode, 2);
  const report = run(data);
  assert.equal(report.exitCode, 0, issues(report));
  assert.deepEqual(copy(data), before);
  const s = scenario(report), review = s.temporalStorage;
  assert.equal(review.baselineByteSeconds, '160'); assert.equal(review.candidateByteSeconds, '180');
  assert.equal(review.increaseByteSeconds, '20'); assert.equal(review.maxIncreaseByteSeconds, '20');
  assert.equal(review.authorized, true);
  assert.equal(review.reason, data.policy.temporalStorage.limits[0].reason);
  assert.deepEqual(review.review, data.policy.temporalStorage.review);
  const rows = [...s.quantities, ...s.money].filter(r => r.temporalStorage);
  assert.equal(rows.length, 21);
  for (const row of rows) {
    assert.equal(row.state, 'increased'); assert.equal(row.gated, true); assert.equal(row.temporalStorage.authorized, true);
    assert.match(row.path, /(?:quantities|items)\/session-firestore-storage$/);
  }
  for (const variant of ['low', 'nominal', 'high']) {
    const raw = s.quantities.find(r => r.path === '/' + variant + '/quantities/session-firestore-storage');
    // 20 / (2^30 * 2,592,000) = 1 / 139,156,940,390,400 GiB-month.
    fractionEquals(raw.allowedIncreaseExact, 1n, 139156940390400n);
    for (const volume of [1, 1000, 10000]) {
      const quantity = s.quantities.find(r => r.path === `/${variant}/${volume}/quantities/session-firestore-storage`);
      const money = s.money.find(r => r.path === `/${variant}/${volume}/items/session-firestore-storage`);
      fractionEquals(quantity.allowedIncreaseExact, BigInt(volume), 139156940390400n);
      // Frozen storage tariff: 0.18 USD/GiB-month, applied once.
      fractionEquals(money.allowedIncreaseExact, BigInt(volume), 773094113280000n);
      assert.ok(s.money.some(r => r.path === `/${variant}/${volume}/fixed` && r.state === 'decreased'));
      assert.ok(s.money.some(r => r.path === `/${variant}/${volume}/variable` && r.state === 'decreased'));
    }
  }
  assert.equal(report.equality.storage, false); assert.equal(report.equality.quantities, false); assert.equal(report.equality.money, false);
  const md = renderComparison(report);
  assert.match(md, /Almacenamiento temporal revisado/); assert.match(md, /byte-segundos/);
  assert.match(md, /normal/); assert.match(md, /arithmetic-review.json/); assert.match(md, /arithmetic-b0/);
  assert.match(md, /GiB-month/); assert.match(md, /USD/); assert.match(md, /increased/);
});

for (const [end, expected] of [['2.125', 0], ['2.2500125', 2]]) test('CO17: the physical bound is exact at ' + end + ' seconds', () => {
  const report = run(temporalFixture({ end }));
  assert.equal(report.exitCode, expected, issues(report));
  if (expected) assert.ok(report.issues.some(i => i.code === 'temporal_storage_limit'));
});
test('CO17: a cap below the boundary at precision beyond displayed USD still rejects it', () => {
  const report = run(temporalFixture({ cap: '19.99999999999999999999999999999999999999999999999999' }));
  assert.equal(report.exitCode, 2); assert.ok(report.issues.some(i => i.code === 'temporal_storage_limit'));
});
for (const metric of ['firestore.readUnits', 'firestore.writes', 'firestore.deletes', 'tasks.billableUnits', 'functions.invocations']) test('CO18: an extra ' + metric + ' stays strict', () => {
  const data = temporalFixture();
  normal(data.candidate).metrics[metric] = q(Number(normal(data.baseline).metrics[metric].value) + 1);
  repack(data.candidate);
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.path === '/metrics/' + metric));
  assert.equal(scenario(report).temporalStorage.authorized, false);
});
test('CO18: a per-handler read cannot be offset by fewer reads elsewhere', () => {
  const data = temporalFixture();
  normal(data.candidate).functions.apiData.metrics['firestore.readUnits'] = q(6);
  normal(data.candidate).metrics['firestore.readUnits'] = q(9); repack(data.candidate);
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.path === '/functions/apiData/metrics/firestore.readUnits'));
});
for (const field of inventoryFields) test('CO18: one additional final inventory ' + field + ' cannot use the temporal allowance', () => {
  const data = temporalFixture({ end: '2.125' });
  normal(data.candidate).inventory.trials[field] = 1;
  normal(data.candidate).storageTimeline.push({ atSeconds: '2591999.999', bytes: 1 }); repack(data.candidate);
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.path === '/inventory/trials/' + field));
  assert.equal(scenario(report).metrics.find(r => r.path === '/inventory/trials/' + field).gated, true);
  assert.equal(scenario(report).temporalStorage.authorized, false);
});
for (const field of inventoryFields) test('CO18: missing ' + field + ' on both sides is missing coverage, not zero', () => {
  const data = temporalFixture({ editBaseline: bundle => { for (const s of bundle.reference.scenarios) delete s.inventory.users[field]; } });
  const report = run(data); assert.equal(report.exitCode, 3, issues(report));
  assert.ok(report.issues.some(i => i.code === 'temporal_inventory_missing' && i.path === '/inventory/users/' + field));
});
test('CO18: one retained RTDB byte stays strict with its tariff set to zero', () => {
  const data = temporalFixture({ editProfile: prices => { prices.rates['rtdb-storage'].price = '0'; prices.rates['rtdb-storage'].zeroReason = 'Deliberate zero-tariff test'; } });
  normal(data.candidate).retainedRtdbJsonBytes++; repack(data.candidate);
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.path === '/retainedRtdbJsonBytes'));
});
test('CO18: a collection decrease cannot offset a byte in another collection', () => {
  const data = temporalFixture({ end: '2.125' });
  normal(data.candidate).inventory.users.documentBytes--;
  normal(data.candidate).inventory.trials.documentBytes++; repack(data.candidate);
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.path === '/inventory/trials/documentBytes'));
});
test('CO19: a zero Firestore price cannot hide an excess of 0.001 byte-seconds', () => {
  const data = temporalFixture({ end: '2.2500125', editProfile: prices => { prices.rates['firestore-storage'].price = '0'; prices.rates['firestore-storage'].zeroReason = 'Deliberate zero-tariff test'; } });
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.code === 'temporal_storage_limit'));
  assert.ok(scenario(report).money.filter(r => r.path.endsWith('/items/session-firestore-storage')).every(r => r.delta === '0'));
});
test('CO19: storage unit conversion, volume and units-per-price are applied exactly once', () => {
  const data = temporalFixture({ editProfile: prices => { prices.rates['firestore-storage'].unit = 'GB-month'; prices.rates['firestore-storage'].per = '1000'; } });
  const report = run(data); assert.equal(report.exitCode, 0, issues(report));
  for (const variant of ['low', 'nominal', 'high']) for (const volume of [1, 1000, 10000]) {
    const quantities = scenario(report).quantities.find(r => r.path === `/${variant}/${volume}/quantities/session-firestore-storage`);
    const money = scenario(report).money.find(r => r.path === `/${variant}/${volume}/items/session-firestore-storage`);
    fractionEquals(quantities.allowedIncreaseExact, 20n * BigInt(volume), 1000000000n * 2592000n);
    fractionEquals(money.allowedIncreaseExact, 20n * BigInt(volume) * 18n, 1000000000n * 2592000n * 1000n * 100n);
  }
});
test('CO19: another scenario cannot inherit the reviewed scenario limit', () => {
  const data = temporalFixture({ editBaseline: bundle => {
    const extra = copy(bundle.reference.scenarios[1]); extra.name = 'uncapped'; extra.controlledInputs.scenario = 'uncapped'; bundle.reference.scenarios.push(extra);
  } });
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.scenario === 'uncapped' && i.path.endsWith('/session-firestore-storage')));
  assert.equal(scenario(report).temporalStorage.authorized, false);
});
test('CO20: equal fixed cost blocks an allowance even when variable and total decrease', () => {
  const data = temporalFixture();
  for (const s of data.candidate.bundle.reference.scenarios) {
    s.functions.timeout = copy(data.baseline.bundle.reference.scenarios[0].functions.timeout);
    s.metrics['functions.invocations'] = q(s.name === 'idle' ? 3 : 4);
    s.metrics['firestore.readUnits'] = q(s.name === 'idle' ? 5 : 9); s.metrics['firestore.readCalls'] = s.metrics['firestore.readUnits'];
  }
  repack(data.candidate);
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.code === 'temporal_storage_savings' && i.path.endsWith('/fixed')));
  assert.ok(report.issues.some(i => i.scenario === 'idle' && i.code === 'temporal_storage_savings'));
});
test('CO20: equal variable cost blocks an allowance even when fixed and total decrease', () => {
  const data = temporalFixture({ editProfile: prices => { prices.rates['firestore-storage'].price = '0'; prices.rates['firestore-storage'].zeroReason = 'Expose exactly equal variable cost'; } });
  normal(data.candidate).functions.apiData = copy(normal(data.baseline).functions.apiData);
  normal(data.candidate).metrics['firestore.readUnits'] = q(8); normal(data.candidate).metrics['firestore.readCalls'] = q(8); repack(data.candidate);
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.code === 'temporal_storage_savings' && i.path.endsWith('/variable')));
});
for (const [name, mutate, code] of [
  ['coverage issue', s => { s.coverageIssues.push('missing observation'); }, 3],
  ['unverified inventory', s => { s.inventoryVerifiedAgainstEmulator = false; }, 3],
  ['pending task', s => { s.pending.tasks = 1; }, 3],
  ['unknown count', s => { s.metrics['firestore.writes'] = q(null); }, 3],
  ['missing count', s => { delete s.metrics['firestore.writes']; }, 3],
  ['failed CSV', s => { s.functional.passed = false; }, 5],
  ['different CSV', s => { s.functional.csvRows = 2; }, 5],
]) test('CO20: ' + name + ' never becomes an approved saving', () => {
  const data = temporalFixture(); mutate(normal(data.candidate)); repack(data.candidate);
  assert.equal(run(data).exitCode, code);
});
test('CO21: the same measured code cannot use this policy to approve a changed repetition', () => {
  const data = temporalFixture(); data.candidate.bundle.reference.measuredCode = copy(data.baseline.bundle.reference.measuredCode); repack(data.candidate);
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.code === 'temporal_storage_repetition'));
  const strict = compareReferences({ baseline: data.baseline.bundle, candidate: data.candidate.bundle });
  assert.equal(strict.exitCode, 2); assert.equal(strict.equality.storage, false); assert.equal(strict.equality.money, false);
});
test('CO21: a cheaper repetition still fails exact equality under the reviewed policy', () => {
  const data = temporalFixture({ end: '1.75' });
  data.candidate.bundle.reference.measuredCode = copy(data.baseline.bundle.reference.measuredCode); repack(data.candidate);
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.code === 'temporal_storage_repetition'));
  assert.equal(report.equality.storage, false); assert.equal(report.equality.money, false);
});
for (const [part, change] of [
  ['fixed', bundle => { for (const s of bundle.reference.scenarios) s.registrations.find(r => r.name === 'exports').cpu = 8; }],
  ['variable', bundle => { bundle.reference.scenarios[1].registrations.find(r => r.name === 'apiData').cpu = 8; }],
]) test('CO20: a larger ' + part + ' subtotal cannot be offset by the other subtotal', () => {
  const report = run(temporalFixture({ editCandidate: change }));
  assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.code === 'temporal_storage_savings' && i.path.endsWith('/' + part)));
});
test('CO19: an allowed physical increase stays visible even when its price is zero', () => {
  const report = run(temporalFixture({ editProfile: prices => { prices.rates['firestore-storage'].price = '0'; prices.rates['firestore-storage'].zeroReason = 'Deliberate zero-tariff test'; } }));
  assert.equal(report.exitCode, 0, issues(report)); assert.equal(scenario(report).temporalStorage.authorized, true);
  assert.ok(scenario(report).quantities.filter(r => r.path.endsWith('/session-firestore-storage')).every(r => r.state === 'increased'));
  assert.ok(scenario(report).money.filter(r => r.path.endsWith('/items/session-firestore-storage')).every(r => r.state === 'unchanged'));
});
test('CO19: transmitted bytes cannot receive an allowance even at a zero tariff', () => {
  const data = temporalFixture({ editProfile: prices => {
    delete prices.rates['internet-egress'].tiers;
    prices.rates['internet-egress'].price = '0'; prices.rates['internet-egress'].zeroReason = 'Deliberate zero-tariff test';
  } });
  normal(data.candidate).metrics['http.responseContentBytes'] = q(1, 'byte'); repack(data.candidate);
  const report = run(data); assert.equal(report.exitCode, 2, issues(report));
  assert.ok(report.issues.some(i => i.path.includes('/quantities/per-session-internet')));
});
test('CO16 integration: original bytes are required and effective calibration cannot bypass scope', () => {
  const data = temporalFixture(), input = comparisonInput(data); delete input.captureFiles;
  assert.equal(compareReferences(input).exitCode, 6);
  const conditions = copy(data.baseline.bundle.budgets.assumptions); conditions.nominal.baseMs++;
  const report = compareReferences({ ...comparisonInput(data), conditions, normalization: { reason: 'Cannot extend a frozen review' } });
  assert.equal(report.exitCode, 4, issues(report));
});
test('CO16 integration: malformed policy overlaps remain invalid even when candidate cost falls', () => {
  const data = temporalFixture(); data.policy.money = [{ scenario: '*', path: '*', currency: 'USD', maxIncreaseAbsolute: '100', reason: 'Forbidden overlap' }];
  assert.equal(run(data).exitCode, 6);
});
test('CLI explicitly selected policy uses original files and records evaluation source and reviewed increases', async () => {
  const data = temporalFixture(), directory = await mkdtemp(path.join(tmpdir(), 'temporal-evaluation-'));
  try {
    for (const name of ['baseline', 'candidate']) {
      await mkdir(path.join(directory, name));
      for (const [file, bytes] of Object.entries(data[name].files)) await writeFile(path.join(directory, name, file), bytes);
    }
    await writeFile(path.join(directory, 'policy.json'), JSON.stringify(data.policy));
    const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url)), output = path.join(directory, 'result');
    const executed = spawnSync(process.execPath, [cli, 'compare', '--baseline', path.join(directory, 'baseline'), '--candidate', path.join(directory, 'candidate'), '--policy', path.join(directory, 'policy.json'), '--output', output], { encoding: 'utf8', timeout: 30000 });
    assert.equal(executed.status, 0, executed.stderr + executed.stdout);
    const report = JSON.parse(await readFile(path.join(output, 'comparison.json')));
    assert.equal(scenario(report).temporalStorage.authorized, true);
    assert.ok(report.sources.policy.sha256);
    assert.ok(report.sources.calculation.files['core/temporal-storage-policy.mjs'].sha256);
    assert.ok(report.sources.calculation.files['core/temporal-storage-evaluation.mjs'].sha256);
    assert.match(await readFile(path.join(output, 'README.md'), 'utf8'), /Almacenamiento temporal revisado/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
