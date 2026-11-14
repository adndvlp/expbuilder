import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { selectChecks, changedFiles } from '../ci/select.mjs';

test('benchmark sources, profiles, references, fixtures and policies select only the cost check', () => {
  for (const file of ['benchmarks/core/meter.mjs', 'benchmarks/profiles/persistence-30d.json', 'benchmarks/references/run/reference.json', 'benchmarks/test/comparison.test.mjs', 'benchmarks/ci/normalization.json', 'benchmarks/fixtures/upload.csv',
    'benchmarks/core/repeatability.mjs', 'benchmarks/persistence/repeatability.mjs', 'benchmarks/profiles/persistence-timing.json', 'benchmarks/references/persistence-controlled-2026-11-13/repeatability-validation.json']) {
    assert.deepEqual(selectChecks([file]), { persistence: false, benchmark: true }, file);
  }
});
test('production persistence, runtime generation, dynamic components and shared geometry select both checks', () => {
  for (const file of ['api/functions/experiment/sessions/handler.js','api/persistence-e2e/harness.mjs','api/mock-providers/providers/google-drive.mjs','client/src/pages/ExperimentBuilder/utils/codegen/index.ts','client/runtime-e2e/authoring/ScenarioAuthor.ts','server/dynamicplugin/index.ts','shared/dynamic-layout/geometry.ts','server/jspsych-bundler/package.json','client/package-lock.json','package-lock.json','scripts/persistence-sdk.mjs']) {
    assert.deepEqual(selectChecks([file]), { persistence: true, benchmark: true }, file);
  }
});
test('the workflow and its activation tests select checks; unrelated docs do not', () => {
  assert.deepEqual(selectChecks(['.github/workflows/public-persistence.yml']), { persistence: true, benchmark: true });
  assert.equal(selectChecks(['benchmarks/test/ci-selection.test.mjs']).benchmark, true);
  assert.deepEqual(selectChecks(['docs/12-PUBLISH_FLOW.md']), { persistence: false, benchmark: false });
});
test('push and PR selectors use validated git ranges, include deleted/renamed paths, and never execute a shell', () => {
  const a = 'a'.repeat(40), b = 'b'.repeat(40), calls = [];
  const git = (args) => { calls.push(args); return Buffer.from('api/old.js\0benchmarks/new.mjs\0'); };
  assert.deepEqual(changedFiles('push', { before: a, after: b }, git), ['api/old.js','benchmarks/new.mjs']);
  assert.deepEqual(calls[0], ['diff', '--name-only', '--no-renames', '-z', a + '..' + b, '--']);
  changedFiles('pull_request', { pull_request: { base: { sha: a }, head: { sha: b } } }, git);
  assert.ok(calls[1].includes(a + '...' + b));
  assert.throws(() => changedFiles('push', { before: '$(malicious)', after: b }, git), /SHA/);
  assert.throws(() => changedFiles('schedule', {}, git), /event/);
});
test('manual runs and new branches select all checks; empty diffs remain empty', () => {
  assert.equal(changedFiles('workflow_dispatch', {}, () => { throw new Error('no git required'); }), null);
  assert.equal(changedFiles('push', { before: '0'.repeat(40), after: 'a'.repeat(40) }, () => { throw new Error('no git required'); }), null);
  assert.deepEqual(selectChecks(null), { persistence: true, benchmark: true });
  assert.deepEqual(selectChecks([]), { persistence: false, benchmark: false });
});
test('the actual selector publishes explicit booleans to GitHub outputs and fails on unreadable git ranges', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cost-selection-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const event = path.join(directory, 'event.json'), output = path.join(directory, 'outputs');
  await writeFile(event, '{}');
  const command = fileURLToPath(new URL('../ci/select.mjs', import.meta.url));
  const env = { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: output };
  const dispatched = spawnSync(process.execPath, [command], { env, encoding: 'utf8' });
  assert.equal(dispatched.status, 0, dispatched.stderr);
  assert.equal(await readFile(output, 'utf8'), 'persistence=true\nbenchmark=true\n');
  await writeFile(event, JSON.stringify({ before: 'a'.repeat(40), after: 'b'.repeat(40) }));
  const invalidRange = spawnSync(process.execPath, [command], { env: { ...env, GITHUB_EVENT_NAME: 'push' }, encoding: 'utf8' });
  assert.notEqual(invalidRange.status, 0);
  assert.equal(await readFile(output, 'utf8'), 'persistence=true\nbenchmark=true\n', 'A failed diff must not publish false outputs');
});
