import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.mjs';

let h;
before(async () => { try { h = await startHarness(); }
  catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; } });
after(async () => { await h?.close(); });

test('current experiment deletion drains receipts, jobs, metadata and presence without a publication history', async () => {
  const study = await h.study(), page = await h.newPage();
  try {
    await page.goto(study.url);
    await page.getByText('Experiment complete. Thank you!').waitFor({ timeout: 20000 });
    const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
    const experiment = h.db.collection('experiments').doc(study.id), session = experiment.collection('sessions').doc(sid);
    const metadata = experiment.collection('session_metadata').doc(sid);
    await metadata.set({ sessionId: sid });
    await metadata.collection('participant_files').doc('file-1').set({ name: 'participant.txt' });
    await metadata.collection('trials').doc('trial-1').set({ response: 'metadata response' });
    assert.equal((await session.collection('event_receipts').get()).size, 5);
    const jobs = await session.collection('export_jobs').get(); assert.ok(jobs.size > 0);
    assert.equal((await h.result(study.id, sid)).rows.length, 5);
    assert.equal((await experiment.get()).data().sessionExportProtocolVersion, 1);

    const { deleteExperiment } = await import('../functions/experiment/delete.js');
    const result = await deleteExperiment(study.id, null);
    assert.equal(result.success, true); assert.equal(result.rtdbCleared, true);
    assert.equal((await experiment.get()).exists, false); assert.equal((await session.get()).exists, false);
    assert.equal((await metadata.get()).exists, false);
    for (const name of ['trials', 'event_receipts', 'export_jobs']) assert.equal((await session.collection(name).get()).size, 0);
    for (const job of jobs.docs) assert.equal((await job.ref.collection('chunks').get()).size, 0);
    for (const name of ['participant_files', 'trials']) assert.equal((await metadata.collection(name).get()).size, 0);
    for (const name of ['sessions', 'session_connections', 'session_connection_leases']) {
      assert.equal((await h.realtime.ref(`${name}/${study.id}`).once('value')).val(), null);
    }
  } finally { await page.context().close(); }
});
