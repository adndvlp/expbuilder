import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { store } from '../mock-providers/store.mjs';
import { createDefaultPublicSettings } from '../functions/experiment/settings.js';

export const settings = (batch = {}) => ({ ...createDefaultPublicSettings(),
  batchConfig: { useIndexedDB: true, batchSize: 1, resumeTimeoutMinutes: 10, ...batch } });
export const sessionKey = id => `expbuilder:public:${id}:session-id`;
export const checkpointKey = id => `expbuilder:public:${id}:resume-trial`;
export const html = id => structuredClone(store.github.contents.get(`lab/${id}/index.html`));
export const assertHTML = (id, original) => assert.deepEqual(html(id), original, 'Saving settings must not replace the HTML or its GitHub SHA');

function firestoreValue(input) {
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number') return { integerValue: String(input) };
  if (typeof input === 'string') return { stringValue: input };
  return { mapValue: { fields: Object.fromEntries(Object.entries(input).map(([key, value]) => [key, firestoreValue(value)])) } };
}
// Emulator-only owner JWT: administrative saves still pass through the real Firestore rules.
export async function saveSettings(h, study, configuration) {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-public-persistence');
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^127\.0\.0\.1:\d+$/);
  const project = 'demo-public-persistence', now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = encode({ alg: 'none', typ: 'JWT' }) + '.' + encode({ sub: 'owner', user_id: 'owner', aud: project,
    iss: `https://securetoken.google.com/${project}`, iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'custom', identities: {} } }) + '.';
  const keys = ['batchConfig', 'recruitmentConfig', 'captchaConfig'];
  const patch = Object.fromEntries(keys.map(key => [key, configuration[key]]));
  const before = (await h.db.collection('experiments').doc(study.id).get()).data();
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents/experiments/${study.id}?`
    + keys.map(key => 'updateMask.fieldPaths=' + key).join('&'), {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreValue(patch).mapValue.fields }),
  });
  assert.equal(response.status, 200, await response.text());
  const after = (await h.db.collection('experiments').doc(study.id).get()).data();
  assert.deepEqual(after.publishedConfiguration, before.publishedConfiguration);
  assert.equal(after.sessions, before.sessions);
  assert.equal(after.currentCondition, before.currentCondition);
  for (const key of keys) assert.deepEqual(after[key], patch[key]);
}

export async function participant(h, study, search = '', prepare) {
  const context = await h.browser.newContext();
  await context.route(/https:\/\//, route => route.abort());
  if (prepare) await prepare(context);
  const page = await context.newPage(); await page.goto(study.url + search);
  await page.waitForFunction(() => Boolean(window.JSPSYCH_SESSION_ID));
  const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID);
  return { page, context, sid };
}
export async function answer(page, count, last = false) {
  for (let index = 0; index < count; index++) {
    await page.evaluate(() => { window.__previousAnswer = window.__answer; });
    await page.locator('#answer').click();
    if (!last || index < count - 1) await page.waitForFunction(() => window.__answer !== window.__previousAnswer);
  }
}
export async function disconnect(h, study, f) {
  f.url = f.page.url();
  await f.page.close();
  const session = await h.session(study.id, f.sid);
  await h.wait(async () => (await h.realtime.ref(`session_connections/${study.id}/${f.sid}/${session.connectionId}`).once('value')).val()?.connected === false);
  await h.refreshLifecycle(study.id, f.sid);
}
export async function resume(study, f, ready = '#answer') {
  f.page = await f.context.newPage(); await f.page.goto(f.url || study.url); await f.page.locator(ready).waitFor();
  assert.equal(await f.page.evaluate(() => window.JSPSYCH_SESSION_ID), f.sid);
}
export async function pending(page, id, sid) {
  return page.evaluate(async ({ id, sid }) => {
    const name = `expbuilder:public:${id}:trials-v1`;
    if (!(await indexedDB.databases()).some(database => database.name === name)) return null;
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(name); open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction('trials', 'readonly');
        const query = tx.objectStore('trials').index('sessionId').getAll(sid);
        tx.oncomplete = () => { db.close(); resolve(query.result); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  }, { id, sid });
}
export async function verified(h, study, sid, count = 5) {
  await h.wait(async () => (await h.session(study.id, sid))?.exportStatus === 'confirmed');
  const result = await h.result(study.id, sid);
  assert.equal(result.rows.length, count);
  assert.deepEqual(result.rows.map(row => Number(row.event_sequence)), Array.from({ length: count }, (_, index) => index));
  assert.deepEqual(result.rows.map(row => row.response), ['A,quoted', 'B\nline', 'C"quote', 'D', 'E'].slice(0, count));
  assert.equal(new Set(result.rows.map(row => row.event_id)).size, count);
  assert.ok(result.rows.every(row => row.session_id === sid && Number(row.session_participant_number) === result.session.participantNumber));
  assert.equal(result.session.exportReceipt.eventCount, count);
  assert.equal(result.session.exportConfirmedRevision, result.session.exportRequestedRevision);
  assert.equal(result.pending, 0); assert.equal(result.providerFiles, 1);
  return result;
}
export async function finish(h, study, f, count = 5) {
  await answer(f.page, count, true);
  await f.page.getByText('Experiment complete. Thank you!').waitFor({ timeout: 20000 });
  return verified(h, study, f.sid);
}
