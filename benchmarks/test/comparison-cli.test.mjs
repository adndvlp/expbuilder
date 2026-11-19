import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { fixture, q } from './comparison-fixtures.mjs';
const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
async function captured(directory, bundle) {
  const { mkdir } = await import('node:fs/promises'); await mkdir(directory);
  await writeFile(path.join(directory, 'reference.json'), JSON.stringify(bundle.reference));
  await writeFile(path.join(directory, 'budget.json'), JSON.stringify(bundle.budgets));
}
const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 30000 });
test('CLI help works through the npm subcommand form without requiring input or output files', () => {
  const result = run(['compare', '--help']); assert.equal(result.status, 0); assert.match(result.stdout, /--baseline/);
});
async function isolated(runTest) {
  const directory = await mkdtemp(path.join(tmpdir(), 'cost-comparison-test-'));
  try { await runTest(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
test('CLI compares captured files without network, writes JSON/Markdown and does not change its inputs', () => isolated(async directory => {
  const baseline = path.join(directory, 'baseline'), candidate = path.join(directory, 'candidate'), output = path.join(directory, 'comparison');
  await captured(baseline, fixture()); await captured(candidate, fixture());
  const bytes = await readFile(path.join(baseline, 'reference.json'));
  const result = run(['compare', '--baseline', baseline, '--candidate', candidate, '--output', output]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(await readFile(path.join(output, 'comparison.json'))).status, 'passed');
  assert.match(await readFile(path.join(output, 'README.md'), 'utf8'), /Comparación/);
  assert.deepEqual(await readFile(path.join(baseline, 'reference.json')), bytes);
}));
test('CLI preserves failing comparison artifacts and returns the regression exit code', () => isolated(async directory => {
  const baseline = path.join(directory, 'baseline'), candidate = path.join(directory, 'candidate'), output = path.join(directory, 'comparison');
  const changed = fixture(); changed.reference.scenarios[1].metrics['firestore.readUnits'] = q(9);
  await captured(baseline, fixture()); await captured(candidate, changed);
  const result = run(['compare', '--baseline', baseline, '--candidate', candidate, '--output', output]);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(await readFile(path.join(output, 'comparison.json')));
  assert.equal(report.status, 'regression'); assert.ok(report.sources.baseline.files['reference.json'].sha256);
  assert.ok(report.sources.calculation.files['core/comparison.mjs'].sha256);
  assert.ok((await stat(path.join(output, 'README.md'))).size > 0);
}));
test('CLI records a reference only with a reason, refuses overwrite and preserves source bytes', () => isolated(async directory => {
  const source = path.join(directory, 'candidate'), output = path.join(directory, 'recorded');
  const candidate = fixture(); candidate.reference.scenarios[1].metrics['firestore.readUnits'] = q(9); await captured(source, candidate);
  assert.equal(run(['reference', '--source', source, '--output', output]).status, 6);
  assert.equal(run(['reference', '--source', source, '--output', output, '--reason', 'Explicit initial capture of the fixture']).status, 0);
  assert.deepEqual(await readFile(path.join(output, 'reference.json')), await readFile(path.join(source, 'reference.json')));
  const record = JSON.parse(await readFile(path.join(output, 'reference-record.json')));
  assert.match(record.reason, /Explicit/); assert.equal(record.approvesConsumptionTarget, false);
  const updatedBudget = JSON.parse(await readFile(path.join(output, 'budget.json')));
  assert.equal(updatedBudget.scenarios[0].nominal.items.find(item => item.id === 'per-session-firestore-readUnits').quantity.value, '6');
  assert.equal(run(['reference', '--source', source, '--output', output, '--reason', 'Must not overwrite']).status, 6);
}));
test('CLI writes an incompatible-format report and rejects inputs as output destinations', () => isolated(async directory => {
  const baseline = path.join(directory, 'baseline'), candidate = path.join(directory, 'candidate'), output = path.join(directory, 'comparison');
  const changed = fixture(); changed.reference.format = 99;
  await captured(baseline, fixture()); await captured(candidate, changed);
  assert.equal(run(['compare', '--baseline', baseline, '--candidate', candidate, '--output', output]).status, 4);
  assert.equal(JSON.parse(await readFile(path.join(output, 'comparison.json'))).status, 'incompatible');
  assert.equal(run(['compare', '--baseline', baseline, '--candidate', baseline, '--output', baseline]).status, 6);
}));
test('CLI retains missing-condition diagnostics and refuses to register an uncontrolled capture', () => isolated(async directory => {
  const baseline = path.join(directory, 'baseline'), candidate = path.join(directory, 'candidate'), output = path.join(directory, 'comparison');
  const uncontrolled = fixture(); delete uncontrolled.reference.repeatability;
  await captured(baseline, fixture()); await captured(candidate, uncontrolled);
  const before = await readFile(path.join(candidate, 'reference.json'));
  assert.equal(run(['compare', '--baseline', baseline, '--candidate', candidate, '--output', output]).status, 4);
  const report = JSON.parse(await readFile(path.join(output, 'comparison.json')));
  assert.ok(report.issues.some(issue => issue.capture === 'candidate' && issue.path === '/repeatability'));
  assert.ok(report.sources.calculation.files['core/repeatability.mjs'].sha256);
  assert.match(await readFile(path.join(output, 'README.md'), 'utf8'), /repeatability/);
  assert.equal(run(['reference', '--source', candidate, '--output', path.join(directory, 'rejected'), '--reason', 'Must not convert absent conditions']).status, 6);
  assert.deepEqual(await readFile(path.join(candidate, 'reference.json')), before);
}));
