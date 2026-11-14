import { build } from '../../client/node_modules/esbuild/lib/main.js';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readFile } from 'node:fs/promises';
import { createMeter } from '../core/meter.mjs';
import { observeFirestore } from '../core/firestore.mjs';
import { observeRealtimeDatabase } from '../core/adapters.mjs';
import { quantity } from '../core/quantity.mjs';
import { changedDocuments, indexReadUnits } from './model.mjs';
import { functionInventory, validateFunctionCoverage } from './function-inventory.mjs';
import { storageInventory, storageMeasurement } from './storage-measurement.mjs';
import { createDispatcher } from './dispatcher.mjs';
import { state } from './bridge.mjs';
import { deliveries } from '../../api/persistence-e2e/task-queue.mjs';
import { createScenarioInputs } from './inputs.mjs';
import { instrumentInputs } from './instrument-inputs.mjs';
import { selectNodeInputs } from './node-inputs.mjs';
import { createProviderTransport } from './input-transport.mjs';
import { withProviderInputs, resetStore, store } from '../../api/mock-providers/store.mjs';
import { createScenarioClock, timeMeter } from './clock.mjs';
import { controlDatabaseTimestamps } from './clock-database.mjs';
import { setTimeout, clearTimeout } from 'node:timers';
import { setTimeout as delay } from 'node:timers/promises';

const count = (object, key) => Number(object?.[key]?.value || 0);
const assumedBytes = value => quantity(value, 'byte', { provenance: 'assumed', source: 'RTDB JSON/protocol model: 512 response bytes and 256 request bytes per SDK exchange; TLS separate' });
export async function createController() {
  if (process.env.PERSISTENCE_E2E !== '1' || process.env.GCLOUD_PROJECT !== 'demo-public-persistence') throw new Error('Isolated demo benchmark required');
  const bundle = await build({ entryPoints: [new URL('./browser.mjs', import.meta.url).pathname], bundle: true, platform: 'browser', format: 'iife', write: false });
  const inputBundle = await build({ entryPoints: [new URL('./browser-inputs.mjs', import.meta.url).pathname], bundle: true, platform: 'browser', format: 'iife', globalName: 'CostFixtureInputs', write: false });
  const transport = createProviderTransport(), providerOrigins = new Map();
  let inputs = createScenarioInputs({ scenario: 'setup' }), providerInputs = new Map(), participants = 0;
  let clock = createScenarioClock({epoch:inputs.epoch}), nativeDelayMs = 0, injectedDelayMs = 0;
  const nativeDelay = async () => { if (nativeDelayMs) { injectedDelayMs += nativeDelayMs; await delay(nativeDelayMs); } };
  state.transport = transport; state.clock = clock; selectNodeInputs(inputs, clock);
  const indexConfig = JSON.parse(await readFile(new URL('../../api/firestore.indexes.json', import.meta.url)));
  const storageModel = await storageMeasurement(indexConfig);
  let tail = Promise.resolve(), active = false, definitions = [], cached = new Map(), overheadMs = 0;
  let functionEvidence;
  let realtimeCache = new Map(), diagnosticReads = 0, httpRequests = 0, stopListener = () => {};
  let otherRealtimeCache = new Map();
  const presenceWaiters = new Set();
  let presenceTimes = new Map(), disconnectPlans = new Map();
  const presenceKey = (path, data) => JSON.stringify([path, data.generation, data.connected, data.changedAt]);
  function presenceView(path, data) {
    if (!path.startsWith('/session_connections/') || !data) return data;
    const at = presenceTimes.get(presenceKey(path.slice('/session_connections/'.length), data));
    if (at === undefined) throw new Error('RTDB presence has not reached the controlled event boundary');
    return {...data, changedAt:at};
  }
  const presenceMatches = data => {
    const value = realtimeCache.get(`${data.experimentID}/${data.sessionId}/${data.connectionId}`);
    return value?.connected === true && value.generation === data.connectionGeneration;
  };
  function waitForPresence(data) {
    if (presenceMatches(data)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter = { data, resolve: () => { clearTimeout(timer); presenceWaiters.delete(waiter); resolve(); },
        reject: error => { clearTimeout(timer); presenceWaiters.delete(waiter); reject(error); } };
      const timer = setTimeout(() => waiter.reject(new Error('Controlled presence was not observed before activation')), 10000);
      presenceWaiters.add(waiter);
    });
  }
  const exclusive = operation => {
    const result = tail.then(operation); tail = result.catch(() => {}); return result;
  };
  async function inspect(operation) {
    return exclusive(async () => {
      const previous = state.active; state.active = null;
      const start = performance.now();
      try { await nativeDelay(); return await operation(); }
      finally { overheadMs += performance.now() - start; state.active = previous; }
    });
  }
  async function committed(operations) {
    const start = performance.now();
    try {
      await nativeDelay();
      const refs = [...new Map(operations.map(({ ref }) => [ref.path, ref])).values()];
      const snapshots = await state.nativeDb.getAll(...refs); diagnosticReads += refs.length;
      const changes = changedDocuments(cached, snapshots.map(doc => ({ path: doc.ref.path, data: doc.exists ? doc.data() : null })));
      for (const change of changes) {
        const parts = change.path.split('/');
        if (!['experiments', 'logs', 'users'].includes(parts[0])) throw new Error('Unclassified document trigger path');
        const after = { exists: change.after !== null, data: () => change.after };
        const before = { exists: change.before !== null, data: () => change.before };
        controller.dispatcher.publish('firestore', change.path, { data: { before, after } }, Buffer.byteLength(JSON.stringify(change)));
      }
      recordStorage();
    } finally { overheadMs += performance.now() - start; }
  }
  function inventory(documents = cached) {
    return storageInventory(documents, indexConfig);
  }
  function recordStorage() {
    const groups = inventory(), bytes = Object.entries(groups).filter(([key]) => !['experiments', 'logs', 'users'].includes(key)).reduce((sum, [, value]) => sum + value.storedBytes, 0);
    clock.sample(bytes);
  }
  const controller = {
    browserScript: bundle.outputFiles[0].text,
    contextOptions: { locale: 'en-US', timezoneId: 'UTC', viewport: { width: 1280, height: 720 }, screen: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 CostBenchmarkFixture/1' },
    inputConditions: () => ({ ...inputs.conditions(), participantEnvironment: controller.contextOptions, timing:clock.conditions() }),
    async prepare(name, conditions = {}) {
      await tail; if (active) throw new Error('Cannot replace active scenario inputs');
      inputs = createScenarioInputs({ ...conditions, scenario: name }); providerInputs = new Map(); participants = 0;
      state.failEnqueue = null;
      clock = createScenarioClock({epoch:inputs.epoch}); state.clock = clock; nativeDelayMs = 0; injectedDelayMs = 0;
      presenceTimes = new Map(); disconnectPlans = new Map();
      selectNodeInputs(inputs, clock); resetStore();
      store.drive.tokens.set('token', {}); store.dropbox.tokens.set('token', {}); store.osf.tokens.set('token', {});
    },
    studyId: () => inputs.id('experiment'),
    publicCode: source => '(async () => { await window.__costInputs.ready;\n' + instrumentInputs(source, { scope: 'public', browser: true }) + '\n})();',
    providerUrl(name, actual) {
      const logical = transport.register(name, actual); providerOrigins.set(name, logical); return logical;
    },
    async provider(name, handler, req, res, url, body, contentType) {
      if (!providerInputs.has(name)) providerInputs.set(name, createScenarioInputs({ ...inputs.conditions(), scenario: inputs.scenario + '/provider-' + name, now:clock.now }));
      await nativeDelay();
      const logical = new URL(url.pathname + url.search, providerOrigins.get(name));
      return withProviderInputs(providerInputs.get(name), () => handler(req, res, logical, body, contentType));
    },
    now: () => clock.now(),
    advance: ms => clock.advance(ms),
    setNativeDelay(ms) { if (!Number.isSafeInteger(ms) || ms < 0 || ms > 1000) throw new Error('Invalid diagnostic delay'); nativeDelayMs = ms; },
    inspect, exclusive,
    async initialize() {
      const inventory = functionInventory(await import('../../api/functions/index.js'));
      definitions = inventory.definitions; functionEvidence = inventory.evidence;
    },
    async begin(name, h, study) {
      await tail; if (active) throw new Error('Scenario already active');
      deliveries.length = 0; cached = new Map(); realtimeCache = new Map(); otherRealtimeCache = new Map(); diagnosticReads = 0; overheadMs = 0; httpRequests = 0;
      if (study) {
        const ref = state.nativeDb.doc('experiments/' + study.id), snapshot = await ref.get();
        cached.set(ref.path, snapshot.data());
      }
      const owner = await state.nativeDb.doc('users/owner').get(); cached.set(owner.ref.path, owner.data());
      controller.meter = timeMeter(createMeter({ scenario: name, environment: 'Node 22 + Firestore/RTDB emulators + system Chromium + local provider HTTP', clock: () => performance.now() - overheadMs, maxEvidencePerMetric: 128 }), clock);
      controller.observedDb = observeFirestore(state.nativeDb, controller.meter, { queryIndexReads: indexReadUnits, onCommitted: committed });
      controller.dispatcher = createDispatcher({ meter: controller.meter, definitions, queue: deliveries, now:clock.now });
      controller.rtdbWrappers = new WeakMap();
      const root = h.realtime.ref();
      await root.set(null); // Preparation, deliberately outside workload observation.
      const listener = snapshot => {
        if (!active) return;
        const all = snapshot.val() || {}, documents = [];
        for (const [experimentID, sessions] of Object.entries(all.session_connections || {})) for (const [sessionId, connections] of Object.entries(sessions)) for (const [connectionId, data] of Object.entries(connections)) {
          documents.push({ path: `${experimentID}/${sessionId}/${connectionId}`, data });
        }
        for (const path of realtimeCache.keys()) if (!documents.some(item => item.path === path)) documents.push({ path, data: null });
        const changes = changedDocuments(realtimeCache, documents);
        for (const change of changes) {
          if (change.after) {
            const planned = change.after.connected === false ? disconnectPlans.get('/session_connections/' + change.path) : undefined;
            presenceTimes.set(presenceKey(change.path, change.after), planned ?? clock.now());
          }
          controller.meter.add('rtdb.presenceChanges', 1, { source: 'RTDB emulator change observed by benchmark infrastructure; not an extra application read' });
          controller.dispatcher.publish('database', 'session_connections/' + change.path, { data: {
            before: { val: () => presenceView('/session_connections/' + change.path, change.before) }, after: { val: () => presenceView('/session_connections/' + change.path, change.after) },
          } }, Buffer.byteLength(JSON.stringify(change)));
        }
        const other = [];
        for (const [experimentID, sessions] of Object.entries(all.sessions || {})) for (const [sessionId, data] of Object.entries(sessions)) other.push({ path: `sessions/${experimentID}/${sessionId}`, data });
        for (const path of otherRealtimeCache.keys()) if (!other.some(item => item.path === path)) other.push({ path, data: null });
        for (const change of changedDocuments(otherRealtimeCache, other)) controller.dispatcher.publish('database', change.path, { data: {
          before: { val: () => change.before }, after: { val: () => change.after },
        } }, Buffer.byteLength(JSON.stringify(change)));
        // Lease writes are observed by the RTDB adapter; the registered trigger
        // inventory has no binding on session_connection_leases.
        if (Object.keys(all).some(key => !['sessions', 'session_connections', 'session_connection_leases'].includes(key))) controller.meter.unknown('rtdb.triggerCoverage', 'count', 'Unclassified RTDB producer path');
        for (const waiter of presenceWaiters) if (presenceMatches(waiter.data)) waiter.resolve();
      };
      root.on('value', listener); stopListener = () => root.off('value', listener);
      active = true; state.active = controller; recordStorage();
    },
    realtime(database) {
      if (!controller.rtdbWrappers.has(database)) controller.rtdbWrappers.set(database, controlDatabaseTimestamps(observeRealtimeDatabase(database, controller.meter, {
        transferBytes: ({ direction, payloadJsonBytes = 0 }) => ({ download: assumedBytes((direction === 'read' ? payloadJsonBytes : 0) + 512), upload: assumedBytes((direction === 'write' ? payloadJsonBytes : 0) + 256) }),
      }), {readPresence:presenceView}));
      return controller.rtdbWrappers.get(database);
    },
    async attach(context) {
      const conditions = { ...inputs.conditions(), participant: ++participants };
      conditions.timing = clock.conditions();
      await context.exposeBinding('__benchmarkTime', async (_source, action, data) => {
        if (action === 'presence') await waitForPresence(data);
        return exclusive(async () => {
          if (!active) throw new Error('Clock action outside active scenario');
          if (action === 'response') clock.advance(inputs.responseMs, 'synthetic-response');
          else if (action === 'disconnect') { clock.advanceTo(data.at, 'declared-disconnect'); disconnectPlans.set(data.path, data.at); }
          else if (!['sync','presence'].includes(action)) throw new Error('Unknown scenario clock action');
          await controller.dispatcher.pump(); return clock.now();
        });
      });
      await context.addInitScript(inputBundle.outputFiles[0].text + '\nCostFixtureInputs.installBrowserInputs(window, ' + JSON.stringify(conditions) + ');');
      await context.exposeBinding('__benchmarkMetric', (_source, method, args) => exclusive(() => {
        if (!active) return;
        if (!['add', 'addQuantity', 'unknown'].includes(method)) throw new Error('Invalid browser observation');
        // Add environment explicitly; browser operations never inherit a function invocation.
        if (method === 'add') args[2] = { environment: 'Chromium Firebase compat SDK', ...args[2] };
        controller.meter[method](...args);
      }));
    },
    http(handler, req, res) {
      return exclusive(async () => {
        if (!active) throw new Error('Public request outside measured scenario');
        httpRequests++;
        controller.meter.add('http.requests', 1);
        controller.meter.add('http.requestContentBytes', Buffer.byteLength(JSON.stringify(req.body)), { unit: 'byte', source: 'HTTP JSON entity, excludes wire overhead' });
        const nativeJson = res.json;
        let responseBody, responseReady = false;
        res.json = function (value) {
          if (res.statusCode >= 400) controller.meter.add('http.errorResponses', 1);
          controller.meter.add('http.responseContentBytes', Buffer.byteLength(JSON.stringify(value)), { unit: 'byte', source: 'HTTP JSON entity, excludes wire overhead' });
          responseBody = value; responseReady = true; return this;
        };
        await controller.meter.wrapFunction('apiData', handler, { origin: 'http' })(req, res);
        await controller.dispatcher.pump();
        if (responseReady) { res.json = nativeJson; nativeJson.call(res, responseBody); }
      }).catch(error => { controller.failure = error; if (!res.headersSent && !res.destroyed) res.status(500).end(); });
    },
    async pump() { return exclusive(async () => { if (active) { if (controller.failure) throw controller.failure; await controller.dispatcher.pump(); } }); },
    async finish(h) {
      return exclusive(async () => {
        try { await controller.dispatcher.pump(); } catch (error) { controller.failure ||= error; }
        if (controller.failure) controller.meter.unknown('scenario.failure', 'count', 'Scenario runtime/dispatcher failure: ' + controller.failure.message);
        recordStorage(); stopListener();
        const measurementStart = performance.now(), nativeInventory = new Map();
        // Validate retained inventory independently from the commit observer. These
        // diagnostic reads never pass through the measured database facade.
        for (const group of new Set([...cached.keys()].map(path => path.split('/').at(-2)).concat(['trials', 'chunks']))) {
          const snapshot = await state.nativeDb.collectionGroup(group).get(); diagnosticReads += Math.max(1, snapshot.size);
          for (const doc of snapshot.docs) {
            if (doc.ref.path.startsWith('experiments/') || cached.has(doc.ref.path)) nativeInventory.set(doc.ref.path, doc.data());
          }
        }
        const retainedInventory = inventory();
        if (!isDeepStrictEqual(retainedInventory, inventory(nativeInventory))) controller.meter.unknown('inventory.coverage', 'count', 'Observed retained inventory differs from native emulator inventory');
        overheadMs += performance.now() - measurementStart;
        const nativeTree = await h.realtime.ref().once('value'); diagnosticReads++;
        const result = { ...controller.meter.snapshot(), functionInventory: functionEvidence, storageModel, inventory: retainedInventory, inventoryVerifiedAgainstEmulator: isDeepStrictEqual(retainedInventory, inventory(nativeInventory)), storageTimeline: clock.samples(), storageTiming:clock.snapshot(),
          retainedRtdbJsonBytes: Buffer.byteLength(JSON.stringify(nativeTree.val() || {})),
          pending: controller.dispatcher.pending(), virtualSeconds: clock.elapsedMs() / 1000,
          overhead: { diagnosticReads, localInspectionMs: overheadMs, injectedDelayMs, note: 'Unpriced benchmark-only snapshot reads, setup, validation, browser instrumentation and emulator traffic; inspection time excluded from local function samples' }, httpRequests,
          registrations: definitions.map(({ handler, ...definition }) => { void handler; return definition; }) };
        for (const issue of validateFunctionCoverage(result)) result.coverageIssues.push(issue.reason + ': ' + issue.path);
        active = false; state.active = null; controller.failure = null; return result;
      });
    },
    stop() { active = false; state.active = null; state.transport = null; state.clock = null; selectNodeInputs(null); stopListener();
      for (const waiter of presenceWaiters) waiter.reject(new Error('Scenario stopped')); },
    metric(name) { return count(controller.meter.snapshot().metrics, name); },
  };
  return controller;
}
