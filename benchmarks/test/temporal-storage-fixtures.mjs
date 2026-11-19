import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { fixture, profile, q, sealFixture } from './comparison-fixtures.mjs';
import { referenceBudgets } from '../persistence/budget.mjs';

export const copy = value => globalThis.structuredClone(value);
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)).digest('hex');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const inventoryFields = ['documents', 'documentBytes', 'automaticIndexBytes', 'automaticIndexEntries', 'compositeBytes', 'compositeIndexEntries', 'indexBytes', 'indexEntries', 'storedBytes'];
export const normal = capture => capture.bundle.reference.scenarios.find(s => s.name === 'normal');
export function repack(capture) {
  capture.bundle = JSON.parse(JSON.stringify(capture.bundle));
  capture.files = { 'reference.json': Buffer.from(JSON.stringify(capture.bundle.reference)), 'budget.json': Buffer.from(JSON.stringify(capture.bundle.budgets)) };
  return capture;
}
export function temporalFixture({ end = '2.25', cap = '20', editBaseline, editCandidate, editProfile } = {}) {
  const original = fixture(), prices = copy(profile);
  if (editProfile) editProfile(prices);
  const method = { id: 'storage-arithmetic/1', sources: { 'storage-fixture.mjs': 'a'.repeat(64) }, sdk: { name: 'fixture', version: '1' } };
  method.sha256 = fingerprint(method);
  const indexes = { indexes: [], fieldOverrides: [] };
  for (const s of original.reference.scenarios) {
    s.storageModel = { method, indexConfiguration: { value: indexes, sha256: fingerprint(indexes) } };
    s.inventory = {
      users: { documents: 1, documentBytes: 50, automaticIndexBytes: 50, automaticIndexEntries: 2, compositeBytes: 0, compositeIndexEntries: 0, indexBytes: 50, indexEntries: 2, storedBytes: 100 },
      trials: Object.fromEntries(inventoryFields.map(key => [key, 0])),
    };
    s.functions.timeout.metrics['functions.invocations'] = q(2);
    s.functions.timeout.metrics['firestore.readUnits'] = q(4);
    s.functions.timeout.metrics['firestore.readCalls'] = q(4);
    s.metrics['functions.invocations'] = q(s.name === 'idle' ? 3 : 4);
    s.metrics['firestore.readUnits'] = q(s.name === 'idle' ? 5 : 10);
    s.metrics['firestore.readCalls'] = q(s.name === 'idle' ? 5 : 10);
    if (s.name !== 'idle') s.storageTimeline = [{ atSeconds: 0, bytes: 80 }, { atSeconds: 2, bytes: 0 }];
  }
  original.reference.measuredCode = { sha256: 'b'.repeat(64) };
  if (editBaseline) editBaseline(original);
  sealFixture(original.reference);
  original.budgets = referenceBudgets(original.reference, prices);
  const baseline = repack({ bundle: original }), candidate = copy(baseline);
  candidate.bundle.reference.measuredCode.sha256 = 'c'.repeat(64);
  for (const s of candidate.bundle.reference.scenarios) {
    s.functions.timeout.metrics['functions.invocations'] = q(1);
    s.functions.timeout.metrics['firestore.readUnits'] = q(2);
    s.functions.timeout.metrics['firestore.readCalls'] = q(2);
    s.metrics['functions.invocations'] = q(s.name === 'idle' ? 2 : 3);
    s.metrics['firestore.readUnits'] = q(s.name === 'idle' ? 3 : 7);
    s.metrics['firestore.readCalls'] = q(s.name === 'idle' ? 3 : 7);
    if (s.name !== 'idle') {
      s.functions.apiData.metrics['firestore.readUnits'] = q(4);
      s.functions.apiData.metrics['firestore.readCalls'] = q(4);
      s.storageTimeline = [{ atSeconds: 0, bytes: 80 }, { atSeconds: end, bytes: 0 }];
    }
  }
  if (editCandidate) editCandidate(candidate.bundle);
  candidate.bundle.budgets = referenceBudgets(candidate.bundle.reference, prices);
  repack(candidate);
  const policy = { format: 1, metrics: [], money: [], performance: [], temporalStorage: {
    component: 'session-firestore-storage', unit: 'byte-second',
    scope: {
      baseline: { id: 'arithmetic-b0', referenceSha256: hash(baseline.files['reference.json']), budgetSha256: hash(baseline.files['budget.json']), measuredCodeSha256: original.reference.measuredCode.sha256 },
      conditionsSha256: baseline.bundle.reference.repeatability.sha256, assumptionsSha256: fingerprint(original.budgets.assumptions),
      storageMethod: { id: method.id, sha256: method.sha256 }, indexConfigurationSha256: fingerprint(indexes),
      profile: { id: prices.id, sha256: fingerprint(prices), currency: prices.currency, basis: prices.basis },
      windowSeconds: 2592000, billingPeriodSeconds: 2592000, variants: ['low', 'nominal', 'high'], volumes: [1, 1000, 10000],
    },
    review: { reason: 'Known manual 80-byte permanence example.', specification: 'arithmetic-spec/section-18',
      evidence: { file: 'arithmetic-review.json', sha256: 'd'.repeat(64), candidateReferenceSha256: hash(candidate.files['reference.json']), candidateMeasuredCodeSha256: 'c'.repeat(64) } },
    limits: [{ scenario: 'normal', maxIncreaseByteSeconds: cap, reason: '80 bytes for at most 0.25 additional seconds: 20 byte-seconds.' }],
  } };
  return { baseline, candidate, policy };
}
export const comparisonInput = data => ({ baseline: data.baseline.bundle, candidate: data.candidate.bundle, policy: data.policy,
  captureFiles: { baseline: data.baseline.files, candidate: data.candidate.files } });
