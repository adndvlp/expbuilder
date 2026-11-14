import { before, after, test as nodeTest } from 'node:test';
import process from 'node:process';
import console from 'node:console';
import { performance } from 'node:perf_hooks';
import { setTimeout } from 'node:timers';
import { URL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startHarness } from '../../api/persistence-e2e/harness.mjs';
import { createController } from './controller.mjs';
import { state } from './bridge.mjs';
import { referenceBudgets, renderReference } from './budget.mjs';
import { persistenceRepeatability } from './repeatability.mjs';
import { readFile } from 'node:fs/promises';
let h, controller, editor, currentPage;
const contentChecks = process.env.COST_CONTENT_CHECKS === '1';
const contentComparisons = [];
const costProfile = JSON.parse(await readFile(new URL('../profiles/google-cloud-usd-2026-11-13.json', import.meta.url)));
const scenarios = [], executionStart = performance.now();
const test = (name, run) => nodeTest(name, { timeout: 60000 }, run);
before(async () => {
  try { controller = await createController(); h = await startHarness({ benchmark: controller }); await controller.initialize(); editor = await h.authoring(); }
  catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; }
});
after(async () => {
  try {
    if (scenarios.length) {
      const output = process.env.COST_BENCHMARK_OUTPUT; await mkdir(output, { recursive: true });
      if (contentChecks) {
        const evidence = { purpose: 'Controlled content, storage and modeled costs with native IO delays; not approval of a reference or consumption target', comparisons: contentComparisons, cases: scenarios.map(({ name, inputs, controlledInputs, functional, storageTiming, overhead }) => ({ name, inputs, controlledInputs, functional, storageTiming, overhead })) };
        await writeFile(path.join(output, 'content-checks.json'), JSON.stringify(evidence, null, 2) + '\n');
        return;
      }
      const files = [...new Set([...execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z', 'api/functions', 'api/persistence-e2e', 'client/src', 'server/dynamicplugin', 'server/jspsych-bundle', 'benchmarks', 'package.json', 'scripts/persistence-sdk.mjs'], { cwd: process.env.PERSISTENCE_E2E_ROOT }).toString().split('\0'), 'server/dynamicplugin/dist/index.iife.js', 'server/jspsych-bundle/index.js'])].filter(file => /\.(mjs|js|ts|tsx|json)$/.test(file) && !file.startsWith('benchmarks/references/')).sort();
      const digest = createHash('sha256');
      for (const file of files) { digest.update(file + '\0'); digest.update(await readFile(path.join(process.env.PERSISTENCE_E2E_ROOT, file))); }
      const reference = { format: 1, purpose: 'Current persistence consumption reference; not an approved cost target',
        measuredCode: { sha256: digest.digest('hex'), files: files.length, scope: 'Tracked and new runtime, benchmark, harness, source and package files; excludes generated reference artifacts' },
        revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: process.env.PERSISTENCE_E2E_ROOT, encoding: 'utf8' }).trim(),
        workingTree: execFileSync('git', ['diff', '--stat'], { cwd: process.env.PERSISTENCE_E2E_ROOT, encoding: 'utf8' }).trim(),
        createdAt: new Date().toISOString(), machine: { node: process.version, platform: process.platform, arch: process.arch, browser: h.browser.version() },
        benchmarkRuntimeMs: performance.now() - executionStart, scenarios,
        repeatability: await persistenceRepeatability(scenarios) };
      const profile = JSON.parse(await readFile(new URL('../profiles/google-cloud-usd-2026-11-13.json', import.meta.url)));
      const budgets = referenceBudgets(reference, profile);
      const artifacts = { 'reference.json': JSON.stringify(reference, null, 2) + '\n', 'budget.json': JSON.stringify(budgets, null, 2) + '\n', 'README.md': renderReference(reference, budgets) };
      const artifactBytes = Object.fromEntries(Object.entries(artifacts).map(([name, value]) => [name, new globalThis.TextEncoder().encode(value).byteLength]));
      if (Object.values(artifactBytes).reduce((a, b) => a + b, 0) > 16 * 1024 * 1024) throw new Error('Benchmark artifacts exceed the 16MiB output limit; review report size');
      for (const [name, value] of Object.entries(artifacts)) await writeFile(path.join(output, name), value);
      await writeFile(path.join(output, 'artifact-sizes.json'), JSON.stringify({ artifactBytes, retention: 'Local files under user control; this runner creates no hosted artifacts, uploads or scheduled telemetry' }, null, 2));
    }
  } finally { controller?.stop(); await h?.close(); }
});
const inspect = operation => controller.inspect(operation);
const wait = predicate => h.wait(() => inspect(predicate));
const session = (study, sid) => h.session(study.id, sid);
async function prepare(options) {
  await resetFixtures();
  return h.study(options);
}
async function resetFixtures() {
  await editor?.reset();
  await inspect(async () => {
    const bulk = h.db.bulkWriter(); await h.db.recursiveDelete(h.db.collection('experiments'), bulk); await bulk.close();
  });
}
async function scenario(name, inputs, run) {
  await controller.prepare(name, inputs);
  const study = inputs.visual ? await visual(inputs) : await prepare(inputs);
  await controller.begin(name, h, study);
  let functional;
  try {
    functional = await run(study);
    // Timed-out setup/disconnect tasks still execute after normal completion.
    h.advance(120000); await controller.pump();
    assert.equal(controller.dispatcher.pending().futureTasks, 0, 'Include stale delayed deliveries in the workload');
    assert.equal(controller.dispatcher.pending().events, 0, 'Include registered trigger retries in the workload');
  }
  catch (error) {
    if (currentPage && !currentPage.isClosed()) {
      error.message += '\nPage: ' + await currentPage.locator('body').innerText();
      error.message += '\nBrowser: ' + JSON.stringify(await currentPage.evaluate(() => globalThis.window.__benchmarkErrors || []));
    }
    const measured = await controller.finish(h); scenarios.push({ name, inputs, controlledInputs: controller.inputConditions(), ...measured, functional: { passed: false, reason: error.message } }); throw error;
  }
  const measured = await controller.finish(h);
  scenarios.push({ name, inputs, controlledInputs: controller.inputConditions(), ...measured, functional: { passed: true, ...functional } });
  assert.deepEqual(measured.coverageIssues, [], 'Every applicable SDK operation must be measured');
  assert.ok(measured.functions.enqueueSessionTimeout, 'Session document triggers, including no-op invocations, must be replayed');
}
async function pageFor(study) {
  const page = await h.newPage();
  currentPage = page;
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => { controller.failure = error; });
  await page.addInitScript(() => { globalThis.window.__benchmarkErrors = []; const original = console.error; console.error = (...args) => { globalThis.window.__benchmarkErrors.push(args.map(value => String(value)).join(' ')); original(...args); }; });
  await page.goto(study.url);
  return page;
}
async function complete(page) {
  try { await page.getByText('Experiment complete. Thank you!').waitFor({ timeout: 30000 }); }
  catch (error) { throw new Error((await page.locator('body').innerText()) + '; harness: ' + h.errors.join('; '), { cause: error }); }
  await page.evaluate(() => globalThis.window.__benchmarkDrain());
}
async function answer(page, count) {
  for (let index = 0; index < count; index++) {
    await page.locator('#answer').click();
    // Wait for the queued response to leave the persistence barrier.
    await page.waitForFunction(() => !globalThis.window.ExpBuilderPersistence.pendingCount());
  }
}
async function verified(study, sid, expected) {
  const result = await inspect(() => h.result(study.id, sid));
  assert.equal(result.rows.length, expected); assert.equal(result.providerFiles, 1); assert.equal(result.pending, 0);
  assert.equal(new Set(result.rows.map(row => row.event_id)).size, expected);
  assert.deepEqual(result.rows.map(row => Number(row.event_sequence)), Array.from({ length: expected }, (_, index) => index));
  assert.equal(result.session.exportStatus, 'confirmed');
  return result;
}
async function closePage(page, study, sid) {
  // Ordinary disconnects have a declared boundary. Lost acknowledgements are
  // separate fault scenarios; native scheduling must not randomly inject one.
  await page.evaluate(() => globalThis.window.__costInputs.whenResponsesSettled());
  await page.evaluate(() => globalThis.window.__benchmarkDrain());
  await page.evaluate(() => globalThis.window.__costInputs.prepareDisconnect());
  await page.close();
  await wait(async () => ['disconnected', 'expired', 'completed'].includes((await session(study, sid)).lifecycle));
  await controller.pump();
}
async function visual(inputs) {
  await resetFixtures();
  const author = editor.create(); await author.createExperiment('Three visual trials');
  for (const alias of ['first', 'second', 'third']) {
    await author.createTrial(alias);
    await author.configureDynamicButtonTrial(alias);
    const component = (type, values) => ({ type, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, ['coordinates', 'width', 'height'].includes(key) ? value : { source: 'typed', value }])) });
    await author.client.updateTrial(author.experimentId, author.id(alias), { columnMapping: {
      components: { source: 'typed', value: [
        component('TextComponent', { name: 'title', text: alias, coordinates: { x: 0, y: 65 }, width: 40, height: 10, font_size: 24, color: '#111111' }),
        component('TextComponent', { name: 'description', text: 'Fixture with three components', coordinates: { x: 0, y: 35 }, width: 40, height: 10, font_size: 16, color: '#111111' }),
      ] },
      response_components: { source: 'typed', value: [component('ButtonResponseComponent', { name: 'answer', choices: ['Continue'], coordinates: { x: 0, y: 0 }, width: 18, height: 6 })] },
      require_response: { source: 'typed', value: true }, response_ends_trial: { source: 'typed', value: true },
    } });
  }
  return editor.publish(author, inputs);
}
test('idle: registered schedules execute once per minute', async () => {
  await controller.prepare('idle');
  await resetFixtures();
  await controller.begin('idle', h);
  h.advance(60000); await controller.pump();
  const report = await controller.finish(h);
  assert.equal(report.functions.reconcilePendingSessionTimeouts.metrics['functions.invocations'].value, '1');
  assert.equal(report.functions.reconcilePendingSessionExports.metrics['functions.invocations'].value, '1');
  assert.equal(report.metrics['firestore.readUnits'].value, '3');
  assert.deepEqual(report.coverageIssues, []);
  scenarios.push({ name: 'idle', inputs: { seconds: 60, sessions: 0 }, controlledInputs: controller.inputConditions(), ...report, functional: { passed: true } });
});
if (!contentChecks) {
for (const indexed of [true, false]) for (const size of [0, 1, 3]) {
  test(`normal: indexed=${indexed} batch=${size}`, () => scenario(`normal-${indexed}-${size}`, { indexed, size, count: 5, timeout: 1 }, async study => {
    const page = await pageFor(study); await complete(page); const sid = await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID);
    const result = await verified(study, sid, 5);
    assert.deepEqual(result.rows.map(row => row.response), ['A,quoted', 'B\nline', 'C"quote', 'D', 'E']);
    await page.context().close(); await controller.pump();
    return { events: 5, csvRows: result.rows.length };
  }));
}
for (const count of [3, 30, 300]) test(`volume: ${count} events`, () => scenario(`volume-${count}`, { indexed: true, size: 10, count, payloadBytes: 128, timeout: 1 }, async study => {
  const page = await pageFor(study); await complete(page); const sid = await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID);
  const result = await verified(study, sid, count);
  assert.ok(result.rows.every(row => row.benchmark_padding === 'x'.repeat(128)));
  await page.context().close(); await controller.pump(); return { events: count, csvRows: count, paddingBytesPerEvent: 128 };
}));
for (const indexed of [true, false]) test(`visual: 3 trials with 3 components / ${indexed}`, () => scenario(`visual-${indexed}`, { visual: true, indexed, size: 1, timeout: 1 }, async study => {
  const page = await pageFor(study);
  for (let trial = 0; trial < 3; trial++) {
    const canvas = page.locator('#jspsych-dynamic-plugin-container [data-dynamic-scene]');
    await canvas.waitFor(); const bounds = await canvas.boundingBox();
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.waitForTimeout(100); await page.waitForFunction(() => !globalThis.window.ExpBuilderPersistence.pendingCount());
  }
  await complete(page); const sid = await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID);
  const received = await inspect(() => session(study, sid));
  const result = await verified(study, sid, received.receivedEventCount);
  assert.equal(result.rows.filter(row => row.trial_type === 'DynamicPlugin').length, 3);
  await page.context().close(); await controller.pump(); return { trials: 3, componentsPerTrial: 3, events: result.rows.length };
}));
for (const indexed of [true, false]) test(`resume before timeout / ${indexed}`, () => scenario(`resume-${indexed}`, { indexed, size: 1, timeout: 1, auto: false, count: 5 }, async study => {
  let page = await pageFor(study); await answer(page, 2); const sid = await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID), context = page.context();
  await closePage(page, study, sid); h.advance(30000); await controller.pump();
  page = await context.newPage(); await page.goto(study.url); assert.equal(await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID), sid);
  await answer(page, 3); await complete(page); await verified(study, sid, 5);
  await context.close(); h.advance(90000); await controller.pump();
  return { events: 5, sameSession: true, staleTimeoutTasksDelivered: true };
}));
for (const { size, indexed } of [{ size: 0, indexed: true }, { size: 3, indexed: true }, { size: 1, indexed: false }]) test(`expiry and recovery to original session / indexed=${indexed} batch=${size}`, () => scenario(`expiry-${indexed}-${size}`, { indexed, size, timeout: 1, auto: false, count: 5 }, async study => {
  let page = await pageFor(study); await answer(page, 2); const sid = await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID), context = page.context();
  await closePage(page, study, sid);
  assert.equal((await inspect(() => session(study, sid))).receivedEventCount, indexed ? 0 : 2);
  const deadline = (await inspect(() => session(study, sid))).resumeExpiresAt;
  h.advance(deadline - controller.now() + 1); await controller.pump();
  assert.equal((await inspect(() => session(study, sid))).lifecycle, 'expired');
  if (indexed) assert.equal((await inspect(() => session(study, sid))).exportResource, undefined, 'No server response data means no CSV before browser recovery');
  else await verified(study, sid, 2);
  page = await context.newPage(); await page.goto(study.url);
  await page.getByRole('button', { name: 'Start a new participation' }).waitFor();
  await wait(async () => (await session(study, sid)).exportReceipt?.eventCount === 2);
  await page.getByText('This session has ended. The available responses have been saved.').waitFor();
  await verified(study, sid, 2); assert.equal(await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID), sid);
  assert.equal(await page.getByText('This session has ended. The available responses have been saved.').isVisible(), true,
    'Recovery must finish in the participant browser before closing its context');
  await context.close(); await controller.pump(); return { events: 2, sameSession: true, browserRecoveryConfirmed: true, serverOnlyTimeoutCannotSaveBrowserData: indexed };
}));
for (const indexed of [true, false]) test(`lost append acknowledgement / ${indexed}`, () => scenario(`lost-ack-${indexed}`, { indexed, size: 1, count: 5, auto: false, timeout: 1 }, async study => {
  const page = await pageFor(study); h.loseNextAppend(); await answer(page, 1);
  if (!indexed) {
    await h.wait(async () => (await page.getByRole('button', { name: 'Retry saving' }).count()) || h.requests.filter(request => request.action === 'appendEvents' && request.experimentID === study.id).length >= 2);
    if (await page.getByRole('button', { name: 'Retry saving' }).count()) await page.getByRole('button', { name: 'Retry saving' }).click();
  }
  await answer(page, 4); await complete(page); const sid = await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID);
  await verified(study, sid, 5); await page.context().close(); await controller.pump(); return { events: 5, unique: true };
}));
test('task enqueue failure uses the registered trigger retry', () => scenario('enqueue-failure', { indexed: true, size: 1, count: 5 }, async study => {
  state.failEnqueue = true; const page = await pageFor(study);
  await h.wait(() => controller.metric('tasks.enqueueFailures') >= 1);
  await controller.pump();
  h.advance(31000); await controller.pump(); await complete(page); const sid = await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID);
  await verified(study, sid, 5); assert.ok(controller.metric('tasks.enqueueFailures') >= 1);
  assert.ok(controller.metric('events.retries') >= 1);
  await page.context().close(); await controller.pump(); return { events: 5, injectedPlatformFailure: true };
}));
for (const provider of ['googledrive', 'dropbox', 'osf']) test(`provider write acknowledgement lost / ${provider}`, () => scenario(`provider-lost-${provider}`, { provider, indexed: true, size: 1, count: 5 }, async study => {
  h.faults.push({ provider, method: provider === 'osf' ? 'PUT' : 'POST', path: provider === 'googledrive' ? '/upload/' : provider === 'dropbox' ? '/upload' : '/osfstorage', mode: 'lost' });
  const page = await pageFor(study), sid = await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID);
  await wait(async () => (await session(study, sid))?.exportStatus === 'reconciling');
  h.advance(31000); await controller.pump(); await complete(page); await verified(study, sid, 5);
  assert.ok(controller.metric('provider.' + provider + '.transportFailures') >= 1);
  await page.context().close(); await controller.pump(); return { events: 5, uniqueFile: true };
}));
} else {
  for (const options of [
    { provider: 'googledrive', indexed: true }, { provider: 'googledrive', indexed: false },
    { provider: 'dropbox', indexed: true }, { provider: 'osf', indexed: true },
    { provider: 'googledrive', indexed: true, visual: true }, { provider: 'googledrive', indexed: false, visual: true },
  ]) test('controlled content: ' + JSON.stringify(options), async () => {
    const captures = [], name = 'controlled-' + JSON.stringify(options);
    for (let repetition = 0; repetition < 2; repetition++) {
      await scenario(name, { ...options, size: 1, timeout: 1, count: 3 }, async study => {
        controller.setNativeDelay(repetition ? 20 : 0);
        const start = h.requests.length, page = await pageFor(study);
        if (options.visual) {
          for (let trial = 0; trial < 3; trial++) {
            const canvas = page.locator('#jspsych-dynamic-plugin-container [data-dynamic-scene]');
            await canvas.waitFor(); const bounds = await canvas.boundingBox();
            await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.waitForFunction(() => !globalThis.window.ExpBuilderPersistence.pendingCount());
          }
        }
        await complete(page);
        const sid = await page.evaluate(() => globalThis.window.JSPSYCH_SESSION_ID);
        const received = await inspect(() => session(study, sid));
        const result = await verified(study, sid, received.receivedEventCount);
        const browser = h.requests.slice(start).filter(request => request.action === 'appendEvents').flatMap(request => request.data.events);
        captures.push({ browser: JSON.parse(JSON.stringify(browser)), rows: result.rows });
        await page.context().close(); await controller.pump();
        return { passed: true, events: result.rows.length, csvHash: createHash('sha256').update(JSON.stringify(result.rows)).digest('hex') };
      });
      const measured = scenarios.at(-1), idle = scenarios.find(item=>item.name==='idle');
      const budget = referenceBudgets({scenarios:[idle,measured]},costProfile).scenarios[0];
      for (const variant of ['low','nominal','high']) {
        assert.equal(budget[variant].status, 'complete');
        assert.ok(budget[variant].projections.every(row=>row.total !== null), 'Equal incomplete subtotals must never pass as equal modeled costs');
      }
      captures.at(-1).storageTimeline = measured.storageTimeline;
      captures.at(-1).timing = measured.storageTiming;
      captures.at(-1).money = Object.fromEntries(['low','nominal','high'].map(variant=>[variant,{projections:budget[variant].projections, quantities:budget[variant].items.map(item=>({id:item.id,quantity:item.quantity.value,unit:item.quantity.unit}))}]));
      if (repetition) assert.ok(measured.overhead.injectedDelayMs > 0, 'The second execution must actually include native delays');
    }
    try {
      assert.deepEqual(captures[1], captures[0], 'Submitted envelopes, CSV, controlled storage and modeled costs must repeat despite native IO delays');
      contentComparisons.push({ name, passed: true, completeBudgets:true, pricedVariants:['low','nominal','high'], nativeDelayMs:20 });
    } catch (error) { contentComparisons.push({ name, passed: false, reason: error.message }); throw error; }
  });
}
