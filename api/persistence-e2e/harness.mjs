import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { setTimeout, setInterval, clearInterval } from 'node:timers';
import { build } from '../../client/node_modules/esbuild/lib/main.js';
import { chromium } from '../../client/node_modules/playwright-core/index.mjs';
import { createRequire } from 'node:module';
const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
import express from '../../api/functions/node_modules/express/index.js';
import { readBody, sendJson } from '../mock-providers/http-utils.mjs';
import { store } from '../mock-providers/store.mjs';
import { handleGoogleDrive } from '../mock-providers/providers/google-drive.mjs';
import { handleDropbox } from '../mock-providers/providers/dropbox.mjs';
import { handleOsf } from '../mock-providers/providers/osf.mjs';
import { handleGithub } from '../mock-providers/providers/github.mjs';
import { deliveries } from './task-queue.mjs';

export async function startHarness({ benchmark } = {}) {
  if (process.env.PERSISTENCE_E2E !== '1' || process.env.GCLOUD_PROJECT !== 'demo-public-persistence'
      || !process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:') || !process.env.FIREBASE_DATABASE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw new Error('This harness requires isolated demo emulators');
  const servers = [], faults = [], errors = [], root = process.env.PERSISTENCE_E2E_ROOT, temp = process.env.PERSISTENCE_E2E_TEMP;
  const nativeNow = Date.now; let offset = 0;
  if (!benchmark) Date.now = () => nativeNow() + offset;
  const listen = async handler => {
    const server = http.createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    servers.push(server); return `http://127.0.0.1:${server.address().port}`;
  };
  const provider = (name, handler) => async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`), body = await readBody(req);
    const fault = faults.find(item => item.provider === name && item.method === req.method && (!item.path || url.pathname.includes(item.path)));
    if (fault) {
      faults.splice(faults.indexOf(fault), 1);
      if (fault.mode === 'lost') { res.end = () => { res.destroy(); return res; }; }
      else { sendJson(res, fault.status || 503, {}); return; }
    }
    try { if (benchmark) await benchmark.provider(name, handler, req, res, url, body, req.headers['content-type']);
      else await handler(req, res, url, body, req.headers['content-type']); }
    catch (error) { errors.push(error.message); if (!res.destroyed) sendJson(res, 500, {}); }
  };
  const providerUrl = async (name, handler) => { const actual = await listen(provider(name, handler)); return benchmark ? benchmark.providerUrl(name, actual) : actual; };
  process.env.GOOGLE_DRIVE_API_BASE = await providerUrl('googledrive', handleGoogleDrive);
  process.env.DROPBOX_CONTENT_BASE = process.env.DROPBOX_API_BASE = await providerUrl('dropbox', handleDropbox);
  const osfOrigin = process.env.OSF_API_BASE = await providerUrl('osf', handleOsf);
  process.env.GITHUB_API_BASE = await providerUrl('github', handleGithub);
  store.drive.tokens.set('token', {}); store.dropbox.tokens.set('token', {}); store.osf.tokens.set('token', {});
  const { db, app: adminApp } = await import('../functions/app.js');
  const { getDatabase } = requireFunctions('firebase-admin/database');
  const realtime = getDatabase(adminApp);
  const bulk = db.bulkWriter(); await db.recursiveDelete(db.collection('experiments'), bulk); await bulk.close(); await realtime.ref().set(null);
  const { apiData } = await import('../functions/experiment/sessions/api/data-router.js');
  const { publishCurrentExperiment } = await import('../functions/experiment/publish/current.js');
  const { processSessionExport } = await import('../functions/experiment/sessions/export/process.js');
  const { refreshLifecycle } = await import('../functions/experiment/sessions/lifecycle/state.js');
  const { reconcileSessionExports } = await import('../functions/experiment/sessions/export/dispatch.js');
  const { reconcileSessionTimeouts } = await import('../functions/experiment/sessions/timeout/dispatch.js');
  const { handleSessionTimeoutTask } = await import('../functions/experiment/sessions/timeout/tasks.js');
  const CSV = requireFunctions('csv-string');
  await db.collection('users').doc('owner').set(Object.fromEntries(['googleDriveTokens', 'dropboxTokens', 'osfTokens'].map(key => [key,
    { access_token: 'token', refresh_token: 'refresh', expires_at: nativeNow() + 86400000, token_type: 'Bearer' }])));
  const fixture = express(); fixture.use(express.json({ limit: '20mb' }));
  const requests = []; let dropAppend = false, heldSequence = null, releaseHeld = null;
  fixture.post('/apiData', (req, res) => {
    requests.push(req.body);
    if (req.body.action === 'appendEvents' && req.body.data?.events?.some(event => event.sequence === heldSequence)) {
      heldSequence = null; const json = res.json.bind(res); res.json = value => { releaseHeld = () => json(value); return res; };
    }
    if (dropAppend && req.body.action === 'appendEvents') { dropAppend = false; res.json = () => { res.destroy(); return res; }; }
    return benchmark ? benchmark.http(apiData, req, res) : apiData(req, res);
  });
  fixture.get('/vendor.js', async (_req, res) => res.type('js').send((await readFile(path.join(process.env.PERSISTENCE_SDK_DIR, 'firebase-app-compat.js'), 'utf8')) + '\n' + (await readFile(path.join(process.env.PERSISTENCE_SDK_DIR, 'firebase-database-compat.js'), 'utf8'))));
  fixture.get('/jspsych.js', (_req, res) => res.type('js').sendFile(path.join(root, 'server/jspsych-bundle/index.js')));
  fixture.get('/dynamic.js', (_req, res) => res.type('js').sendFile(path.join(root, 'server/dynamicplugin/dist/index.iife.js')));
  fixture.get(/.*/, (req, res) => {
    const [, id, ...parts] = req.path.split('/'), filename = parts.join('/') || 'index.html', file = store.github.contents.get(`lab/${id}/${filename}`);
    if (!file) { res.status(404).end(); return; }
    res.type(path.extname(filename)).send(Buffer.from(file.content, 'base64'));
  });
  const origin = await listen(fixture);
  await build({ stdin: { contents: `export { buildPublicExperimentCode } from '${path.join(root, 'client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/buildPublicExperimentCode.ts')}'; export { generateOnFinishCode } from '${path.join(root, 'client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onFinishGenerator.ts')}'; export { branchingEvaluationRuntimeCode } from '${path.join(root, 'client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/branchingRuntimeCode.ts')}';`, resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', outfile: path.join(temp, 'generator.mjs') });
  const { buildPublicExperimentCode, generateOnFinishCode, branchingEvaluationRuntimeCode } = await import(pathToFileURL(path.join(temp, 'generator.mjs')));
  const launch = () => chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined) });
  let browser = await launch();
  let sequence = 0, pumping = false;
  async function pump() {
    if (pumping) return; pumping = true;
    try {
      if (benchmark) { await benchmark.pump(); return; }
      await reconcileSessionTimeouts(); await reconcileSessionExports();
      for (const delivery of deliveries.splice(0)) {
        if (delivery.due > Date.now()) { deliveries.push(delivery); continue; }
        try {
          if (delivery.name.includes('processSessionExportTask')) await processSessionExport(delivery.data);
          else await handleSessionTimeoutTask(delivery.data);
        } catch (error) { errors.push(error.message); }
      }
    } finally { pumping = false; }
  }
  const timer = setInterval(() => pump().catch(error => errors.push(error.message)), 200);
  async function study({ provider: storageProvider = 'googledrive', indexed = true, size = 1, timeout = 1, auto = true, count = 5, payloadBytes = 0, baseCode, mediaFiles = [], id = benchmark ? benchmark.studyId() : `study-${++sequence}` } = {}) {
    const ids = Array.from({ length: count }, (_, i) => i+1);
    const answers = count === 5 ? ['A,quoted', 'B\nline', 'C"quote', 'D', 'E'] : ids.map(id => 'answer ' + id);
    const batchConfig = { useIndexedDB: indexed, batchSize: size, resumeTimeoutMinutes: timeout };
    const folder = `folder-${id}`;
    store.osf.nodes.set(folder, { id: folder, kind: 'nodes', attributes: {} });
    const exists = (await db.collection('experiments').doc(id).get()).exists;
    await db.collection('experiments').doc(id).set({ active: true, owner: 'owner', ...(!exists && { sessions: 0, currentCondition: 0, nConditions: 1 }),
      storageProvider, driveFolderId: folder, dropboxFolder: '/' + folder, osfUploadLink: `${osfOrigin}/v2/nodes/${folder}/files/osfstorage/`, batchConfig }, { merge: true });
    const code = buildPublicExperimentCode({ DATA_API_URL: origin + '/apiData', FIREBASE_DATABASE_URL: 'https://demo-public-persistence-default-rtdb.firebaseio.com',
      firebaseWebConfig: { apiKey: 'demo', projectId: 'demo-public-persistence', databaseURL: 'https://demo-public-persistence-default-rtdb.firebaseio.com', authDomain: 'demo', storageBucket: 'demo', messagingSenderId: 'demo', appId: 'demo' },
      experimentID: id, useStorage: storageProvider, batchConfig, recruitmentConfig: { platform: 'none', prolificCompletionCode: '' },
      captchaConfig: { enabled: false, siteKey: '', provider: 'hcaptcha' }, sessionNameTokens: [], sessionNameSeparator: '_', currentUid: 'owner',
      evaluateCondition: '', branchingEvaluation: branchingEvaluationRuntimeCode, customPreInitCode: {}, publicParams: {}, extensions: '', progressBar: false,
      baseCode: baseCode ?? `const branchParameters = null; if (branchParameters) Object.entries(branchParameters);
        class Trial { static info = { name: 'test', version: '1', parameters: {}, data: {} }; constructor(instance) { this.instance = instance; }
          trial(_display, trial) { window.__answer = () => this.instance.finishTrial({ response: trial.answer, ...(${payloadBytes} ? { benchmark_padding: 'x'.repeat(${payloadBytes}) } : {}) }); if (${auto}) window.__answer(); else { _display.innerHTML = '<button id="answer">Answer</button>'; _display.querySelector('button').onclick = window.__answer; } } }
        const answers = ${JSON.stringify(answers)};
        ${ids.map(id => `window.ExpBuilderNavigation.registerTrial(${id}, { type: Trial, answer: answers[${id-1}], data: { builder_id: ${id}, trial_id: ${id} }, ${generateOnFinishCode({ branches: id < count ? [id+1] : [], defaultNextTrialId: id < count ? id+1 : null, branchConditions: [], getVarName: name => name, isMergePoint: false })} });`).join('\n')}
        const timeline = []; window.ExpBuilderNavigation.attach(jsPsych, timeline); jsPsych.run(timeline);` });
    const port = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':')[1];
    const manifest = { version: 3, entries: { root: '1' }, loopContinuations: {}, revision: 'fixture', nextBySource: {}, scopes: { root: ids.map(String) }, allScopes: { root: ids.map(String) }, addressesByTarget: Object.fromEntries(ids.map(id => [id, { targetId: id, targetKind: 'trial', targetOwnerId: null, enterLoopIds: [] }])) };
    const htmlContent = `<html><head><script src="${origin}/vendor.js"></script><script src="${origin}/jspsych.js"></script>${benchmark && baseCode ? `<script src="${origin}/dynamic.js"></script>` : ''}</head><body><div id="jspsych-container"></div><script>
      firebase.initializeApp({ apiKey: 'demo', projectId: 'demo-public-persistence', databaseURL: 'https://demo-public-persistence-default-rtdb.firebaseio.com' }); firebase.database().useEmulator('127.0.0.1',${port});
      ${benchmark?.browserScript || ''}
      ${baseCode ? '' : `window.ExpBuilderExecutionAddresses = ${JSON.stringify(manifest)};`}
      ${benchmark ? benchmark.publicCode(code) : code}</script></body></html>`;
    await publishCurrentExperiment({ accessToken: 'token', owner: 'lab', repoName: id, experimentID: id, htmlContent, mediaFiles });
    return { id, url: `${origin}/${id}/`, indexed, size };
  }
  async function result(experimentID, sessionId) {
    const ref = db.collection('experiments').doc(experimentID).collection('sessions').doc(sessionId);
    const session = (await ref.get()).data();
    const { createExportAdapter } = await import('../functions/experiment/sessions/export/providers/index.js');
    const adapter = await createExportAdapter(session.exportDestination), file = await adapter.read(session.exportResource);
    const [header, ...cells] = CSV.parse(file.csv);
    const providerFiles = session.exportDestination.provider === 'googledrive' ? [...store.drive.files.values()].filter(file => file.name === `${experimentID}_${sessionId}.csv`).length
      : session.exportDestination.provider === 'dropbox' ? [...store.dropbox.files.keys()].filter(key => key.endsWith(`${experimentID}_${sessionId}.csv`)).length
        : [...store.osf.files.values()].filter(file => file.name === `${experimentID}_${sessionId}.csv`).length;
    return { session, rows: cells.map(row => Object.fromEntries(header.map((key, i) => [key, row[i]]))), pending: (await ref.collection('trials').get()).size, providerFiles };
  }
  return { get browser() { return browser; }, db, realtime, origin, study, result, pump, errors, faults, deliveries,
    async authoring() { const { startAuthoring } = await import('./authoring.mjs'); return startAuthoring({ listen, temp, root, study }); },
    async newPage() { await browser.close(); browser = await launch(); const context = await browser.newContext(benchmark?.contextOptions || {}); await context.route(/https:\/\//, route => route.abort()); await benchmark?.attach(context); return context.newPage(); },
    async wait(predicate, message = 'Condition did not converge') { const until = nativeNow() + 20000; while (nativeNow() < until) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); } throw new Error(message + ': ' + errors.slice(-5).join('; ')); },
    async session(id, sid) { return (await db.collection('experiments').doc(id).collection('sessions').doc(sid).get()).data(); },
    requests, hold(sequence) { heldSequence = sequence; }, release() { releaseHeld?.(); releaseHeld = null; },
    loseNextAppend() { dropAppend = true; }, advance(ms) { if (benchmark?.advance) benchmark.advance(ms); else offset += ms; }, resetClock() { offset = 0; }, refreshLifecycle,
    async close() { clearInterval(timer); while (pumping) await new Promise(resolve => setTimeout(resolve, 20)); await browser.close();
      await db.terminate(); await adminApp.delete(); Date.now = nativeNow;
      for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    } };
}
