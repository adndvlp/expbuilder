import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { referenceBudgets } from '../persistence/budget.mjs';
import { quantity } from '../core/quantity.mjs';
const profile = JSON.parse(await readFile(new URL('../profiles/google-cloud-usd-2026-11-13.json', import.meta.url)));
const q = value => quantity(value, 'count', { provenance: 'observed', source: 'Known fixture', environment: 'test' });
const schedule = (name, reads) => [name, { origins: ['schedule'], metrics: { 'functions.invocations': q(1), 'firestore.readUnits': q(reads), 'firestore.readCalls': q(reads), 'firestore.queries': q(reads) } }];
const idle = { name: 'idle', functions: Object.fromEntries([schedule('timeout', 2), schedule('exports', 1)]), metrics: { 'functions.invocations': q(2), 'firestore.readUnits': q(3) }, registrations: [
  { name: 'timeout', memoryMiB: 256, cpu: 1, minInstances: 0, intervalMs: 60000 }, { name: 'exports', memoryMiB: 256, cpu: 1, minInstances: 0, intervalMs: 60000 },
], coverageIssues: [], functional: { passed: true }, inventory: {}, retainedRtdbJsonBytes: 2, storageTimeline: [{ atSeconds: 0, bytes: 0 }] };
const normal = { ...idle, name: 'normal', functions: { ...idle.functions, apiData: { origins: ['http'], metrics: { 'functions.invocations': q(1), 'firestore.readUnits': q(7), 'firestore.readCalls': q(7) } } },
  metrics: { 'functions.invocations': q(3), 'firestore.readUnits': q(10), 'firestore.writes': q(5) },
  registrations: [...idle.registrations, { name: 'apiData', memoryMiB: 256, cpu: 1, minInstances: 0 }],
  inventory: { event_receipts: { documents: 3, storedBytes: 3000 }, experiments: { documents: 1, storedBytes: 1000 } },
  storageTimeline: [{ atSeconds: 0, bytes: 0 }, { atSeconds: 1, bytes: 3000 }],
};
test('reference budget subtracts observed idle ticks from per-session consumption, adds the fixed monthly workload once', () => {
  const result = referenceBudgets({ scenarios: [idle, normal] }, profile);
  const budget = result.scenarios.find(scenario => scenario.name === 'normal').nominal;
  const reads = budget.items.filter(item => item.rate === 'reads');
  assert.equal(reads.find(item => item.scope === 'per-session').quantity.value, '7');
  assert.equal(reads.find(item => item.scope === 'window').quantity.value, '129600');
  const [one, thousand] = budget.projections.filter(row => [1, 1000].includes(row.sessions));
  assert.equal(one.fixed, thousand.fixed);
  assert.equal(budget.status, 'complete');
  assert.ok(budget.items.some(item => item.rate === 'firestore-storage' && item.scope === 'per-session' && Number(item.quantity.value) > 0));
  assert.equal(result.idle.length, 3);
});
test('unknown coverage and missing idle scenario produce incomplete budgets, never a free omitted service', () => {
  const result = referenceBudgets({ scenarios: [{ ...normal, coverageIssues: ['unknown network'] }] }, profile);
  const budget = result.scenarios[0].nominal;
  assert.equal(budget.status, 'incomplete'); assert.equal(budget.projections[0].total, null);
  assert.ok(budget.issues.some(issue => /idle/i.test(issue.reason)));
  const missing = { ...normal, metrics: { ...normal.metrics, 'firestore.writes': quantity(null, 'count', { source: 'Not observed' }) } };
  const incomplete = referenceBudgets({ scenarios: [idle, missing] }, profile).scenarios[0].nominal;
  assert.equal(incomplete.status, 'incomplete'); assert.equal(incomplete.projections[0].total, null);
});
test('reference budget rejects source function locations it cannot price', () => {
  assert.throws(() => referenceBudgets({ scenarios: [idle, { ...normal, registrations: normal.registrations.map(entry => ({ ...entry, location: 'us-east1' })) }] }, profile), /resource configuration/);
});
test('cloud compute uses explicit operation latency/cold-start assumptions rather than emulator timing', () => {
  const first = referenceBudgets({ scenarios: [idle, normal] }, profile);
  const timed = Object.fromEntries(Object.entries(normal.functions).map(([name, entry]) => [name, { ...entry, metrics: { ...entry.metrics, 'functions.localDurationMs': quantity(99999999, 'millisecond', { provenance: 'observed', source: 'Local clock', environment: 'test' }) } }]));
  const second = referenceBudgets({ scenarios: [idle, { ...normal, functions: timed }] }, profile);
  assert.deepEqual(first.scenarios[0].nominal.projections, second.scenarios[0].nominal.projections);
  assert.ok(Number(first.scenarios[0].high.projections[0].knownSubtotal) > Number(first.scenarios[0].low.projections[0].knownSubtotal));
  assert.ok(JSON.stringify(first.assumptions).includes('cold'));
});
test('explicit short horizons use whole schedule ticks consistently in fixed and idle budgets', () => {
  const result = referenceBudgets({ scenarios: [idle, normal] }, profile, { windowSeconds: 1 });
  const fixed = result.scenarios[0].nominal.items.find(item => item.id === 'window-firestore-readUnits');
  const idleCost = result.idle.find(item => item.windowSeconds === 1).items.find(item => item.id === 'window-firestore-readUnits');
  assert.equal(fixed.quantity.value, '3'); assert.equal(fixed.quantity.value, idleCost.quantity.value);
});
