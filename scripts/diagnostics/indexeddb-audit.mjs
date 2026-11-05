// Run from the repository root: node scripts/diagnostics/indexeddb-audit.mjs
// These assertions reproduce known failures; exit 0 means the symptoms were
// reproduced, not that persistence is correct. Cloud services are stubbed.
// Optional argument: the contents of the published HTML's generated-script.
// AUDIT_CHROMIUM=1 also checks the batch race using actual browser IndexedDB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(path.join(root, 'client/package.json'));
const ts = require('typescript');
const base = 'client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/';
const quiet = { log() {}, warn() {}, error() {} };
function load(file, stubs = {}, cache = new Map()) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} };
  cache.set(absolute, module);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (name) => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (!name.startsWith('.')) throw new Error('Unstubbed dependency: ' + name);
    let dependency = path.resolve(path.dirname(absolute), name);
    if (!fs.existsSync(dependency)) dependency += '.ts';
    return load(dependency, stubs, cache);
  };
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', { console: quiet })(localRequire, module, module.exports);
  return module.exports;
}
const options = {
  DATA_API_URL: '/apiData', FIREBASE_DATABASE_URL: 'https://example.invalid',
  experimentID: 'audit', useStorage: 'googledrive',
  batchConfig: { useIndexedDB: true, batchSize: 1, resumeTimeoutMinutes: 1 },
  recruitmentConfig: { platform: 'none', prolificCompletionCode: '' },
  captchaConfig: { enabled: false, provider: 'hcaptcha', siteKey: '' },
  sessionNameTokens: [], sessionNameSeparator: '_', currentUid: 'audit-user',
  evaluateCondition: '', branchingEvaluation: '', customPreInitCode: {},
  publicParams: {}, extensions: '', progressBar: false, baseCode: '',
};
const generated = (name, opts = options) => load(base + name + '.ts')[name](opts);
const published = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const clientCode = published
  ? published.slice(published.indexOf('// Track pending batch saves'), published.indexOf('// __INIT_JSPSYCH_END__'))
  : (generated('publicBatchCode') + generated('publicInitCode') + generated('publicFinishCode')).split('// __INIT_JSPSYCH_END__')[0];
const memoryStorage = () => {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)), removeItem: k => values.delete(k) };
};
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
const ok = { ok: true, json: async () => ({ success: true }), text: async () => '' };
function runtime({ indexed = true, size = 1, fetch = async () => ok, rows = [] } = {}) {
  const state = { acknowledged: [], updates: [], success: false, reads: 0, writes: 0 };
  const db = {
    init: async () => {}, add: async row => { rows.push({ ...row }); state.writes++; },
    count: async () => rows.length, getN: async n => rows.slice(0,n),
    getAll: async () => { state.reads++; return rows.slice(); },
    deleteN: async n => { rows.splice(0,n); }, clear: async () => { rows.length = 0; },
  };
  const firebaseDatabase = Object.assign(() => ({}), { ServerValue: { TIMESTAMP: 1 } });
  const context = {
    console: quiet, setTimeout, fetch, metadata: {}, trialSessionId: 'S1',
    BATCH_CONFIG: { useIndexedDB: indexed, size, currentBatchNumber: 0 }, TrialDB: db,
    _publicStorageKeys: { resumeTrial: 'resume', sessionId: 'session', participant: 'participant' },
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    document: { querySelectorAll: () => [] },
    sessionRef: { update: async data => { state.updates.push(data); }, onDisconnect: () => ({ cancel() {} }) },
    window: { firebase: { database: firebaseDatabase }, ExpBuilderNavigation: {
      checkpointTrialStart() {}, onTrialPersisted: data => state.acknowledged.push(data.builder_id),
      isTransitionPending: () => false, clearTransientState() {},
    } },
    _createResumeCheckpoint: data => ({ builderId: data.builder_id, trialIndex: data.trial_index }),
    _showLoading() {}, _setLoadingMsg() {}, _showSuccess: () => { state.success = true; },
    initJsPsych: callbacks => { state.callbacks = callbacks; return { data: { get: () => ({}) } }; },
  };
  vm.runInNewContext(load('client/src/pages/ExperimentBuilder/modules/experiment-runtime/persistenceCoordinator.ts').getPersistenceCoordinatorRuntimeCode(), context);
  vm.runInNewContext(clientCode, context);
  return { state, context, db, rows, callbacks: state.callbacks };
}
const trial = id => ({ builder_id: id, trial_index: id === 'A' ? 0 : 1, trial_type: 'audit' });
const findings = [];
async function reproduce(name, fn) {
  await fn();
  findings.push(name);
  console.log('REPRODUCED: ' + name);
}
function backend(fail = false) {
  const state = { calls: 0, updates: [] };
  const { finalizeDisconnectedSessions } = load('api/functions/experiment/sessions/finalization/triggers.js', {
    'firebase-functions/v2/database': { onValueWritten: (_, handler) => handler },
    './finalize.js': { finalizeSession: async () => { state.calls++; if (fail) throw new Error('TEMPORARY_DRIVE_FAILURE'); return { resultsSent: 2 }; } },
    './resume-expiration.js': { scheduleResumeExpiration: async () => {} },
    './file-url.js': { lookupSessionFileUrl: async () => null },
    './trigger-metadata.js': { saveAbandonedNoDataMetadata: async () => {}, saveIndexedDbSessionMetadata: async () => {} },
  });
  const event = after => ({ params: { experimentID: 'audit', sessionId: 'S1' }, data: {
    before: { val: () => ({ connected: true }) },
    after: { val: () => after, ref: { update: async data => state.updates.push(data) } },
  } });
  return { state, trigger: finalizeDisconnectedSessions, event };
}

await reproduce('IndexedDB completion skips Drive finalization (control without IndexedDB uploads)', async () => {
  for (const indexed of [false, true]) {
    const b = backend();
    await b.trigger(b.event({ connected: false, state: 'completed', finished: true, useIndexedDB: indexed, needsFinalization: true }));
    assert.equal(b.state.calls, indexed ? 0 : 1);
    assert.equal(b.state.updates[0].finalizationProcessed, true);
  }
});
await reproduce('Transient finalization error permanently blocks retry', async () => {
  const b = backend(true);
  const after = { connected: false, state: 'completed', finished: true, useIndexedDB: false, needsFinalization: true };
  await b.trigger(b.event(after));
  assert.equal(b.state.updates[0].finalizationError, 'TEMPORARY_DRIVE_FAILURE');
  await b.trigger(b.event({ ...after, ...b.state.updates[0] }));
  assert.equal(b.state.calls, 1);
});
await reproduce('Overlapping batches send A twice and delete B without sending B', async () => {
  const uploads = [], gates = [deferred(), deferred()], arrived = [deferred(), deferred()];
  const r = runtime({ fetch: async (_, init) => {
    const index = uploads.length;
    uploads.push(JSON.parse(JSON.parse(init.body).data.trialsData));
    arrived[index].resolve(); await gates[index].promise; return ok;
  } });
  const first = r.callbacks.on_data_update(trial('A'));
  await arrived[0].promise;
  const second = r.callbacks.on_data_update(trial('B'));
  await arrived[1].promise;
  gates[0].resolve(); await first;
  gates[1].resolve(); await second;
  assert.deepEqual(uploads.map(batch => batch.map(row => row.builder_id)), [['A'], ['A']]);
  assert.equal(r.rows.length, 0);
});
await reproduce('Network failure without IndexedDB advances checkpoint and still announces success', async () => {
  const r = runtime({ indexed: false, fetch: async () => { throw new Error('offline'); } });
  await r.callbacks.on_data_update(trial('A'));
  assert.equal(JSON.parse(r.context.localStorage.getItem('resume')).builderId, 'A');
  assert.equal(r.state.acknowledged.length, 0);
  await r.callbacks.on_finish();
  assert.equal(r.state.success, true);
  assert.equal(r.state.updates.at(-1).finished, true);
});
await reproduce('IndexedDB write failure advances checkpoint and still completes with no trial', async () => {
  const r = runtime();
  r.db.add = async () => { throw new Error('quota exceeded'); };
  await r.callbacks.on_data_update(trial('A'));
  assert.equal(JSON.parse(r.context.localStorage.getItem('resume')).builderId, 'A');
  assert.equal(r.rows.length, 0);
  await r.callbacks.on_finish();
  assert.equal(r.state.success, true);
});
await reproduce('Completion without IndexedDB runs before the last request is acknowledged', async () => {
  const gate = deferred(), arrived = deferred();
  let saved = false;
  const r = runtime({ indexed: false, fetch: async () => { arrived.resolve(); await gate.promise; saved = true; return ok; } });
  const pending = r.callbacks.on_data_update(trial('A'));
  await arrived.promise;
  await r.callbacks.on_finish();
  assert.equal(saved, false);
  assert.equal(r.state.success, true);
  gate.resolve(); await pending;
});
await reproduce('Turning IndexedDB off completes without draining existing local trials', async () => {
  const rows = [{ ...trial('A'), sessionId: 'S1' }];
  const requests = [];
  const r = runtime({ indexed: false, rows, fetch: async (_, init) => { requests.push(JSON.parse(init.body)); return ok; } });
  await r.callbacks.on_data_update(trial('B'));
  await r.callbacks.on_finish();
  assert.equal(rows.length, 1);
  assert.equal(r.state.reads, 0);
  assert.equal(requests.some(request => request.data.builder_id === 'A'), false);
  // The next publication with IndexedDB starts another session and clears this old row.
  const context = { ...r.context, participantNumber: 0, isResuming: false, trialSessionId: 'S2',
    storedParticipantNumber: null, _resolveResumeBranch: () => null, createSession: async () => 1,
    _sessionNameHasDynamic: () => false, waitForFirebase: async () => new Promise(() => {}),
  };
  const bootstrap = published
    ? published.slice(published.indexOf('(async () => {\n    // --- CAPTCHA gate'))
    : generated('publicBootstrapCode');
  vm.runInNewContext(bootstrap + (published ? '' : '\n})();'), context);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(rows.length, 0);
});

await reproduce('Batch zero changes participant on reload and counts the same finished session multiple times', async () => {
  const records = new Map([['experiments/audit', { active: true, nConditions: 1, currentCondition: 0, sessions: 0, owner: 'audit' }]]);
  const ref = key => ({
    collection: name => ({ doc: id => ref(key + '/' + name + '/' + id) }),
    get: async () => ({ exists: records.has(key), data: () => records.get(key) }),
    set: async (data, opts) => {
      const before = records.get(key) ?? {};
      const next = Object.fromEntries(Object.entries(data).map(([k,v]) => [k, v?.increment ? (before[k] ?? 0) + v.increment : v]));
      records.set(key, opts?.merge ? { ...before, ...next } : next);
    },
  });
  const db = { collection: name => ({ doc: id => ref(name + '/' + id) }),
    runTransaction: async fn => fn({ get: r => r.get(), set: (r,data,opts) => r.set(data,opts) }),
  };
  const stubs = {
    'firebase-admin/firestore': { FieldValue: { increment: n => ({ increment: n }) } },
    '../../../app.js': { db }, '../logging/write-log.js': { default: async () => {} },
    '../../api/messages.js': { default: {} },
    'firebase-functions/v2/https': { onRequest: (_, handler) => handler },
    'json2csv': createRequire(path.join(root, 'api/functions/package.json'))('json2csv'),
    '../../../oauth/index.js': { getValidToken: async () => ({ success: true, access_token: 'stub' }) },
    '../storage.js': { appendResult: async () => ({ success: true, id: 'file' }) },
  };
  const create = load('api/functions/experiment/sessions/handlers/create-session.js', stubs).handleCreateSession;
  const complete = load('api/functions/experiment/sessions/api/data-complete.js', stubs).apiDataComplete;
  const response = () => ({ status() { return this; }, json(body) { this.body = body; } });
  const first = response(), resumed = response();
  await create({ body: { batchSize: 0 } }, first, 'audit', 'S1');
  await create({ body: { batchSize: 0 } }, resumed, 'audit', 'S1');
  assert.equal(first.body.participantNumber, 0);
  assert.equal(resumed.body.participantNumber, 1);
  assert.equal(records.has('experiments/audit/sessions/S1'), false);
  await complete({ body: { experimentID: 'audit', sessionId: 'S1', trialsData: [trial('A')], storage: 'googledrive' } }, response());
  assert.equal(records.get('experiments/audit').sessions, 3);
});

console.log(`${findings.length} failures reproduced against ${published ? 'published HTML callbacks' : 'current production generators'}; all network/storage providers were stubbed.`);

if (process.env.AUDIT_CHROMIUM === '1') {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.AUDIT_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const context = await browser.newContext();
    await context.route('http://audit.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
    const page = await context.newPage();
    await page.goto('http://audit.test/');
    const result = await page.evaluate(async ({ database, callbacksCode }) => {
      const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
      const uploads = [], gates = [gate(), gate()], arrived = [gate(), gate()];
      window.firebase = { database: { ServerValue: { TIMESTAMP: 1 } } };
      window.ExpBuilderPersistence = { start() {}, finish() {} };
      window.ExpBuilderNavigation = { onTrialPersisted() {}, checkpointTrialStart() {} };
      let callbacks;
      const databaseInstance = new Function('fetch', 'initJsPsych', `
        const trialSessionId = 'S1';
        const BATCH_CONFIG = { useIndexedDB: true, size: 1, currentBatchNumber: 0 };
        const metadata = {}, _publicStorageKeys = { resumeTrial: 'checkpoint' };
        const _createResumeCheckpoint = data => ({ completed: data.builder_id });
        const sessionRef = { update: async () => {} };
        ${database}
        ${callbacksCode}
        return TrialDB;
      `)(async (_, init) => {
        const index = uploads.length;
        uploads.push(JSON.parse(JSON.parse(init.body).data.trialsData));
        arrived[index].resolve(); await gates[index].promise;
        return { ok: true, json: async () => ({ success: true }) };
      }, cb => { callbacks = cb; return { data: { get: () => ({}) } }; });
      const first = callbacks.on_data_update({ builder_id: 'A', trial_index: 0 });
      await arrived[0].promise;
      const second = callbacks.on_data_update({ builder_id: 'B', trial_index: 1 });
      await arrived[1].promise;
      gates[0].resolve(); await first;
      gates[1].resolve(); await second;
      const remaining = await databaseInstance.getAll();
      databaseInstance.db.close();
      return { uploads: uploads.map(batch => batch.map(row => row.builder_id)), remaining };
    }, { database: generated('publicDatabaseCode'), callbacksCode: clientCode });
    assert.deepEqual(result.uploads, [['A'], ['A']]);
    assert.deepEqual(result.remaining, []);
    console.log('REPRODUCED IN CHROMIUM WITH REAL INDEXEDDB: A uploaded twice, B deleted unsent.');
  } finally {
    await browser.close();
  }
}
