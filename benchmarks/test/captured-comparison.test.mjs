import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { compareReferences, recalculateCapture } from '../core/comparison.mjs';

test('the committed 23-scenario capture remains reproducible and self-comparison has no changes', async () => {
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
  assert.equal(result.status, 'passed'); assert.equal(result.scenarios.length, 23);
  assert.ok(result.scenarios.every(scenario => [...scenario.metrics, ...scenario.money].every(row => row.delta === '0')));
});
