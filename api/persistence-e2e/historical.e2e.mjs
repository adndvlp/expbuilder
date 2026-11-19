import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.mjs';
import { store } from '../mock-providers/store.mjs';
let h;
before(async () => { try { h = await startHarness(); } catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; } });
after(async () => { await h?.close(); });
for (const provider of ['googledrive', 'dropbox', 'osf']) {
  test(`${provider}: historical inspection has no writes; paged apply exports exactly once and keeps the originals`, async () => {
    const study = await h.study({ provider }), sid = 'legacy-session';
    const parent = h.db.collection('experiments').doc(study.id).collection('sessions').doc(sid);
    await h.db.collection('experiments').doc(study.id).set({ sessions: 26, currentCondition: 26 }, { merge: true });
    await parent.set({ participantNumber: 23, condition: 0, createdAt: '2026-11-05T00:00:00Z', trialCount: 1 });
    const original = { trialsData: JSON.stringify(Array.from({ length: 151 }, (_, trial_index) => ({ trial_type: 'test', trial_index, response: `answer ${trial_index}`, nested: [[1, 2], [3, 4]] }))) };
    await parent.collection('trials').doc('batch-original').set(original);
    const { inspectHistoricalSession, recoveryRemoteSnapshot } = await import('../functions/experiment/sessions/recovery/inspect.js');
    const { applyHistoricalPlan } = await import('../functions/experiment/sessions/recovery/apply.js');
    const { recoveryHash } = await import('../functions/experiment/sessions/recovery/plan.js');
    const { createExportAdapter } = await import('../functions/experiment/sessions/export/providers/index.js');
    const inspectRemote = async destination => recoveryRemoteSnapshot(await (await createExportAdapter(destination)).inspect());
    const snapshot = async () => recoveryHash({ session: (await parent.get()).data(), trials: (await parent.collection('trials').get()).docs.map(doc => doc.data()),
      files: [...store.drive.files.keys(), ...store.dropbox.files.keys(), ...store.osf.files.keys()] });
    const before = await snapshot();
    const plan = await inspectHistoricalSession({ projectId: 'demo-public-persistence', experimentID: study.id, sessionId: sid }, inspectRemote);
    assert.equal(plan.status, 'ready'); assert.equal(await snapshot(), before);
    const first = await applyHistoricalPlan(plan, { projectId: 'demo-public-persistence', inspectRemote });
    await h.wait(async () => (await parent.get()).data().exportStatus === 'confirmed');
    await h.wait(async () => (await parent.collection('trials').get()).empty);
    const repeated = await applyHistoricalPlan(plan, { projectId: 'demo-public-persistence', inspectRemote });
    assert.deepEqual(repeated, first);
    const result = await h.result(study.id, sid);
    assert.equal(result.rows.length, 151); assert.equal(new Set(result.rows.map(row => row.event_id)).size, 151);
    assert.equal(result.session.participantNumber, 23); assert.equal(result.session.lifecycle, 'expired'); assert.equal(result.providerFiles, 1);
    assert.equal((await h.db.collection('experiments').doc(study.id).get()).data().sessions, 26);
    assert.deepEqual((await parent.collection('recovery_sources').doc('batch-original').get()).data().data, original);
  });
}
