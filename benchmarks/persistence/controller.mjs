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
import { changedDocuments, documentStorage, indexReadUnits, registration } from './model.mjs';
import { createDispatcher } from './dispatcher.mjs';
import { state } from './bridge.mjs';
import { deliveries } from '../../api/persistence-e2e/task-queue.mjs';
import { createScenarioInputs } from './inputs.mjs';
import { instrumentInputs } from './instrument-inputs.mjs';
import { selectNodeInputs } from './node-inputs.mjs';
import { createProviderTransport } from './input-transport.mjs';
import { withProviderInputs, resetStore, store } from '../../api/mock-providers/store.mjs';

const nativeNow = Date.now;
const count = (object, key) => Number(object?.[key]?.value || 0);
const assumedBytes = value => quantity(value, 'byte', { provenance: 'assumed', source: 'RTDB JSON/protocol model: 512 response bytes and 256 request bytes per SDK exchange; TLS separate' });
export async function createController() {
  if (process.env.PERSISTENCE_E2E !== '1' || process.env.GCLOUD_PROJECT !== 'demo-public-persistence') throw new Error('Isolated demo benchmark required');
  const bundle = await build({ entryPoints: [new URL('./browser.mjs', import.meta.url).pathname], bundle: true, platform: 'browser', format: 'iife', write: false });
  const inputBundle = await build({ entryPoints: [new URL('./browser-inputs.mjs', import.meta.url).pathname], bundle: true, platform: 'browser', format: 'iife', globalName: 'CostFixtureInputs', write: false });
  const transport = createProviderTransport(), providerOrigins = new Map();
  let inputs = createScenarioInputs({ scenario: 'setup' }), providerInputs = new Map(), participants = 0;
  state.transport = transport; selectNodeInputs(inputs);
  const indexConfig = JSON.parse(await readFile(new URL('../../api/firestore.indexes.json', import.meta.url)));
  let tail = Promise.resolve(), active = false, definitions = [], cached = new Map(), timeline = [], currentTime = nativeNow(), overheadMs = 0;
  let realtimeCache = new Map(), diagnosticReads = 0, httpRequests = 0, virtualStart = 0, wallStart = 0, stopListener = () => {};
  const exclusive = operation => {
    const result = tail.then(operation); tail = result.catch(() => {}); return result;
  };
  async function inspect(operation) {
    return exclusive(async () => {
      const previous = state.active; state.active = null;
      const start = performance.now();
      try { return await operation(); }
      finally { overheadMs += performance.now() - start; state.active = previous; }
    });
  }
  async function committed(operations) {
    const start = performance.now();
    try {
      const refs = [...new Map(operations.map(({ ref }) => [ref.path, ref])).values()];
      const snapshots = await state.nativeDb.getAll(...refs); diagnosticReads += refs.length;
      const changes = changedDocuments(cached, snapshots.map(doc => ({ path: doc.ref.path, data: doc.exists ? doc.data() : null })));
      for (const change of changes) {
        const parts = change.path.split('/');
        if (!['experiments', 'logs', 'users'].includes(parts[0])) throw new Error('Unclassified document trigger path');
        const after = { exists: change.after !== null, data: () => change.after };
        const before = { exists: change.before !== null, data: () => change.before };
        if (parts[2] === 'sessions' && parts.length === 4) {
          controller.dispatcher.event('enqueueSessionTimeout', { params: { experimentID: parts[1], sessionId: parts[3] }, data: { before, after } }, Buffer.byteLength(JSON.stringify(change)));
        }
        if (parts[4] === 'export_jobs' && parts.length === 6) {
          controller.dispatcher.event('enqueueSessionExport', { params: { experimentID: parts[1], sessionId: parts[3], revision: parts[5] }, data: { before, after } }, Buffer.byteLength(JSON.stringify(change)));
        }
      }
      recordStorage();
    } finally { overheadMs += performance.now() - start; }
  }
  function inventory(documents = cached) {
    const groups = {};
    for (const [path, data] of documents) {
      const group = path.split('/').at(-2), size = documentStorage(path, data, indexConfig);
      const entry = groups[group] ||= { documents: 0, documentBytes: 0, indexBytes: 0, storedBytes: 0, indexEntries: 0 };
      for (const key of Object.keys(entry)) entry[key] += key === 'documents' ? 1 : size[key];
    }
    return groups;
  }
  function recordStorage() {
    const groups = inventory(), bytes = Object.entries(groups).filter(([key]) => !['experiments', 'logs', 'users'].includes(key)).reduce((sum, [, value]) => sum + value.storedBytes, 0);
    timeline.push({ atSeconds: (currentTime - virtualStart + performance.now() - wallStart) / 1000, bytes });
  }
  const controller = {
    browserScript: bundle.outputFiles[0].text,
    contextOptions: { locale: 'en-US', timezoneId: 'UTC', viewport: { width: 1280, height: 720 }, screen: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 CostBenchmarkFixture/1' },
    inputConditions: () => ({ ...inputs.conditions(), participantEnvironment: controller.contextOptions }),
    async prepare(name, conditions = {}) {
      await tail; if (active) throw new Error('Cannot replace active scenario inputs');
      inputs = createScenarioInputs({ ...conditions, scenario: name }); providerInputs = new Map(); participants = 0;
      selectNodeInputs(inputs); resetStore();
      store.drive.tokens.set('token', {}); store.dropbox.tokens.set('token', {}); store.osf.tokens.set('token', {});
    },
    studyId: () => inputs.id('experiment'),
    publicCode: source => instrumentInputs(source, { scope: 'public', browser: true }),
    providerUrl(name, actual) {
      const logical = transport.register(name, actual); providerOrigins.set(name, logical); return logical;
    },
    provider(name, handler, req, res, url, body, contentType) {
      if (!providerInputs.has(name)) providerInputs.set(name, createScenarioInputs({ ...inputs.conditions(), scenario: inputs.scenario + '/provider-' + name }));
      const logical = new URL(url.pathname + url.search, providerOrigins.get(name));
      return withProviderInputs(providerInputs.get(name), () => handler(req, res, logical, body, contentType));
    },
    now: () => active ? currentTime : nativeNow(),
    advance(ms) { if (!Number.isSafeInteger(ms) || ms < 0) throw new Error('Invalid virtual advance'); currentTime += ms; },
    inspect, exclusive,
    async initialize() {
      const modules = await Promise.all([
        import('../../api/functions/experiment/sessions/api/data-router.js'),
        import('../../api/functions/experiment/sessions/timeout/functions.js'),
        import('../../api/functions/experiment/sessions/timeout/tasks.js'),
        import('../../api/functions/experiment/sessions/export/functions.js'),
        import('../../api/functions/experiment/sessions/lifecycle/presence.js'),
        import('../../api/functions/experiment/sessions/finalization/triggers.js'),
      ]);
      definitions = modules.flatMap(module => Object.entries(module).filter(([, value]) => value?.__endpoint).map(([name, value]) => registration(name, value)));
      const required = ['apiData', 'enqueueSessionTimeout', 'enqueueSessionExport', 'onSessionConnectionWritten', 'processSessionTimeout', 'processSessionExportTask', 'reconcilePendingSessionTimeouts', 'reconcilePendingSessionExports', 'finalizeDisconnectedSessions'];
      if (definitions.length !== required.length || required.some(name => !definitions.some(definition => definition.name === name))) throw new Error('Function registration inventory changed; review coverage');
      const bindings = { enqueueSessionTimeout: ['document', 'experiments/{experimentID}/sessions/{sessionId}'],
        enqueueSessionExport: ['document', 'experiments/{experimentID}/sessions/{sessionId}/export_jobs/{revision}'],
        onSessionConnectionWritten: ['ref', 'session_connections/{experimentID}/{sessionId}/{connectionId}'],
        finalizeDisconnectedSessions: ['ref', 'sessions/{experimentID}/{sessionId}'] };
      for (const [name, [kind, pattern]] of Object.entries(bindings)) {
        const actual = definitions.find(entry => entry.name === name).endpoint.eventTrigger.eventFilterPathPatterns[kind];
        if (actual?.replace(/^\//, '') !== pattern) throw new Error('Unsupported registered event path: ' + name);
      }
    },
    async begin(name, h, study) {
      await tail; if (active) throw new Error('Scenario already active');
      deliveries.length = 0; cached = new Map(); timeline = []; realtimeCache = new Map(); diagnosticReads = 0; overheadMs = 0; httpRequests = 0;
      currentTime = nativeNow(); virtualStart = currentTime; wallStart = performance.now();
      if (study) {
        const ref = state.nativeDb.doc('experiments/' + study.id), snapshot = await ref.get();
        cached.set(ref.path, snapshot.data());
      }
      const owner = await state.nativeDb.doc('users/owner').get(); cached.set(owner.ref.path, owner.data());
      controller.meter = createMeter({ scenario: name, environment: 'Node 22 + Firestore/RTDB emulators + system Chromium + local provider HTTP', clock: () => performance.now() - overheadMs, maxEvidencePerMetric: 128 });
      controller.observedDb = observeFirestore(state.nativeDb, controller.meter, { queryIndexReads: indexReadUnits, onCommitted: committed });
      controller.dispatcher = createDispatcher({ meter: controller.meter, definitions, queue: deliveries, now: () => currentTime });
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
          const [experimentID, sessionId, connectionId] = change.path.split('/');
          controller.meter.add('rtdb.presenceChanges', 1, { source: 'RTDB emulator change observed by benchmark infrastructure; not an extra application read' });
          controller.dispatcher.event('onSessionConnectionWritten', { params: { experimentID, sessionId, connectionId }, data: {
            before: { val: () => change.before }, after: { val: () => change.after },
          } }, Buffer.byteLength(JSON.stringify(change)));
        }
        if (all.sessions && Object.keys(all.sessions).length) controller.meter.unknown('rtdb.legacyCoverage', 'count', 'Unexpected legacy /sessions writes need trigger replay');
      };
      root.on('value', listener); stopListener = () => root.off('value', listener);
      active = true; state.active = controller; recordStorage();
    },
    realtime(database) {
      if (!controller.rtdbWrappers.has(database)) controller.rtdbWrappers.set(database, observeRealtimeDatabase(database, controller.meter, {
        transferBytes: ({ direction, payloadJsonBytes = 0 }) => ({ download: assumedBytes((direction === 'read' ? payloadJsonBytes : 0) + 512), upload: assumedBytes((direction === 'write' ? payloadJsonBytes : 0) + 256) }),
      }));
      return controller.rtdbWrappers.get(database);
    },
    async attach(context) {
      const conditions = { ...inputs.conditions(), participant: ++participants };
      await context.addInitScript(inputBundle.outputFiles[0].text + '\nCostFixtureInputs.installBrowserInputs(window, ' + JSON.stringify(conditions) + ');');
      await context.exposeBinding('__benchmarkMetric', (_source, method, args) => {
        if (!active) return;
        if (!['add', 'addQuantity', 'unknown'].includes(method)) throw new Error('Invalid browser observation');
        // Add environment explicitly; browser operations never inherit a function invocation.
        if (method === 'add') args[2] = { environment: 'Chromium Firebase compat SDK', ...args[2] };
        controller.meter[method](...args);
      });
    },
    http(handler, req, res) {
      return exclusive(async () => {
        if (!active) throw new Error('Public request outside measured scenario');
        httpRequests++;
        controller.meter.add('http.requests', 1);
        controller.meter.add('http.requestContentBytes', Buffer.byteLength(JSON.stringify(req.body)), { unit: 'byte', source: 'HTTP JSON entity, excludes wire overhead' });
        const nativeJson = res.json;
        res.json = function (value) {
          if (res.statusCode >= 400) controller.meter.add('http.errorResponses', 1);
          controller.meter.add('http.responseContentBytes', Buffer.byteLength(JSON.stringify(value)), { unit: 'byte', source: 'HTTP JSON entity, excludes wire overhead' });
          return nativeJson.call(this, value);
        };
        await controller.meter.wrapFunction('apiData', handler, { origin: 'http' })(req, res);
        await controller.dispatcher.pump();
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
        const result = { ...controller.meter.snapshot(), inventory: retainedInventory, inventoryVerifiedAgainstEmulator: isDeepStrictEqual(retainedInventory, inventory(nativeInventory)), storageTimeline: timeline,
          retainedRtdbJsonBytes: Buffer.byteLength(JSON.stringify(nativeTree.val() || {})),
          pending: controller.dispatcher.pending(), virtualSeconds: (currentTime - virtualStart) / 1000,
          overhead: { diagnosticReads, localInspectionMs: overheadMs, note: 'Unpriced benchmark-only snapshot reads, setup, validation, browser instrumentation and emulator traffic; inspection time excluded from local function samples' }, httpRequests,
          registrations: definitions.map(({ handler, ...definition }) => { void handler; return definition; }) };
        active = false; state.active = null; controller.failure = null; return result;
      });
    },
    stop() { active = false; state.active = null; state.transport = null; selectNodeInputs(null); stopListener(); },
    metric(name) { return count(controller.meter.snapshot().metrics, name); },
  };
  return controller;
}
