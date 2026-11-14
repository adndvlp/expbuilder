import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { startHarness } from './harness.mjs';
import { settings, html, assertHTML, saveSettings, participant, finish } from './settings-helpers.mjs';
import { duringUpload } from './settings-publication-helpers.mjs';

let h, publish;
before(async () => {
  try {
    h = await startHarness();
    // Import after the isolated provider endpoints have been configured by the harness.
    ({ publishCurrentExperiment: publish } = await import('../functions/experiment/publish/current.js'));
  } catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; }
});
after(async () => { await h?.close(); });
const input = (study, original, mediaFiles = []) => ({ accessToken: 'token', owner: 'lab', repoName: study.id, experimentID: study.id,
  htmlContent: Buffer.from(original.content, 'base64').toString(), mediaFiles });

for (const during of [false, true]) {
  test(`settings / AC15 / during-upload=${during}: publishing an already generated HTML cannot undo a saved configuration`, async () => {
    h.resetClock(); const study = await h.study({ auto: false }), original = html(study.id);
    const saved = settings({ useIndexedDB: false, batchSize: 9, resumeTimeoutMinutes: 3 });
    saved.recruitmentConfig = { platform: 'prolific', prolificCompletionCode: 'saved-after-generation' };
    saved.captchaConfig = { enabled: false, provider: 'recaptcha', siteKey: 'saved-after-generation' };
    const originalConfiguration = (await h.db.collection('experiments').doc(study.id).get()).data().publishedConfiguration;
    if (during) await duringUpload(() => publish(input(study, original)), () => saveSettings(h, study, saved));
    else { await saveSettings(h, study, saved); await publish(input(study, original)); }
    assert.equal(html(study.id).content, original.content);
    const current = (await h.db.collection('experiments').doc(study.id).get()).data();
    assert.deepEqual(current.publishedConfiguration, originalConfiguration);
    for (const key of Object.keys(saved)) assert.deepEqual(current[key], saved[key]);
    const f = await participant(h, study);
    try {
      await f.page.locator('#answer').waitFor();
      const result = await finish(h, study, f);
      for (const key of Object.keys(saved)) assert.deepEqual(result.session.configuration[key], saved[key]);
      assert.deepEqual(result.session.configuration.exportDestination, originalConfiguration.exportDestination);
    } finally { await f.context.close(); }
  });
}

for (const failed of ['HTML', 'media']) {
  test(`settings / AC16 / ${failed}: upload failure preserves the earlier publication and the later saved settings`, async () => {
    h.resetClock(); const study = await h.study({ auto: false }), original = html(study.id);
    const previous = (await h.db.collection('experiments').doc(study.id).get()).data().publishedConfiguration;
    const saved = settings({ useIndexedDB: false, batchSize: 7, resumeTimeoutMinutes: 3 });
    saved.recruitmentConfig.prolificCompletionCode = 'retained-code'; saved.captchaConfig.provider = 'recaptcha';
    await saveSettings(h, study, saved);
    await h.db.collection('experiments').doc(study.id).update({ useValidation: true, requiredFields: ['trial_type'], driveFolderId: 'unpublished-' + study.id });
    const media = failed === 'media' ? [{ type: 'img', filename: 'failure.bin', content: 'QQ==' }] : [];
    h.faults.push({ provider: 'github', method: 'PUT', path: failed === 'media' ? '/contents/img/failure.bin' : '/contents/index.html', status: 503 });
    await assert.rejects(publish(input(study, original, media)), /could not be uploaded/);
    const current = (await h.db.collection('experiments').doc(study.id).get()).data();
    assert.deepEqual(current.publishedConfiguration, previous);
    assert.equal(current.publicationLeaseUntil, 0);
    for (const key of Object.keys(saved)) assert.deepEqual(current[key], saved[key]);
    assertHTML(study.id, original);
    const f = await participant(h, study);
    try {
      await f.page.locator('#answer').waitFor();
      const result = await finish(h, study, f);
      for (const key of Object.keys(saved)) assert.deepEqual(result.session.configuration[key], saved[key]);
      assert.deepEqual(result.session.configuration.validation, previous.validation);
      assert.equal(result.session.exportDestination.folder, previous.exportDestination.folder);
    } finally { await f.context.close(); }
  });
}
