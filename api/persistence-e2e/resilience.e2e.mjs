import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.mjs';
let h;
before(async () => { try { h = await startHarness(); } catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; } });
after(async () => { await h?.close(); });
async function answer(page, count) { for (let i = 0; i < count; i++) { await page.locator('#answer').click(); await page.waitForTimeout(80); } }
async function start(options) {
  h.resetClock(); const study = await h.study({ ...options, auto: false }), page = await h.newPage();
  const context = page.context(); await page.goto(study.url); await page.locator('#answer').waitFor();
  const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
  return { study, page, context, sid };
}
async function disconnected(study, sid) {
  const session = await h.session(study.id, sid);
  await h.wait(async () => (await h.realtime.ref(`session_connections/${study.id}/${sid}/${session.connectionId}`).once('value')).val()?.connected === false);
}
async function complete(page) { await page.getByText('Experiment complete. Thank you!').waitFor({ timeout: 20000 }); }
for (const provider of ['googledrive', 'dropbox', 'osf']) {
  test(`${provider}: a transient provider read failure preserves payloads and succeeds on retry`, async () => {
    h.resetClock();
    h.faults.push({ provider, method: provider === 'dropbox' ? 'POST' : 'GET', path: provider === 'dropbox' ? '/download' : provider === 'osf' ? '/osfstorage' : '/drive/v3/files', status: 503 });
    const study = await h.study({ provider }), page = await h.newPage();
    try {
      await page.goto(study.url); const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
      await h.wait(async () => (await h.session(study.id, sid))?.exportStatus === 'retry_wait');
      assert.equal((await h.db.collection('experiments').doc(study.id).collection('sessions').doc(sid).collection('trials').get()).size, 5);
      h.advance(31000); await complete(page); assert.equal((await h.result(study.id, sid)).rows.length, 5);
    } finally { await page.context().close(); h.resetClock(); }
  });
  for (const indexed of [true, false]) {
    test(`${provider} / ${indexed}: close and resume before the deadline preserves checkpoint and identity`, async () => {
      const f = await start({ provider, indexed, size: 1 });
      try {
        await answer(f.page, 2); await h.wait(async () => (await h.session(f.study.id, f.sid)).receivedEventCount === 2);
        await f.page.close(); await disconnected(f.study, f.sid);
        const resumed = await f.context.newPage(); await resumed.goto(f.study.url); await answer(resumed, 3); await complete(resumed);
        const result = await h.result(f.study.id, f.sid);
        assert.equal(result.rows.length, 5); assert.equal(result.session.participantNumber, 0);
        assert.equal((await h.db.collection('experiments').doc(f.study.id).get()).data().sessions, 1);
      } finally { await f.context.close(); }
    });
    test(`${provider} / ${indexed}: expiry recovers earlier responses and requires explicit new participation`, async () => {
      const f = await start({ provider, indexed, size: indexed ? 0 : 1 });
      try {
        await answer(f.page, 2); await f.page.close(); await disconnected(f.study, f.sid);
        h.advance(61000); await h.refreshLifecycle(f.study.id, f.sid);
        const expired = await f.context.newPage(); await expired.goto(f.study.url);
        await expired.getByRole('button', { name: 'Start a new participation' }).waitFor();
        await h.wait(async () => { const s = await h.session(f.study.id, f.sid); return s.exportReceipt?.eventCount === 2 && s.exportStatus === 'confirmed'; });
        const old = await h.result(f.study.id, f.sid); assert.equal(old.rows.length, 2); assert.equal(old.session.lifecycle, 'expired');
        await expired.getByRole('button', { name: 'Start a new participation' }).click();
        await expired.locator('#answer').waitFor(); const newId = await expired.evaluate(() => window.JSPSYCH_SESSION_ID);
        assert.notEqual(newId, f.sid); await answer(expired, 5); await complete(expired);
        const fresh = await h.result(f.study.id, newId);
        assert.equal(fresh.rows.length, 5); assert.equal(fresh.session.participantNumber, 1);
        assert.equal((await h.result(f.study.id, f.sid)).rows.length, 2);
      } finally { await f.context.close(); h.resetClock(); }
    });
  }
  test(`${provider}: an uncertain successful provider write is reconciled into one file`, async () => {
    h.resetClock();
    h.faults.push({ provider, method: provider === 'osf' ? 'PUT' : 'POST', path: provider === 'googledrive' ? '/upload/' : provider === 'dropbox' ? '/upload' : '/osfstorage', mode: 'lost' });
    const study = await h.study({ provider }), page = await h.newPage();
    try {
      await page.goto(study.url); const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
      await h.wait(async () => (await h.session(study.id, sid))?.exportStatus === 'reconciling');
      h.advance(31000); await complete(page);
      const result = await h.result(study.id, sid); assert.equal(result.rows.length, 5); assert.equal(result.providerFiles, 1);
    } finally { await page.context().close(); h.resetClock(); }
  });
}
for (const indexed of [true, false]) {
  test(`network reconnect without reload / ${indexed}: revalidates the same session before continuing`, async () => {
    const f = await start({ indexed, size: 1 });
    try {
      await answer(f.page, 2); await f.page.evaluate(() => window.firebase.database().goOffline());
      await disconnected(f.study, f.sid); await h.refreshLifecycle(f.study.id, f.sid);
      const generation = (await h.session(f.study.id, f.sid)).connectionGeneration;
      await f.page.evaluate(() => window.firebase.database().goOnline());
      await h.wait(async () => { const s = await h.session(f.study.id, f.sid); return s.connectionGeneration > generation && s.connectionPhase === 'active'; });
      await answer(f.page, 3); await complete(f.page);
      assert.equal((await h.result(f.study.id, f.sid)).rows.length, 5);
    } finally { await f.context.close(); }
  });
  test(`last acknowledgement held / ${indexed}: cannot complete or report success before it arrives`, async () => {
    h.resetClock(); const study = await h.study({ indexed, size: 1 }), page = await h.newPage(); h.hold(4);
    try {
      await page.goto(study.url); const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
      await h.wait(async () => (await h.session(study.id, sid))?.receivedEventCount === 5);
      assert.equal(h.requests.some(request => request.sessionId === sid && request.action === 'completeSession'), false);
      assert.equal(await page.getByText('Experiment complete. Thank you!').count(), 0);
      h.release(); await complete(page); assert.equal((await h.result(study.id, sid)).rows.length, 5);
    } finally { h.release(); await page.context().close(); }
  });
  test(`lost HTTP acknowledgement / ${indexed}: retries stable IDs without duplicate rows`, async () => {
    const f = await start({ indexed, size: 1 });
    try {
      h.loseNextAppend(); await answer(f.page, 1);
      if (!indexed) {
        await h.wait(async () => await f.page.getByRole('button', { name: 'Retry saving' }).count() || await f.page.locator('#answer').count());
        if (await f.page.getByRole('button', { name: 'Retry saving' }).count()) await f.page.getByRole('button', { name: 'Retry saving' }).click();
      }
      await answer(f.page, 4); await complete(f.page);
      const result = await h.result(f.study.id, f.sid);
      assert.equal(result.rows.length, 5); assert.equal(result.session.receivedEventCount, 5);
    } finally { await f.context.close(); }
  });
}
test('ON → OFF → ON resumes at the current URL and preserves batch-zero pending data', async () => {
  const f = await start({ indexed: true, size: 0 });
  try {
    await answer(f.page, 2); await f.page.close(); await disconnected(f.study, f.sid);
    await h.study({ id: f.study.id, indexed: false, size: 1, auto: false });
    await h.study({ id: f.study.id, indexed: true, size: 3, auto: false });
    const resumed = await f.context.newPage(); await resumed.goto(f.study.url); await resumed.locator('#answer').waitFor();
    assert.equal(resumed.url(), f.study.url);
    assert.equal(await resumed.evaluate(() => window.JSPSYCH_SESSION_ID), f.sid);
    await answer(resumed, 3); await complete(resumed);
    const result = await h.result(f.study.id, f.sid); assert.equal(result.rows.length, 5);
    assert.equal(result.session.configuration.batchConfig.batchSize, 0);
    assert.equal((await h.db.collection('experiments').doc(f.study.id).get()).data().sessions, 1);
  } finally { await f.context.close(); }
});
test('an overlapping blocked first batch does not delete later IndexedDB responses', async () => {
  h.resetClock(); const study = await h.study({ indexed: true, size: 1 }), page = await h.newPage(); h.hold(0);
  try {
    await page.goto(study.url); const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
    await h.wait(async () => (await h.session(study.id, sid))?.receivedEventCount === 1);
    await page.waitForTimeout(200);
    h.release(); await complete(page);
    const result = await h.result(study.id, sid); assert.deepEqual(result.rows.map(row => Number(row.event_sequence)), [0,1,2,3,4]);
    assert.equal(result.pending, 0);
  } finally { h.release(); await page.context().close(); }
});
test('batch zero uploads more than 100 trials in bounded fragments and verifies the final CSV', async () => {
  h.resetClock(); const study = await h.study({ indexed: true, size: 0, count: 105 }), page = await h.newPage();
  try {
    await page.goto(study.url); await complete(page); const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
    const sizes = h.requests.filter(request => request.sessionId === sid && request.action === 'appendEvents').map(request => request.data.events.length);
    assert.equal(sizes.reduce((a,b) => a+b, 0), 105); assert.ok(sizes.length > 1 && sizes.every(size => size <= 100));
    const result = await h.result(study.id, sid); assert.equal(result.rows.length, 105); assert.equal(new Set(result.rows.map(row => row.event_id)).size, 105);
  } finally { await page.context().close(); }
});
test('a second live tab cannot produce responses for the first writer', async () => {
  const f = await start({ indexed: false });
  try {
    const other = await f.context.newPage(); await other.goto(f.study.url);
    await other.getByText(/session_in_use/).waitFor(); assert.equal(await other.locator('#answer').count(), 0);
    await answer(f.page, 5); await complete(f.page);
    assert.equal((await h.result(f.study.id, f.sid)).rows.length, 5);
  } finally { await f.context.close(); }
});
test('real IndexedDB transaction abort blocks navigation and can be retried without losing the response', async () => {
  const f = await start({ indexed: true, size: 1 });
  try {
    await f.page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction; let fail = true;
      IDBDatabase.prototype.transaction = function(...args) { const tx = original.apply(this, args); if (fail && args[1] === 'readwrite') { fail = false; queueMicrotask(() => tx.abort()); } return tx; };
    });
    await answer(f.page, 1); await f.page.getByRole('button', { name: 'Retry saving' }).waitFor();
    assert.equal((await h.session(f.study.id, f.sid)).receivedEventCount, 0);
    await f.page.getByRole('button', { name: 'Retry saving' }).click(); await answer(f.page, 4); await complete(f.page);
    assert.equal((await h.result(f.study.id, f.sid)).rows.length, 5);
  } finally { await f.context.close(); }
});
test('RTDB emulator rejects an unauthorised capability and cannot reopen a disconnected generation', async () => {
  const f = await start({ indexed: false });
  try {
    const state = await h.session(f.study.id, f.sid), path = `session_connections/${f.study.id}/${f.sid}/${state.connectionId}`;
    const existing = (await h.realtime.ref(path).once('value')).val();
    const response = await fetch(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/${path}.json?ns=demo-public-persistence-default-rtdb`, {
      method: 'PUT', body: JSON.stringify({ ...existing, token: 'wrong', changedAt: { '.sv': 'timestamp' } }) });
    assert.equal(response.status, 401);
    await f.page.close(); await disconnected(f.study, f.sid);
    const reopened = await fetch(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/${path}.json?ns=demo-public-persistence-default-rtdb`, {
      method: 'PUT', body: JSON.stringify({ ...existing, connected: true, changedAt: { '.sv': 'timestamp' } }) });
    assert.equal(reopened.status, 401);
  } finally { await f.context.close(); }
});
