import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCalibration } from '../core/calibration.mjs';
import { assumptions, referenceBudgets } from '../persistence/budget.mjs';
import { quantity } from '../core/quantity.mjs';
import { fixture, profile } from './comparison-fixtures.mjs';
const calibration = () => ({ format: 1, id: 'external-latency-1', source: 'Local controlled measurement batch 7', recordedAt: '2026-11-13T01:00:00Z', environment: 'Declared test environment',
  parameters: { 'nominal.firestoreReadMs': quantity(30, 'millisecond', { provenance: 'external', source: 'file:measurements/read-latency.json' }) } });
test('external inputs update a cloned model with provenance and never modify source conditions', () => {
  const before = globalThis.structuredClone(assumptions), result = applyCalibration(assumptions, calibration());
  assert.equal(result.conditions.nominal.firestoreReadMs, 30);
  assert.equal(result.evidence.parameters['nominal.firestoreReadMs'].provenance, 'external');
  assert.deepEqual(assumptions, before);
});
test('calibration rejects counters, missing provenance, incompatible units and invalid coefficients', () => {
  for (const parameters of [
    { 'firestore.readUnits': quantity(0, 'count', { provenance: 'external', source: 'invalid counter override' }) },
    { 'nominal.firestoreReadMs': quantity(30, 'byte', { provenance: 'external', source: 'wrong unit' }) },
    { 'nominal.coldFraction': quantity(2, 'count', { provenance: 'external', source: 'invalid fraction' }) },
    { 'nominal.firestoreReadMs': quantity(30, 'millisecond', { provenance: 'assumed', source: 'not an external sample' }) },
  ]) assert.throws(() => applyCalibration(assumptions, { ...calibration(), parameters }));
});
test('persistence budgets accept common conditions and preserve the explicit external source in their report', () => {
  const { conditions, evidence } = applyCalibration(assumptions, calibration());
  const result = referenceBudgets(fixture().reference, profile, { conditions, calibration: evidence });
  assert.equal(result.assumptions.nominal.firestoreReadMs, 30);
  assert.equal(result.calibration.id, 'external-latency-1');
  assert.ok(Number(result.scenarios[0].nominal.projections[0].total) > 0);
});
test('calibration cannot silently invert the declared low/nominal/high ranges', () => {
  const input = calibration();
  input.parameters['nominal.providerMs'] = quantity(5000, 'millisecond', { provenance: 'external', source: 'Observed latency beyond the previous upper scenario' });
  assert.throws(() => applyCalibration(assumptions, input), /range/i);
});
