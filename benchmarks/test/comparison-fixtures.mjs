import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { quantity } from '../core/quantity.mjs';
import { referenceBudgets } from '../persistence/budget.mjs';
export const profile = JSON.parse(readFileSync(new URL('../profiles/google-cloud-usd-2026-11-13.json', import.meta.url)));
export const q = (value, unit = 'count') => quantity(value, unit, { provenance: 'observed', source: 'Comparison arithmetic fixture', environment: 'fixture' });
export function fixture() {
  const registration = (name, intervalMs = null) => ({ name, origin: intervalMs ? 'schedule' : 'http', cpu: 1, memoryMiB: 256, minInstances: 0, location: 'us-central1', intervalMs });
  const handler = (origin, reads) => ({ origins: [origin], metrics: { 'functions.invocations': q(1), 'firestore.readUnits': q(reads), 'firestore.readCalls': q(reads), 'functions.localDurationMs': q(10, 'millisecond') }, sampledRssMaxBytes: 1000, memoryScope: 'Local fixture RSS' });
  const common = { environment: 'fixture', coverageIssues: [], inventoryVerifiedAgainstEmulator: true,
    functional: { passed: true, events: 3, csvRows: 3 }, pending: { tasks: 0, events: 0, futureTasks: 0 },
    inventory: { users: { documents: 1, documentBytes: 50, indexBytes: 50, storedBytes: 100, indexEntries: 2 } }, retainedRtdbJsonBytes: 100,
    storageTimeline: [{ atSeconds: 0, bytes: 0 }], virtualSeconds: 60,
    registrations: [registration('timeout', 60000), registration('exports', 60000), registration('apiData')],
  };
  const idle = { ...common, name: 'idle', inputs: { seconds: 60, sessions: 0 }, metrics: { 'functions.invocations': q(2), 'firestore.readUnits': q(3), 'firestore.readCalls': q(3) },
    functions: { timeout: handler('schedule', 2), exports: handler('schedule', 1) } };
  const normal = { ...common, name: 'normal', inputs: { indexed: true, size: 1, count: 3, timeout: 1 },
    metrics: { 'functions.invocations': q(3), 'firestore.readUnits': q(8), 'firestore.readCalls': q(8), 'firestore.writes': q(3) },
    functions: { ...idle.functions, apiData: handler('http', 5) } };
  const reference = { format: 1, revision: 'fixture-a', createdAt: '2026-11-13T00:00:00Z',
    machine: { node: 'v22.23.2', platform: 'fixture', arch: 'fixture', browser: '157.0' },
    scenarios: [idle, normal] };
  return { reference, budgets: referenceBudgets(reference, profile) };
}
