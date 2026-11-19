import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { readCapture } from '../core/artifacts.mjs';
import { validateFunctionCoverage } from '../persistence/function-inventory.mjs';

test('CO14: revalidated B0 changes only the declared enqueue fault and retains the unoptimized backend', async () => {
  const directory = new URL('../references/persistence-b0-2026-11-14-r3/', import.meta.url);
  const { bundle, source } = await readCapture(fileURLToPath(directory));
  const previous = await readCapture(fileURLToPath(new URL('../references/persistence-b0-2026-11-14-r2/', import.meta.url)));
  const read = async name => JSON.parse(await readFile(new URL(name, directory)));
  const record = await read('reference-record.json'), proof = await read('repeatability-validation.json'), change = await read('revalidation.json');
  assert.equal(bundle.reference.revision, '437a3051189a1f0fd6ac6c7b3e03775b5564f341');
  assert.equal(record.approvesConsumptionTarget, false);
  assert.equal(record.source.files['reference.json'].sha256, source.files['reference.json'].sha256);
  assert.equal(bundle.reference.scenarios.length, 23);
  for (const scenario of bundle.reference.scenarios) {
    assert.equal(scenario.functional.passed, true); assert.deepEqual(scenario.coverageIssues, []);
    assert.equal(scenario.inventoryVerifiedAgainstEmulator, true); assert.deepEqual(validateFunctionCoverage(scenario), []);
    assert.equal(scenario.functionInventory.form, 'split');
    const old = previous.bundle.reference.scenarios.find(row => row.name === scenario.name);
    if (scenario.name === 'enqueue-failure') {
      assert.deepEqual(scenario.inputs, { ...old.inputs, failedQueue: 'processSessionExportTask' });
      assert.equal(scenario.metrics['tasks.enqueueFailures'].value, '1');
      assert.equal(scenario.functions.enqueueSessionExport.metrics['tasks.enqueueFailures'].value, '1');
      continue;
    }
    assert.deepEqual(scenario.inputs, old.inputs);
    assert.deepEqual(scenario.inventory, old.inventory); assert.deepEqual(scenario.storageTimeline, old.storageTimeline);
    assert.deepEqual(scenario.storageTiming, old.storageTiming); assert.deepEqual(scenario.functional, old.functional);
    for (const [metric, value] of Object.entries(old.metrics)) if (!metric.includes('localDuration')) assert.equal(scenario.metrics[metric].value, value.value);
    if (scenario.name !== 'idle') assert.deepEqual(bundle.budgets.scenarios.find(row => row.name === scenario.name), previous.bundle.budgets.scenarios.find(row => row.name === scenario.name));
  }
  assert.deepEqual(bundle.budgets.idle, previous.bundle.budgets.idle);
  const normal = bundle.reference.scenarios.find(row => row.name === 'normal-true-1');
  assert.equal(normal.metrics['firestore.readUnits'].value, '125'); assert.equal(normal.metrics['firestore.writes'].value, '56');
  assert.equal(normal.functions.enqueueSessionExport.metrics['firestore.readUnits'].value, '21');
  for (const [name, reads] of [['volume-3', '34'], ['volume-30', '169'], ['volume-300', '1519']]) {
    assert.equal(bundle.reference.scenarios.find(row => row.name === name).functions.processSessionExportTask.metrics['firestore.readUnits'].value, reads);
  }
  const oldSources = previous.bundle.reference.repeatability.conditions.fixture.sources, sources = bundle.reference.repeatability.conditions.fixture.sources;
  assert.deepEqual(Object.keys(sources).filter(file => sources[file] !== oldSources[file]).sort(), [
    'benchmarks/persistence/controller.mjs', 'benchmarks/persistence/scenarios.e2e.mjs',
  ]);
  assert.deepEqual(change.changedHarnessSources, ['benchmarks/persistence/bridge.mjs', 'benchmarks/persistence/controller.mjs', 'benchmarks/persistence/scenarios.e2e.mjs']);
  assert.equal(change.changedScenario, 'enqueue-failure'); assert.equal(change.unchangedScenarios, 22);
  assert.equal(proof.runs.length, 3); assert.equal(proof.comparisons.length, 3);
  assert.equal(new Set(proof.runs.map(run => run.source.files['reference.json'].sha256)).size, 3);
  for (const run of proof.runs) {
    assert.equal(run.scenarios, 23); assert.equal(run.functionalPassed, 23);
    assert.equal(run.measuredCode, bundle.reference.measuredCode.sha256); assert.equal(run.conditions, bundle.reference.repeatability.sha256);
  }
  for (const pair of [[1, 2], [1, 3], [2, 3]]) {
    const result = proof.comparisons.find(row => JSON.stringify(row.runs) === JSON.stringify(pair));
    assert.equal(result.exitCode, 0); assert.equal(result.nonzeroDifferences, 0);
    assert.ok(Object.values(result.equality).every(value => value === true));
    assert.deepEqual(result.policy, { format: 1, metrics: [], money: [], performance: [] });
    assert.equal(result.captureSources.baseline.files['reference.json'].sha256, proof.runs[pair[0] - 1].source.files['reference.json'].sha256);
    assert.equal(result.captureSources.candidate.files['reference.json'].sha256, proof.runs[pair[1] - 1].source.files['reference.json'].sha256);
  }
});
