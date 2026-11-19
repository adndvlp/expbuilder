import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.mjs';
import { settings, html, assertHTML, saveSettings, participant, answer, disconnect, resume, pending, verified, finish } from './settings-helpers.mjs';

let h;
before(async () => { try { h = await startHarness(); } catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; } });
after(async () => { await h?.close(); });

for (const provider of ['googledrive', 'dropbox', 'osf']) {
  test(`settings / AC12 AC19 / ${provider}: one HTML, saved ON-0 → OFF-9 → ON-1 → ON-3, frozen pending session`, async () => {
    h.resetClock();
    const study = await h.study({ provider, auto: false, size: 0, timeout: 10 }), original = html(study.id);
    const first = await participant(h, study);
    try {
      await first.page.locator('#answer').waitFor(); await answer(first.page, 2);
      const backlog = await pending(first.page, study.id, first.sid);
      assert.equal(backlog.length, 2);
      assert.equal((await h.session(study.id, first.sid)).receivedEventCount, 0);
      await disconnect(h, study, first);
      for (const [indexed, size, expected] of [[false, 9, [1, 1, 1, 1, 1]], [true, 1, [1, 1, 1, 1, 1]], [true, 3, [3, 2]]]) {
        const saved = settings({ useIndexedDB: indexed, batchSize: size });
        await saveSettings(h, study, saved); assertHTML(study.id, original);
        const fresh = await participant(h, study);
        try {
          await fresh.page.locator('#answer').waitFor();
          assert.notEqual(fresh.sid, first.sid);
          assert.deepEqual((await h.session(study.id, fresh.sid)).configuration.batchConfig, saved.batchConfig);
          await answer(fresh.page, 2);
          if (indexed && size === 3) {
            assert.equal((await h.session(study.id, fresh.sid)).receivedEventCount, 0);
            assert.equal((await pending(fresh.page, study.id, fresh.sid)).length, 2);
          } else {
            await h.wait(async () => (await h.session(study.id, fresh.sid)).receivedEventCount === 2);
            if (!indexed) assert.equal(await pending(fresh.page, study.id, fresh.sid), null);
          }
          const result = await finish(h, study, fresh, 3);
          assert.equal(result.session.exportDestination.provider, provider);
          assert.equal(result.session.exportDestination.folder, (await h.session(study.id, first.sid)).exportDestination.folder);
          const sent = h.requests.filter(request => request.sessionId === fresh.sid && request.action === 'appendEvents');
          assert.deepEqual(sent.map(request => request.data.events.length), expected);
          assert.ok(sent.every(request => !Object.hasOwn(request, 'configuration')));
        } finally { await fresh.context.close(); }
      }
      await resume(study, first);
      assert.deepEqual(await pending(first.page, study.id, first.sid), backlog);
      assert.deepEqual((await h.session(study.id, first.sid)).configuration.batchConfig, settings({ batchSize: 0 }).batchConfig);
      const result = await finish(h, study, first, 3);
      assert.equal(result.session.participantNumber, 0);
      assert.equal((await h.db.collection('experiments').doc(study.id).get()).data().sessions, 4);
      assertHTML(study.id, original);
    } finally { await first.context.close(); }
  });
}

for (const indexed of [true, false]) {
  test(`settings / AC11 AC19 / indexed=${indexed}: saving timeout changes only the new session and expired responses keep their identity`, async () => {
    h.resetClock(); const study = await h.study({ indexed, size: indexed ? 0 : 1, timeout: 1, auto: false }), original = html(study.id);
    const first = await participant(h, study); let second;
    try {
      await first.page.locator('#answer').waitFor(); await answer(first.page, 2); await disconnect(h, study, first);
      const deadline = (await h.session(study.id, first.sid)).resumeExpiresAt;
      await saveSettings(h, study, settings({ useIndexedDB: indexed, batchSize: 1, resumeTimeoutMinutes: 3 }));
      second = await participant(h, study); await second.page.locator('#answer').waitFor();
      h.advance(61000); await h.refreshLifecycle(study.id, first.sid);
      const expired = await h.session(study.id, first.sid);
      assert.equal(expired.lifecycle, 'expired'); assert.equal(expired.resumeExpiresAt, deadline);
      assert.equal(expired.receivedEventCount, indexed ? 0 : 2);
      first.page = await first.context.newPage(); await first.page.goto(study.url);
      await first.page.getByText('This session has ended. The available responses have been saved.').waitFor({ timeout: 20000 });
      assert.equal(await first.page.locator('#answer').count(), 0);
      assert.equal(await first.page.evaluate(() => window.JSPSYCH_SESSION_ID), first.sid);
      assert.equal((await verified(h, study, first.sid, 2)).session.lifecycle, 'expired');
      await disconnect(h, study, second);
      const newer = await h.session(study.id, second.sid);
      assert.equal(newer.resumeExpiresAt - newer.disconnectedAt, 180000);
      h.advance(61000); await h.refreshLifecycle(study.id, second.sid);
      assert.equal((await h.session(study.id, second.sid)).lifecycle, 'disconnected');
      await resume(study, second); await finish(h, study, second);
      assert.equal((await h.db.collection('experiments').doc(study.id).get()).data().sessions, 2);
      assertHTML(study.id, original);
    } finally { await first.context.close(); await second?.context.close(); h.resetClock(); }
  });
}
