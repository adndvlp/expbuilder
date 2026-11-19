import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.mjs';
let h, editor;
before(async () => { try { h = await startHarness(); editor = await h.authoring(); }
  catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; } });
after(async () => { await h?.close(); });
async function visible(page, alias) {
  try { await page.locator(`[data-runtime-trial="${alias}"]`).waitFor({ timeout: 5000 }); }
  catch (error) { throw new Error(`Expected ${alias}. Page: ${await page.locator('body').innerText()}`, { cause: error }); }
}
const checkpoint = page => page.evaluate(() => localStorage.getItem(`expbuilder:public:${window.JSPSYCH_EXPERIMENT_ID}:resume-trial`));
async function answer(page) { await page.getByRole('button', { name: 'Continue', exact: true }).click(); }
async function close(page, study, sid) {
  const state = await h.session(study.id, sid); await page.close();
  await h.wait(async () => (await h.realtime.ref(`session_connections/${study.id}/${sid}/${state.connectionId}`).once('value')).val()?.connected === false);
}
async function linear(indexed) {
  h.resetClock(); const author = editor.create(); await author.createExperiment('republish');
  for (const name of ['entry', 'target']) await author.createTrial(name);
  await author.configureButtonTrials(['entry', 'target']);
  const study = await editor.publish(author, { indexed, size: indexed ? 0 : 1 }), page = await h.newPage();
  await page.goto(study.url); await visible(page, 'entry');
  const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
  await answer(page); await visible(page, 'target');
  return { author, study, page, sid, context: page.context() };
}
async function loop(indexed, repetitions = 2) {
  h.resetClock(); const author = editor.create(); await author.createExperiment('loop-republish');
  for (const name of ['csv', 'final']) await author.createTrial(name);
  await author.createLoop('loop', ['csv']);
  await author.client.updateLoop(author.experimentId, author.id('loop'), {
    csvJson: [{ stimulus: 'row1' }, { stimulus: 'row2' }], repetitions,
  });
  await author.configureButtonTrial('final');
  await author.configureButtonTrial('csv', { csvFromLoop: true,
    defaultNextTrialId: author.id('final'), branches: [author.id('final')],
    columnMapping: { stimulus: { source: 'csv', value: 'stimulus' }, choices: { source: 'typed', value: ['Continue'] } },
    customOnStart: `trial.stimulus = '<main data-runtime-trial="csv">' + trial.stimulus + '</main>';` });
  const study = await editor.publish(author, { indexed, size: indexed ? 0 : 1 }), page = await h.newPage();
  await page.goto(study.url); await visible(page, 'csv');
  const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
  return { author, study, page, sid, context: page.context() };
}
for (const indexed of [false, true]) {
  test(`real save and generation / ${indexed}: presentation and name edits resume the same session with its original settings`, async () => {
    const f = await linear(indexed);
    try {
      const revision = (await f.author.client.getGraph(f.study.id)).revision;
      await close(f.page, f.study, f.sid);
      await f.author.configureButtonTrial('target', { name: 'renamed', columnMapping: {
        stimulus: { source: 'typed', value: '<main data-runtime-trial="changed">Changed presentation</main>' },
        choices: { source: 'typed', value: ['Continue'] },
      } });
      assert.notEqual((await f.author.client.getGraph(f.study.id)).revision, revision);
      await editor.publish(f.author, { indexed: !indexed, size: 3, timeout: 5 });
      const resumed = await f.context.newPage(); await resumed.goto(f.study.url); await visible(resumed, 'changed');
      assert.equal(resumed.url(), f.study.url); assert.equal(await resumed.evaluate(() => window.JSPSYCH_SESSION_ID), f.sid);
      await answer(resumed); await resumed.getByText('Experiment complete. Thank you!').waitFor();
      const result = await h.result(f.study.id, f.sid);
      assert.deepEqual(result.rows.map(row => Number(row.builder_id)), [f.author.id('entry'), f.author.id('target')]);
      assert.deepEqual(result.session.configuration.batchConfig, { useIndexedDB: indexed, batchSize: indexed ? 0 : 1, resumeTimeoutMinutes: 1 });
      assert.equal(result.session.participantNumber, 0); assert.equal(result.providerFiles, 1);
      const fresh = await f.context.newPage(); await fresh.goto(f.study.url); await visible(fresh, 'entry');
      const freshId = await fresh.evaluate(() => window.JSPSYCH_SESSION_ID);
      assert.notEqual(freshId, f.sid);
      assert.deepEqual((await h.session(f.study.id, freshId)).configuration.batchConfig, { useIndexedDB: !indexed, batchSize: 3, resumeTimeoutMinutes: 5 });
      assert.equal((await h.db.collection('experiments').doc(f.study.id).get()).data().sessions, 2);
    } finally { await f.context.close(); }
  });
  test(`real loop generation / ${indexed}: resumes the saved row and repetition after a metadata edit`, async () => {
    const f = await loop(indexed);
    try {
      await answer(f.page); await f.page.getByText('row2', { exact: true }).waitFor();
      await close(f.page, f.study, f.sid);
      await f.author.client.updateLoop(f.study.id, f.author.id('loop'), { name: 'renamed loop' });
      await editor.publish(f.author, { indexed: !indexed, size: 3, timeout: 5 });
      let resumed = await f.context.newPage(); await resumed.goto(f.study.url);
      await resumed.getByText('row2', { exact: true }).waitFor({ timeout: 5000 });
      if (indexed) {
        await close(resumed, f.study, f.sid);
        await editor.publish(f.author, { indexed: true, size: 3, timeout: 9 });
        resumed = await f.context.newPage(); await resumed.goto(f.study.url);
        await resumed.getByText('row2', { exact: true }).waitFor({ timeout: 5000 });
      }
      for (const row of ['row2', 'row1', 'row2']) { await resumed.getByText(row, { exact: true }).waitFor(); await answer(resumed); }
      await visible(resumed, 'final'); await answer(resumed); await resumed.getByText('Experiment complete. Thank you!').waitFor();
      const result = await h.result(f.study.id, f.sid);
      assert.deepEqual(result.rows.map(row => Number(row.builder_id)), [...Array(4).fill(f.author.id('csv')), f.author.id('final')]);
      assert.equal(result.session.configuration.batchConfig.useIndexedDB, indexed);
      assert.equal((await h.db.collection('experiments').doc(f.study.id).get()).data().sessions, 1);
    } finally { await f.context.close(); }
  });
}
test('an absent saved destination preserves the original identity, data and checkpoint', async () => {
  const f = await linear(true);
  try {
    const saved = await checkpoint(f.page); assert.ok(saved);
    await close(f.page, f.study, f.sid);
    await f.author.client.deleteTrial(f.study.id, f.author.id('target')); await editor.publish(f.author);
    const resumed = await f.context.newPage(); await resumed.goto(f.study.url);
    await resumed.getByText(/saved navigation.*(match|invalid)/).waitFor({ timeout: 5000 });
    assert.equal(await resumed.getByRole('button', { name: 'Continue', exact: true }).count(), 0);
    assert.equal(await resumed.evaluate(() => window.JSPSYCH_SESSION_ID), f.sid);
    assert.equal(await checkpoint(resumed), saved);
    assert.equal((await h.db.collection('experiments').doc(f.study.id).get()).data().sessions, 1);
    assert.equal((await h.session(f.study.id, f.sid)).receivedEventCount, 0);
  } finally { await f.context.close(); }
});
test('a removed loop repetition cannot skip to the final trial or overwrite saved progress', async () => {
  const f = await loop(true);
  try {
    await answer(f.page); await f.page.getByText('row2', { exact: true }).waitFor(); await answer(f.page);
    await f.page.getByText('row1', { exact: true }).waitFor(); await answer(f.page); await f.page.getByText('row2', { exact: true }).waitFor();
    const saved = await checkpoint(f.page); assert.ok(saved);
    await close(f.page, f.study, f.sid);
    await f.author.client.updateLoop(f.study.id, f.author.id('loop'), { repetitions: 1 }); await editor.publish(f.author);
    const resumed = await f.context.newPage(); await resumed.goto(f.study.url);
    await resumed.getByText(/saved loop/).waitFor({ timeout: 5000 });
    assert.equal(await resumed.getByRole('button', { name: 'Continue', exact: true }).count(), 0);
    assert.equal(await resumed.evaluate(() => window.JSPSYCH_SESSION_ID), f.sid);
    assert.equal(await checkpoint(resumed), saved);
    assert.equal((await h.db.collection('experiments').doc(f.study.id).get()).data().sessions, 1);
  } finally { await f.context.close(); }
});
test('after republishing with a longer timeout, expiry still uses the original deadline and recovery keeps the current URL', async () => {
  const f = await linear(true);
  try {
    await close(f.page, f.study, f.sid);
    await editor.publish(f.author, { indexed: false, size: 3, timeout: 5 });
    h.advance(61000); await h.refreshLifecycle(f.study.id, f.sid);
    assert.equal((await h.session(f.study.id, f.sid)).lifecycle, 'expired');
    const resumed = await f.context.newPage(), url = f.study.url + '?PROLIFIC_PID=P&x=1#step'; await resumed.goto(url);
    const choice = resumed.getByRole('button', { name: 'Start a new participation' });
    await choice.waitFor();
    await h.wait(async () => (await h.session(f.study.id, f.sid)).exportStatus === 'confirmed');
    assert.equal(await resumed.getByRole('button', { name: 'Continue', exact: true }).count(), 0);
    assert.equal((await h.result(f.study.id, f.sid)).rows.length, 1);
    await choice.click(); await visible(resumed, 'entry');
    assert.equal(resumed.url(), url);
    const freshId = await resumed.evaluate(() => window.JSPSYCH_SESSION_ID); assert.notEqual(freshId, f.sid);
    assert.deepEqual((await h.session(f.study.id, freshId)).configuration.batchConfig, { useIndexedDB: false, batchSize: 3, resumeTimeoutMinutes: 5 });
    assert.equal((await h.session(f.study.id, f.sid)).lifecycle, 'expired');
    assert.equal((await h.result(f.study.id, f.sid)).rows.length, 1);
  } finally { await f.context.close(); h.resetClock(); }
});
test('a removed loop row is rejected before execution and keeps its IndexedDB responses', async () => {
  const f = await loop(true);
  try {
    await answer(f.page); await f.page.getByText('row2', { exact: true }).waitFor();
    await close(f.page, f.study, f.sid);
    await f.author.client.updateLoop(f.study.id, f.author.id('loop'), { csvJson: [{ stimulus: 'row1' }] }); await editor.publish(f.author);
    const resumed = await f.context.newPage(); await resumed.goto(f.study.url);
    await resumed.getByText(/This session cannot start:.*saved loop/).waitFor({ timeout: 5000 });
    assert.equal(await resumed.getByRole('button', { name: 'Continue', exact: true }).count(), 0);
    assert.equal(await resumed.evaluate(() => window.JSPSYCH_SESSION_ID), f.sid);
    const pending = await resumed.evaluate(async id => {
      const request = indexedDB.open(`expbuilder:public:${id}:trials-v1`, 3);
      const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const query = db.transaction('trials').objectStore('trials').index('sessionId').getAll(window.JSPSYCH_SESSION_ID);
      const rows = await new Promise(resolve => { query.onsuccess = () => resolve(query.result); }); db.close(); return rows;
    }, f.study.id);
    assert.equal(pending.length, 1); assert.equal(pending[0].sequence, 0);
    assert.equal((await h.db.collection('experiments').doc(f.study.id).get()).data().sessions, 1);
  } finally { await f.context.close(); }
});
