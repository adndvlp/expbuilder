import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registeredExports } from './function-inventory-fixture.mjs';
import { functionInventory, validateFunctionCoverage, functionMeasurements } from '../persistence/function-inventory.mjs';
import { createDispatcher } from '../persistence/dispatcher.mjs';
import { createMeter } from '../core/meter.mjs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { URL } from 'node:url';

test('CO04: the actual backend export surface is completely classified without invoking cloud handlers', () => {
  const source = `import {functionInventory} from ${JSON.stringify(new URL('../persistence/function-inventory.mjs', import.meta.url).href)};
    const exports=await import(${JSON.stringify(new URL('../../api/functions/index.js', import.meta.url).href)});
    const {definitions,evidence}=functionInventory(exports);
    if(evidence.registered.length!==Object.keys(exports).length) throw Error('Missing actual export');
    if(definitions.some(d=>d.origin==='task'&&d.memoryMiB!==(JSON.parse(JSON.stringify(d.endpoint)).availableMemoryMb||256))) throw Error('Lost resource binding');
    process.stdout.write(JSON.stringify({runtime:definitions.map(d=>d.name),scopes:[...new Set(evidence.registered.map(d=>d.coverage.scope))]}));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', env: { ...process.env,
    GCLOUD_PROJECT: 'demo-public-persistence', FIRESTORE_EMULATOR_HOST: '127.0.0.1:9999', GOOGLE_APPLICATION_CREDENTIALS: '',
    FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-public-persistence', databaseURL: 'http://127.0.0.1:9998?ns=demo-public-persistence' }) } });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.ok(result.runtime.includes('processSessionExportTask'));
  assert.deepEqual(result.scopes.sort(), ['outside-workload', 'runtime']);
});

test('CO05: inventory accepts exactly the split or consolidated responsibilities from real registrations', () => {
  for (const form of ['split', 'consolidated']) {
    const exports = registeredExports(form);
    exports.publishExperiment = { run() {}, __endpoint: { platform: 'gcfv2', httpsTrigger: {} } };
    const { definitions, evidence } = functionInventory(exports);
    assert.equal(evidence.form, form);
    assert.equal(definitions.length, form === 'split' ? 9 : 8);
    assert.equal(evidence.registered.length, Object.keys(exports).length);
    assert.match(evidence.registered.find(entry => entry.name === 'publishExperiment').coverage.reason, /publication/i);
    assert.deepEqual(evidence.responsibilities[0].members, form === 'split'
      ? ['reconcilePendingSessionExports', 'reconcilePendingSessionTimeouts'] : ['reconcilePendingSessions']);
    const worker = definitions.find(entry => entry.name === 'processSessionExportTask');
    assert.equal(worker.retry.maxAttempts, 8); assert.equal(worker.memoryMiB, 256);
    assert.ok(definitions.every(entry => evidence.registered.some(record => record.name === entry.name && record.coverage.scope === 'runtime')));
  }
});

test('CO06: missing, unknown, malformed or overlapping registrations cannot be counted as zero', () => {
  for (const mutate of [
    e => { delete e.enqueueSessionTimeout; },
    e => { e.reconcilePendingSessions = registeredExports('consolidated').reconcilePendingSessions; },
    e => { e.unobserved = e.apiData; },
    e => { e.enqueueSessionTimeout.__endpoint.eventTrigger.eventFilterPathPatterns.document = 'other/{id}'; },
    e => { e.onSessionConnectionWritten.__endpoint.eventTrigger.eventType = 'other'; },
    e => { e.enqueueSessionTimeout.__endpoint.eventTrigger.eventFilters.unobserved = 'filter'; },
    e => { e.processSessionTimeout.__endpoint.taskQueueTrigger.retryConfig.maxRetrySeconds = 60; },
    e => { e.reconcilePendingSessionTimeouts.__endpoint.scheduleTrigger.timeZone = 'other'; },
    e => { e.processSessionTimeout.__endpoint.region = ['us-east1']; },
    e => { e.apiData.__endpoint = {}; },
    e => { e.publishExperiment = e.enqueueSessionExport; },
  ]) {
    const exports = registeredExports(); mutate(exports);
    assert.throws(() => functionInventory(exports), /inventory|coverage|registration|registered|resource|schedule/i);
  }
});

test('CO05/CO06: dispatcher uses registered bindings, fans out writes, and declares observed zero invocations', async () => {
  const { definitions, evidence } = functionInventory(registeredExports());
  let calls = 0;
  for (const definition of definitions) definition.handler = () => { calls++; };
  const meter = createMeter({ scenario: 'inventory', environment: 'fixture' });
  const dispatcher = createDispatcher({ meter, definitions, queue: [], now: () => 0 });
  dispatcher.publish('firestore', 'experiments/e/sessions/s', { data: { after: { exists: true } } }, 10);
  dispatcher.publish('database', '/session_connections/e/s/c', { data: {} }, 20);
  await dispatcher.pump(); assert.equal(calls, 2);
  const scenario = { ...meter.snapshot(), registrations: definitions.map(({ handler, ...entry }) => { void handler; return entry; }), functionInventory: evidence };
  assert.equal(scenario.functions.reconcilePendingSessionTimeouts.metrics['functions.invocations'].value, '0');
  assert.equal(scenario.functions.reconcilePendingSessionTimeouts.metrics['rtdb.downloadBytes'], undefined);
  assert.equal(scenario.functions.reconcilePendingSessionTimeouts.observer.zeroMetrics['rtdb.downloadBytes'], 'byte');
  assert.equal(functionMeasurements(scenario.functions.reconcilePendingSessionTimeouts)['rtdb.downloadBytes'].value, '0');
  assert.deepEqual(validateFunctionCoverage(scenario), []);
  delete scenario.functions.reconcilePendingSessionTimeouts;
  assert.ok(validateFunctionCoverage(scenario).some(issue => /unobserved|missing/i.test(issue.reason)));
});

test('binding dispatch delivers every matching handler, including no-op handlers', async () => {
  const { definitions } = functionInventory(registeredExports());
  const source = definitions.find(entry => entry.name === 'enqueueSessionTimeout');
  let calls = 0;
  const handlers = [source, { ...source, name: 'second-binding' }].map(definition => ({ ...definition, handler: () => { calls++; } }));
  const meter = createMeter({ scenario: 'fanout', environment: 'fixture' });
  const dispatcher = createDispatcher({ meter, definitions: handlers, queue: [], now: () => 0 });
  assert.equal(dispatcher.publish('database', 'session_connection_leases/e/s/c', { data: {} }, 10), 0);
  assert.equal(dispatcher.publish('firestore', 'experiments/e/sessions/s', { data: {} }, 10), 2);
  await dispatcher.pump(); assert.equal(calls, 2);
  assert.equal(meter.snapshot().metrics['functions.invocations'].value, '2');
});
