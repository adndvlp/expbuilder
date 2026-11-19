import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.mjs';
import { settings, html, assertHTML, saveSettings, participant, answer, disconnect, pending, finish, checkpointKey, sessionKey } from './settings-helpers.mjs';

let h;
before(async () => { try { h = await startHarness(); } catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; } });
after(async () => { await h?.close(); });

for (const indexed of [true, false]) {
  test(`settings / AC09 / indexed=${indexed}: lost registration response and another save keep one participant and its original settings`, async () => {
    h.resetClock(); const study = await h.study({ indexed, size: indexed ? 0 : 1, timeout: 10, auto: false }), original = html(study.id);
    const initial = (await h.db.collection('experiments').doc(study.id).get()).data();
    const changed = settings({ useIndexedDB: !indexed, batchSize: 7, resumeTimeoutMinutes: 3 });
    let lost = false;
    const f = await participant(h, study, '', async context => {
      await context.route('**/apiData', async route => {
        if (!lost && route.request().postDataJSON().action === 'createSession') {
          lost = true; const response = await route.fetch(); assert.equal(response.status(), 201);
          await saveSettings(h, study, changed); await route.abort('failed'); return;
        }
        await route.continue();
      });
    });
    try {
      await f.page.getByText(/This session cannot start/).waitFor();
      assert.equal(await f.page.locator('#answer').count(), 0);
      h.advance(31000); await h.refreshLifecycle(study.id, f.sid); await f.page.reload();
      await f.page.locator('#answer').waitFor();
      const state = await h.session(study.id, f.sid);
      for (const key of ['batchConfig', 'recruitmentConfig', 'captchaConfig']) assert.deepEqual(state.configuration[key], initial[key]);
      assert.equal(await f.page.evaluate(() => window.JSPSYCH_SESSION_ID), f.sid);
      assert.equal(state.participantNumber, 0);
      await finish(h, study, f);
      assert.equal((await h.db.collection('experiments').doc(study.id).get()).data().sessions, 1);
      assertHTML(study.id, original);
    } finally { await f.context.close(); h.resetClock(); }
  });

  test(`settings / AC10 / indexed=${indexed}: saving between registration and activation cannot replace any session setting`, async () => {
    h.resetClock(); const study = await h.study({ indexed, size: indexed ? 0 : 1, timeout: 10, auto: false }), original = html(study.id);
    const initial = (await h.db.collection('experiments').doc(study.id).get()).data();
    const changed = settings({ useIndexedDB: !indexed, batchSize: 9, resumeTimeoutMinutes: 3 });
    changed.recruitmentConfig.prolificCompletionCode = 'later-code';
    changed.captchaConfig = { enabled: false, provider: 'recaptcha', siteKey: 'later-key' };
    let intercepted = false;
    const f = await participant(h, study, '', async context => {
      await context.route('**/apiData', async route => {
        if (!intercepted && route.request().postDataJSON().action === 'createSession') {
          intercepted = true; const response = await route.fetch(); assert.equal(response.status(), 201);
          await saveSettings(h, study, changed); await route.fulfill({ response }); return;
        }
        await route.continue();
      });
    });
    try {
      await f.page.locator('#answer').waitFor();
      const state = await h.session(study.id, f.sid); assert.equal(state.connectionPhase, 'active');
      for (const key of ['batchConfig', 'recruitmentConfig', 'captchaConfig']) assert.deepEqual(state.configuration[key], initial[key]);
      await answer(f.page, 2);
      if (indexed) { assert.equal((await pending(f.page, study.id, f.sid)).length, 2); assert.equal((await h.session(study.id, f.sid)).receivedEventCount, 0); }
      else { assert.equal(await pending(f.page, study.id, f.sid), null); assert.equal((await h.session(study.id, f.sid)).receivedEventCount, 2); }
      await finish(h, study, f, 3); assertHTML(study.id, original);
    } finally { await f.context.close(); }
  });

  test(`settings / AC18 / indexed=${indexed}: incomplete service response blocks trials and preserves identity, checkpoint and pending responses`, async () => {
    h.resetClock(); const study = await h.study({ indexed, size: indexed ? 0 : 1, timeout: 10, auto: false }), original = html(study.id);
    const f = await participant(h, study);
    try {
      await f.page.locator('#answer').waitFor(); await answer(f.page, 2);
      const checkpoint = await f.page.evaluate(key => localStorage.getItem(key), checkpointKey(study.id));
      const backlog = await pending(f.page, study.id, f.sid);
      await disconnect(h, study, f);
      await f.context.route('**/apiData', async route => {
        const response = await route.fetch(), body = await response.json();
        if (body.configuration) delete body.configuration[indexed ? 'captchaConfig' : 'batchConfig'];
        await route.fulfill({ response, json: body });
      });
      f.page = await f.context.newPage(); await f.page.goto(study.url);
      await f.page.getByText(/Invalid session settings/).waitFor();
      assert.equal(await f.page.locator('#answer').count(), 0);
      assert.equal(await f.page.evaluate(key => localStorage.getItem(key), sessionKey(study.id)), f.sid);
      assert.equal(await f.page.evaluate(key => localStorage.getItem(key), checkpointKey(study.id)), checkpoint);
      assert.deepEqual(await pending(f.page, study.id, f.sid), backlog);
      assert.equal((await h.session(study.id, f.sid)).receivedEventCount, indexed ? 0 : 2);
      await f.context.unroute('**/apiData');
      h.advance(31000); await h.refreshLifecycle(study.id, f.sid); await f.page.reload(); await f.page.locator('#answer').waitFor();
      await finish(h, study, f, 3);
      assert.equal((await h.db.collection('experiments').doc(study.id).get()).data().sessions, 1);
      assertHTML(study.id, original);
    } finally { await f.context.close(); h.resetClock(); }
  });
}
