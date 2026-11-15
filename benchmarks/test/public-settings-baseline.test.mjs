import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import { persistenceRepeatability } from '../persistence/repeatability.mjs';
import { compareReferences } from '../core/comparison.mjs';

test('the default baseline is the previous product measured with the current fixture, never the candidate promoted over itself', async () => {
  const directory = new URL('../references/persistence-before-public-settings-2026-11-14/', import.meta.url);
  const bytes = await readFile(new URL('reference.json', directory));
  const reference = JSON.parse(bytes);
  const validation = JSON.parse(await readFile(new URL('repeatability-validation.json', directory)));
  const record = JSON.parse(await readFile(new URL('reference-record.json', directory)));
  assert.match(reference.revision, /^b392e88/);
  assert.equal(reference.scenarios.length, 23);
  assert.ok(reference.scenarios.every(scenario => scenario.functional.passed && scenario.inventoryVerifiedAgainstEmulator && !scenario.coverageIssues.length));
  assert.deepEqual(reference.repeatability, await persistenceRepeatability(reference.scenarios));
  assert.equal(record.approvesConsumptionTarget, false);
  assert.equal(validation.baselineReferenceSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(validation.before.length, 3); assert.equal(validation.after.length, 3);
  assert.equal(validation.sourceProductUnmodified, true);
  assert.ok(validation.repetitions.length >= 6);
  assert.ok(validation.repetitions.every(comparison => comparison.status === 'passed' && Object.values(comparison.equality).every(Boolean)));
  assert.equal(validation.comparison.status, 'passed');
  assert.equal(validation.comparison.policy, 'benchmarks/policies/no-increases.json');
  assert.equal(validation.comparison.issues, 0);
  const policy = JSON.parse(await readFile(new URL('../policies/no-increases.json', import.meta.url)));
  assert.deepEqual(policy, { format: 1, metrics: [], money: [], performance: [] });
});

test('the new baseline still rejects one extra read, invocation or retained byte', async () => {
  const directory = new URL('../references/persistence-before-public-settings-2026-11-14/', import.meta.url);
  const baseline = { reference: JSON.parse(await readFile(new URL('reference.json', directory))),
    budgets: JSON.parse(await readFile(new URL('budget.json', directory))) };
  const increment = quantity => { quantity.value = String(Number(quantity.value) + 1); quantity.exact = { numerator: quantity.value, denominator: '1' }; };
  for (const kind of ['firestore.readUnits', 'functions.invocations', 'retained-byte']) {
    const candidate = structuredClone(baseline), scenario = candidate.reference.scenarios.find(s => s.name === 'normal-true-1');
    if (kind === 'retained-byte') {
      scenario.inventory.event_receipts.documentBytes++;
      scenario.inventory.event_receipts.storedBytes++;
      // The budget integrates the sampled inventory, including its final
      // retained value for the rest of the projection horizon.
      scenario.storageTimeline.at(-1).bytes++;
    } else {
      increment(scenario.metrics[kind]); increment(scenario.functions.apiData.metrics[kind]);
    }
    const report = compareReferences({ baseline, candidate, policy: { format: 1, metrics: [], money: [], performance: [] } });
    assert.equal(report.status, 'regression', kind);
    assert.ok(report.issues.some(issue => issue.code === 'limit_exceeded'), kind);
  }
});
