import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { compareReferences, recalculateCapture } from '../core/comparison.mjs';
import { readCapture, readJson } from '../core/artifacts.mjs';
import { fileURLToPath } from 'node:url';

test('the historical 23-scenario arithmetic remains reproducible but cannot approve the new repetition contract', async () => {
  const root = new URL('../references/persistence-2026-11-13/', import.meta.url);
  const bundle = { reference: JSON.parse(await readFile(new URL('reference.json', root))), budgets: JSON.parse(await readFile(new URL('budget.json', root))) };
  const recalculated = recalculateCapture(bundle);
  const original = [...bundle.budgets.idle, ...bundle.budgets.scenarios.flatMap(s => ['low','nominal','high'].map(key => s[key]))];
  const current = [...recalculated.idle, ...recalculated.scenarios.flatMap(s => ['low','nominal','high'].map(key => s[key]))];
  for (const [index, budget] of original.entries()) for (const [position, projection] of budget.projections.entries()) {
    const { lineItems, ...totals } = projection, { lineItems: nextItems, ...nextTotals } = current[index].projections[position];
    assert.deepEqual(nextTotals, totals, budget.name);
    for (const item of lineItems) assert.deepEqual(nextItems.find(next => next.id === item.id), item, budget.name + '/' + item.id);
    // Explicit zero declarations strengthen coverage without changing any amount.
    for (const item of nextItems) if (!lineItems.some(previous => previous.id === item.id)) assert.equal(item.amount, '0');
  }
  const result = compareReferences({ baseline: bundle, candidate: bundle });
  assert.equal(result.status, 'incompatible'); assert.equal(result.exitCode, 4);
  assert.ok(result.issues.some(issue => issue.path === '/repeatability'));
  assert.equal(bundle.reference.repeatability, undefined, 'Historical evidence is never converted');
});
test('the controlled reference records three complete independent runs with exact pairwise equality', async () => {
  const root = new URL('../references/persistence-controlled-2026-11-13/', import.meta.url);
  const { bundle, source } = await readCapture(fileURLToPath(root));
  const record = (await readJson(fileURLToPath(new URL('reference-record.json', root)))).value;
  const proof = (await readJson(fileURLToPath(new URL('repeatability-validation.json', root)))).value;
  assert.equal(bundle.reference.scenarios.length, 23);
  assert.ok(bundle.reference.scenarios.every(s => s.functional.passed));
  assert.equal(record.source.files['reference.json'].sha256, source.files['reference.json'].sha256);
  assert.ok(record.reason.trim()); assert.equal(record.approvesConsumptionTarget, false);
  assert.equal(proof.runs.length, 3); assert.equal(proof.comparisons.length, 3);
  assert.equal(proof.conditionsFingerprint, bundle.reference.repeatability.sha256);
  assert.ok(proof.runs.some(run => run.source.files['reference.json'].sha256 === source.files['reference.json'].sha256));
  assert.equal(new Set(proof.runs.map(run => run.source.files['reference.json'].sha256)).size, 3);
  assert.equal(new Set(proof.runs.map(run => run.createdAt)).size, 3);
  assert.ok(proof.runs.every(run => run.scenarios === 23 && run.functionalPassed === 23
    && run.measuredCode === bundle.reference.measuredCode.sha256 && run.conditions === bundle.reference.repeatability.sha256));
  for (const pair of [[1,2],[1,3],[2,3]]) {
    const comparison = proof.comparisons.find(entry => JSON.stringify(entry.runs) === JSON.stringify(pair));
    assert.equal(comparison.exitCode, 0); assert.equal(comparison.status, 'passed');
    assert.deepEqual(comparison.equality, { measurements: true, storage: true, quantities: true, money: true, functional: true });
    assert.equal(comparison.nonzeroDifferences, 0);
    assert.ok(comparison.rows.measurements > 0 && comparison.rows.quantities > 0 && comparison.rows.money > 0);
    assert.match(comparison.source.files['comparison.json'].sha256, /^[a-f0-9]{64}$/);
    assert.equal(comparison.captureSources.baseline.files['reference.json'].sha256, proof.runs[pair[0]-1].source.files['reference.json'].sha256);
    assert.equal(comparison.captureSources.candidate.files['reference.json'].sha256, proof.runs[pair[1]-1].source.files['reference.json'].sha256);
  }
  const result = compareReferences({ baseline: bundle, candidate: bundle });
  assert.equal(result.exitCode, 0);
  assert.ok(Object.values(result.equality).every(value => value === true));
});
