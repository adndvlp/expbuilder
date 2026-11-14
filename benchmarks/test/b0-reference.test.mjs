import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { readCapture } from '../core/artifacts.mjs';
import { compareReferences } from '../core/comparison.mjs';
import { validateFunctionCoverage } from '../persistence/function-inventory.mjs';

test('CO04: B0 preserves three independent matrices, strict pairwise equality and the separated method correction', async () => {
  const directory = new URL('../references/persistence-b0-2026-11-14/', import.meta.url);
  const { bundle, source } = await readCapture(fileURLToPath(directory));
  const read = async name => JSON.parse(await readFile(new URL(name, directory)));
  const proof = await read('repeatability-validation.json'), record = await read('reference-record.json'), correction = await read('method-change.json');
  const prior = JSON.parse(await readFile(new URL('../references/persistence-controlled-2026-11-13/reference.json', import.meta.url)));
  assert.equal(bundle.reference.scenarios.length, 23);
  assert.equal(record.source.files['reference.json'].sha256, source.files['reference.json'].sha256);
  assert.equal(record.approvesConsumptionTarget, false); assert.match(record.reason, /B0/);
  assert.equal(proof.runs.length, 3); assert.equal(proof.comparisons.length, 3);
  assert.equal(new Set(proof.runs.map(run => run.source.files['reference.json'].sha256)).size, 3);
  assert.ok(proof.runs.every(run => run.scenarios === 23 && run.functionalPassed === 23
    && run.measuredCode === bundle.reference.measuredCode.sha256 && run.conditions === bundle.reference.repeatability.sha256));
  assert.ok(proof.runs.some(run => run.source.files['reference.json'].sha256 === source.files['reference.json'].sha256));
  for (const pair of [[1, 2], [1, 3], [2, 3]]) {
    const comparison = proof.comparisons.find(entry => JSON.stringify(entry.runs) === JSON.stringify(pair));
    assert.equal(comparison.exitCode, 0); assert.equal(comparison.nonzeroDifferences, 0);
    assert.ok(Object.values(comparison.equality).every(value => value === true));
    assert.deepEqual(comparison.policy, { format: 1, metrics: [], money: [], performance: [] });
    assert.equal(comparison.captureSources.baseline.files['reference.json'].sha256, proof.runs[pair[0] - 1].source.files['reference.json'].sha256);
    assert.equal(comparison.captureSources.candidate.files['reference.json'].sha256, proof.runs[pair[1] - 1].source.files['reference.json'].sha256);
  }
  for (const scenario of bundle.reference.scenarios) {
    assert.equal(scenario.functional.passed, true); assert.equal(scenario.inventoryVerifiedAgainstEmulator, true);
    assert.deepEqual(scenario.coverageIssues, []); assert.deepEqual(validateFunctionCoverage(scenario), []);
    assert.equal(scenario.storageModel.method.id, 'firestore-standard-storage/2');
    assert.equal(scenario.functionInventory.form, 'split', 'B0 precedes product consolidation');
    const original = prior.scenarios.find(entry => entry.name === scenario.name);
    for (const [metric, value] of Object.entries(original.metrics)) if (!metric.includes('localDuration')) {
      assert.equal(scenario.metrics[metric]?.value, value.value, scenario.name + '/' + metric);
    }
    for (const [collection, inventory] of Object.entries(original.inventory)) {
      assert.equal(scenario.inventory[collection].documents, inventory.documents);
      assert.equal(scenario.inventory[collection].documentBytes, inventory.documentBytes);
    }
  }
  assert.deepEqual(correction.productFilesChanged, []); assert.deepEqual(correction.nonPerformanceMetricChanges, []);
  assert.equal(correction.unchangedFunctionalScenarios, 23); assert.equal(correction.unchangedDocumentSizes, true);
  assert.ok(correction.storage.some(row => row.delta.indexBytes > 0));
  const result = compareReferences({ baseline: bundle, candidate: bundle });
  assert.equal(result.exitCode, 0); assert.ok(Object.values(result.equality).every(value => value === true));
});
