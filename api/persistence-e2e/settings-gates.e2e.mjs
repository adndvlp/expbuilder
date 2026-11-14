import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.mjs';
import { settings, html, assertHTML, saveSettings, participant, answer, disconnect, resume, verified, finish } from './settings-helpers.mjs';
import { captcha, challenge, passCaptcha, recruitment } from './settings-gate-helpers.mjs';

let h;
before(async () => { try { h = await startHarness(); } catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; } });
after(async () => { await h?.close(); });

for (const indexed of [true, false]) {
  test(`settings / AC13 / indexed=${indexed}: enable, key change, provider change and disable CAPTCHA without publishing`, async () => {
    h.resetClock(); const study = await h.study({ indexed, auto: false }), original = html(study.id), participants = [];
    const saved = settings({ useIndexedDB: indexed });
    try {
      for (const expected of [{ provider: 'hcaptcha', siteKey: 'first-key' },
        { provider: 'hcaptcha', siteKey: 'changed-key' }, { provider: 'recaptcha', siteKey: 'recaptcha-key' }]) {
        saved.captchaConfig = { enabled: true, ...expected };
        await saveSettings(h, study, saved); assertHTML(study.id, original);
        const f = await participant(h, study, '', captcha); participants.push(f);
        await challenge(h, study, f, expected);
      }
      // A pending challenge must have armed its real RTDB presence before its setup deadline passes.
      h.advance(61000);
      for (const f of participants) { await h.refreshLifecycle(study.id, f.sid); assert.equal((await h.session(study.id, f.sid)).lifecycle, 'active'); }
      saved.captchaConfig = { enabled: false, provider: 'recaptcha', siteKey: '' };
      await saveSettings(h, study, saved);
      const disabled = await participant(h, study, '', captcha); participants.push(disabled);
      await disabled.page.locator('#answer').waitFor();
      assert.equal(await disabled.page.locator('#jspsych-captcha-overlay').count(), 0);
      assert.equal(await disabled.page.evaluate(() => window.__captchaChallenge), undefined);
      await finish(h, study, disabled);
      for (const [index, f] of participants.slice(0, 3).entries()) {
        await passCaptcha(f);
        const before = (await h.session(study.id, f.sid)).configuration;
        if (index === 0) {
          await answer(f.page, 2); await disconnect(h, study, f);
          // A new tab has fresh sessionStorage: the challenge uses the session's original settings.
          await resume(study, f, '#jspsych-captcha-overlay');
          await challenge(h, study, f, { provider: 'hcaptcha', siteKey: 'first-key' });
          await passCaptcha(f);
          await finish(h, study, f, 3);
        } else await finish(h, study, f);
        assert.deepEqual((await h.session(study.id, f.sid)).configuration, before);
        assert.equal(before.captchaConfig.enabled, true);
      }
      assertHTML(study.id, original);
    } finally { for (const f of participants) await f.context.close(); h.resetClock(); }
  });

  test(`settings / AC14 / indexed=${indexed}: none, Prolific codes and MTurk use saved settings and redirect after export`, async () => {
    h.resetClock(); const study = await h.study({ indexed, auto: false }), original = html(study.id), participants = [], observed = [];
    const saved = settings({ useIndexedDB: indexed });
    const prepare = context => recruitment(h, study, context, observed);
    const prolific = '?PROLIFIC_PID=participant&STUDY_ID=study&SESSION_ID=external-session';
    try {
      saved.recruitmentConfig = { platform: 'prolific', prolificCompletionCode: 'ORIGINAL-CODE' };
      await saveSettings(h, study, saved);
      const old = await participant(h, study, prolific, prepare); participants.push(old);
      await old.page.locator('#answer').waitFor(); await answer(old.page, 2); await disconnect(h, study, old);
      saved.recruitmentConfig = { platform: 'none', prolificCompletionCode: '' };
      await saveSettings(h, study, saved);
      const none = await participant(h, study, prolific, prepare); participants.push(none);
      await none.page.locator('#answer').waitFor(); await finish(h, study, none);
      assert.equal(observed.length, 0);
      saved.recruitmentConfig = { platform: 'prolific', prolificCompletionCode: 'NEW-CODE' };
      await saveSettings(h, study, saved);
      const fresh = await participant(h, study, prolific, prepare); participants.push(fresh);
      await fresh.page.locator('#answer').waitFor();
      await resume(study, old);
      h.hold(4); await answer(old.page, 3, true);
      await h.wait(async () => (await h.session(study.id, old.sid)).receivedEventCount === 5);
      assert.equal(observed.length, 0); assert.notEqual((await h.session(study.id, old.sid)).completion?.confirmed, true);
      h.release();
      await old.page.waitForURL('https://app.prolific.com/submissions/complete?cc=ORIGINAL-CODE');
      const oldResult = await verified(h, study, old.sid);
      assert.equal(oldResult.session.configuration.recruitmentConfig.prolificCompletionCode, 'ORIGINAL-CODE');
      await answer(fresh.page, 5, true); await fresh.page.waitForURL('https://app.prolific.com/submissions/complete?cc=NEW-CODE');
      await verified(h, study, fresh.sid);
      saved.recruitmentConfig = { platform: 'mturk', prolificCompletionCode: '' };
      await saveSettings(h, study, saved);
      const preview = await participant(h, study, '?assignmentId=ASSIGNMENT_ID_NOT_AVAILABLE', prepare); participants.push(preview);
      await preview.page.getByText('Accept the HIT to start the experiment.').waitFor();
      assert.equal(await preview.page.locator('#answer').count(), 0);
      assert.equal((await h.session(study.id, preview.sid)).receivedEventCount, 0);
      const accepted = await participant(h, study, '?workerId=worker&assignmentId=assignment&hitId=hit&turkSubmitTo=https%3A%2F%2Fworkersandbox.mturk.com', prepare); participants.push(accepted);
      await accepted.page.locator('#answer').waitFor(); await answer(accepted.page, 5, true);
      await accepted.page.waitForURL('https://workersandbox.mturk.com/mturk/externalSubmit');
      const result = await verified(h, study, accepted.sid);
      assert.ok(result.rows.every(row => row.mturk_worker_id === 'worker' && row.mturk_assignment_id === 'assignment'));
      assert.equal(observed.length, 3); assert.ok(observed.every(item => item.confirmed && item.exported));
      assert.equal(observed[2].method, 'POST'); assert.equal(new URLSearchParams(observed[2].body).get('assignmentId'), 'assignment');
      assertHTML(study.id, original);
    } finally { h.release(); for (const f of participants) await f.context.close(); h.resetClock(); }
  });
}
