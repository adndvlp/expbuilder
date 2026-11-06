import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.mjs';
let harness;
before(async () => { try { harness = await startHarness(); } catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; } });
after(async () => { await harness?.close(); });
for (const provider of ['googledrive', 'dropbox', 'osf']) {
  for (const [indexed, size] of [[true, 0], [true, 1], [true, 3], [false, 0], [false, 1], [false, 9]]) {
    test(`${provider} / indexed=${indexed} / batch=${size}: generated browser → real Firebase → verified CSV`, async () => {
      const study = await harness.study({ provider, indexed, size });
      const page = await harness.newPage();
      try {
        await page.goto(study.url);
        assert.equal(await page.evaluate(() => window.firebase.SDK_VERSION), '9.23.0');
        await page.getByText('Experiment complete. Thank you!').waitFor({ timeout: 20000 });
        const sessionId = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
        const result = await harness.result(study.id, sessionId);
        assert.equal(result.session.lifecycle, 'completed'); assert.equal(result.session.completion.confirmed, true);
        assert.deepEqual(result.rows.map(row => Number(row.event_sequence)), [0, 1, 2, 3, 4]);
        assert.deepEqual(result.rows.map(row => row.response), ['A,quoted', 'B\nline', 'C"quote', 'D', 'E']);
        assert.equal(new Set(result.rows.map(row => row.event_id)).size, 5);
        assert.ok(result.rows.every(row => row.session_id === sessionId && row.session_participant_number === '0'));
        assert.equal(result.pending, 0); assert.equal(result.providerFiles, 1);
      } finally { await page.close(); }
    });
  }
}
