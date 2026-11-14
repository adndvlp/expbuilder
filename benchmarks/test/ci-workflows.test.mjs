import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { parseDocument } from 'yaml';
import path from 'node:path';
import { selectChecks, checkPaths } from '../ci/select.mjs';
const workflow = name => {
  const parsed = parseDocument(readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8'), { uniqueKeys: true });
  assert.deepEqual(parsed.errors, []); return parsed.toJS();
};
const selected = (definition, event, file) => definition.on[event].paths.some(glob => path.posix.matchesGlob(file, glob));

test('actual push and PR filters cover every benchmark integration input', () => {
  const definition = workflow('public-persistence');
  for (const event of ['push', 'pull_request']) for (const file of [
    'benchmarks/core/meter.mjs','benchmarks/ci/paths.json','benchmarks/test/ci-workflows.test.mjs','benchmarks/profiles/prices.json','benchmarks/references/initial/reference.json','benchmarks/fixtures/upload.csv',
    'benchmarks/core/repeatability.mjs','benchmarks/persistence/repeatability.mjs','benchmarks/profiles/persistence-timing.json','benchmarks/references/persistence-controlled-2026-11-13/repeatability-validation.json',
    'api/functions/index.js','api/firestore.indexes.json','api/persistence-e2e/task-queue.mjs','api/mock-providers/store.mjs','client/runtime-e2e/authoring/ScenarioAuthor.ts','client/src/pages/ExperimentBuilder/index.tsx',
    'server/dynamicplugin/renderer/CanvasStage.ts','server/jspsych-bundler/build.js','server/jspsych-bundle/index.js','shared/dynamic-layout/geometry.ts','scripts/run-persistence-e2e.mjs','package-lock.json','.github/workflows/public-persistence.yml',
  ]) assert.equal(selected(definition, event, file), true, event + ': ' + file);
  assert.equal(Object.hasOwn(definition.on, 'workflow_dispatch'), true);
  assert.equal(selected(definition, 'push', 'docs/12-PUBLISH_FLOW.md'), false);
  for (const patterns of Object.values(checkPaths)) for (const pattern of patterns) {
    assert.ok(!pattern.startsWith('!'), 'Selectors use only positive patterns');
    assert.ok(definition.on.push.paths.includes(pattern), 'Top-level trigger must cover selector ' + pattern);
  }
});
test('benchmark-only changes do not launch the whole Builder or persistence suite', () => {
  const builder = workflow('builder-contracts'), definition = workflow('public-persistence');
  assert.equal(selected(builder, 'push', 'benchmarks/profiles/prices.json'), false);
  assert.deepEqual(selectChecks(['benchmarks/profiles/prices.json']), { persistence: false, benchmark: true });
  assert.match(definition.jobs.persistence.if, /outputs\.persistence.*outputs\.benchmark/s);
  const functional = definition.jobs.persistence.steps.find(step => step.run === 'npm run test:e2e:persistence');
  assert.match(functional.if, /outputs\.persistence/);
});
test('cost checks run once, reuse installed dependencies and preserve failure artifacts with bounded retention', () => {
  const definition = workflow('public-persistence'), steps = definition.jobs.persistence.steps;
  assert.equal(steps.filter(step => step.run?.includes('npm run benchmark:cost:check')).length, 1);
  assert.equal(definition.jobs.functions, undefined, 'Functions already run in Builder contracts');
  assert.equal(workflow('builder-contracts').jobs.contracts.steps.filter(step => step['working-directory'] === 'api/functions' && step.run?.startsWith('npm test')).length, 1);
  assert.equal(steps.filter(step => step.run === 'npm ci').length, 1);
  const check = steps.find(step => step.run?.includes('npm run benchmark:cost:check'));
  assert.match(check.if, /!cancelled\(\)/); assert.match(check.if, /outputs\.benchmark/);
  assert.ok(!check['continue-on-error']); assert.match(check.run, /ci\/normalization\.json/);
  const upload = steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.match(upload.if, /always\(\)/); assert.match(upload.if, /outputs\.benchmark/);
  assert.ok(upload.with['retention-days'] > 0 && upload.with['retention-days'] <= 14);
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.ok(steps.some(step => step.run?.includes('ensure-report.mjs') && step.if?.includes('always()')));
  assert.equal(definition.permissions.contents, 'read');
  assert.equal(definition.jobs.persistence['runs-on'], 'ubuntu-24.04');
  assert.ok(!JSON.stringify(steps).includes('benchmark:cost:reference'), 'CI must never update a reference');
});
