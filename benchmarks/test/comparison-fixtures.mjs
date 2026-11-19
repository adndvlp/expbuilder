import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { quantity } from '../core/quantity.mjs';
import { referenceBudgets } from '../persistence/budget.mjs';
import { createRepeatabilityContract } from '../core/repeatability.mjs';
import { createScenarioInputs } from '../persistence/inputs.mjs';
import { createScenarioClock } from '../persistence/clock.mjs';
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
  const fire = { 'firestore.indexReadUnits': q(0), 'firestore.writes': q(0), 'firestore.deletes': q(0),
    'firestore.transactionAttempts': q(0), 'firestore.batchAttempts': q(0), 'firestore.directWriteCalls': q(0) };
  idle.metrics = { ...fire, ...idle.metrics };
  normal.metrics = { ...fire, ...normal.metrics, 'tasks.billableUnits': q(0), 'events.published': q(0),
    'events.publishedPayloadBytes': q(0, 'byte'), 'events.deliveredPayloadBytes': q(0, 'byte'),
    'rtdb.downloadBytes': q(0, 'byte'), 'rtdb.disconnectRegistrations': q(0), 'rtdb.readCalls': q(0), 'rtdb.writeAttempts': q(0),
    'http.requests': q(0), 'http.responseContentBytes': q(0, 'byte'),
    'provider.googledrive.requests': q(0), 'provider.googledrive.requestContentBytes': q(0, 'byte') };
  for (const s of [idle, normal]) s.controlledInputs = { ...createScenarioInputs({ scenario: s.name }).conditions(),
    participantEnvironment: { locale: 'en-US', timezoneId: 'UTC' }, timing: createScenarioClock().conditions() };
  const reference = { format: 1, revision: 'fixture-a', createdAt: '2026-11-13T00:00:00Z',
    machine: { node: 'v22.23.2', platform: 'fixture', arch: 'fixture', browser: '157.0' },
    scenarios: [idle, normal] };
  sealFixture(reference);
  return { reference, budgets: referenceBudgets(reference, profile) };
}
export function sealFixture(reference) {
  reference.repeatability = createRepeatabilityContract(reference.scenarios, { id: 'arithmetic-fixture/1', sources: { 'fixture.mjs': 'a'.repeat(64) } });
}
