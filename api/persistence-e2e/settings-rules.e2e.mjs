import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import process from 'node:process';

const project = 'demo-public-persistence';
const settings = () => ({ batchConfig: { useIndexedDB: true, batchSize: 0, resumeTimeoutMinutes: 30 },
  recruitmentConfig: { platform: 'none', prolificCompletionCode: '' }, captchaConfig: { enabled: false, provider: 'hcaptcha', siteKey: '' } });
let origin, counter = 0;
before(() => {
  assert.equal(process.env.GCLOUD_PROJECT, project);
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^127\.0\.0\.1:\d+$/);
  origin = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents/experiments/`;
});
const jwt = uid => {
  const now = Math.floor(Date.now() / 1000), encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return encode({ alg: 'none', typ: 'JWT' }) + '.' + encode({ sub: uid, user_id: uid, aud: project,
    iss: `https://securetoken.google.com/${project}`, iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'custom', identities: {} } }) + '.';
};
function value(input) {
  if (input === null) return { nullValue: null };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'string') return { stringValue: input };
  if (typeof input === 'number') return Number.isInteger(input) ? { integerValue: String(input) } : { doubleValue: input };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(input).map(([key, v]) => [key, value(v)])) } };
}
async function request(id, method, data, token = 'owner', keys) {
  const query = keys ? '?' + keys.map(key => 'updateMask.fieldPaths=' + encodeURIComponent(key)).join('&') : '';
  return globalThis.fetch(origin + id + query, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(data && { body: JSON.stringify({ fields: value(data).mapValue.fields }) }) });
}
async function existing(t, rich = true) {
  const id = 'settings-rules-' + (++counter), data = { id, owner: 'study-owner', title: 'Study', ...settings(),
    ...(rich && { storageProvider: 'googledrive', publishedConfiguration: { storageProvider: 'googledrive' }, sessions: 9 }) };
  const seeded = await request(id, 'PATCH', data); assert.equal(seeded.status, 200, await seeded.text());
  t.after(async () => { await request(id, 'DELETE'); });
  return { id, data };
}
test('settings rules: AC04 owner saves complete settings without changing publication or counters', async t => {
  const { id, data } = await existing(t), changed = settings(); changed.batchConfig = { useIndexedDB: false, batchSize: 7, resumeTimeoutMinutes: 1 };
  changed.recruitmentConfig = { platform: 'prolific', prolificCompletionCode: '' };
  changed.captchaConfig = { enabled: true, provider: 'recaptcha', siteKey: 'public-key' };
  const saved = await request(id, 'PATCH', changed, jwt('study-owner'), Object.keys(changed)); assert.equal(saved.status, 200, await saved.text());
  const stored = await (await request(id, 'GET')).json();
  assert.deepEqual(stored.fields, value({ ...data, ...changed }).mapValue.fields);
});
for (const token of ['another-owner', null]) test('settings rules: AC04 rejects ' + (token || 'unauthenticated participant'), async t => {
  const { id, data } = await existing(t);
  const denied = await request(id, 'PATCH', settings(), token && jwt(token), Object.keys(settings()));
  assert.equal(denied.status, 403); assert.deepEqual((await (await request(id, 'GET')).json()).fields, value(data).mapValue.fields);
});
for (const [name, change] of [
  ['IndexedDB type', s => { s.batchConfig.useIndexedDB = 'false'; }],
  ['negative batch', s => { s.batchConfig.batchSize = -1; }], ['fractional batch', s => { s.batchConfig.batchSize = 1.5; }],
  ['unsafe batch', s => { s.batchConfig.batchSize = 9007199254740992; }],
  ['zero timeout', s => { s.batchConfig.resumeTimeoutMinutes = 0; }], ['fractional timeout', s => { s.batchConfig.resumeTimeoutMinutes = 1.5; }],
  ['too long timeout', s => { s.batchConfig.resumeTimeoutMinutes = 1441; }],
  ['missing group', s => { s.batchConfig = null; }], ['missing field', s => { delete s.batchConfig.batchSize; }],
  ['extra field', s => { s.batchConfig.injected = true; }],
  ['platform', s => { s.recruitmentConfig.platform = 'other'; }], ['completion code type', s => { s.recruitmentConfig.prolificCompletionCode = 2; }],
  ['CAPTCHA enabled type', s => { s.captchaConfig.enabled = 'false'; }], ['CAPTCHA provider', s => { s.captchaConfig.provider = 'other'; }],
  ['CAPTCHA site key type', s => { s.captchaConfig.siteKey = false; }],
  ['CAPTCHA empty key', s => { s.captchaConfig.enabled = true; }],
  ['CAPTCHA whitespace key', s => { s.captchaConfig = { enabled: true, provider: 'hcaptcha', siteKey: '\n \t\u00a0' }; }],
]) test('settings rules: AC04 rejects ' + name + ' atomically', async t => {
  const { id, data } = await existing(t), changed = settings(); change(changed);
  const saved = await request(id, 'PATCH', changed, jwt('study-owner'), Object.keys(changed));
  assert.equal(saved.status, 403, await saved.text());
  assert.deepEqual((await (await request(id, 'GET')).json()).fields, value(data).mapValue.fields);
});
for (const batchSize of [0, 1, 7, Number.MAX_SAFE_INTEGER]) test('settings rules: AC04 accepts batch ' + batchSize + ' and timeout 1440', async t => {
  const { id } = await existing(t), changed = settings(); changed.batchConfig.batchSize = batchSize; changed.batchConfig.resumeTimeoutMinutes = 1440;
  const saved = await request(id, 'PATCH', changed, jwt('study-owner'), Object.keys(changed)); assert.equal(saved.status, 200, await saved.text());
});
test('settings rules: owner identity and publication fields cannot be replaced through settings writes', async t => {
  const { id } = await existing(t, false);
  for (const change of [{ owner: 'another-owner' }, { publishedConfiguration: { storageProvider: 'dropbox' } }]) {
    const saved = await request(id, 'PATCH', change, jwt('study-owner'), Object.keys(change)); assert.equal(saved.status, 403, await saved.text());
  }
});
test('settings rules: AC04 validates settings on document creation too', async t => {
  const id = 'settings-rules-created'; t.after(async () => { await request(id, 'DELETE'); });
  const data = { id, owner: 'study-owner', ...settings() }; data.batchConfig.resumeTimeoutMinutes = 0;
  assert.equal((await request(id, 'PATCH', data, jwt('study-owner'))).status, 403);
  assert.equal((await request(id, 'GET')).status, 404);
  data.batchConfig.resumeTimeoutMinutes = 1;
  const saved = await request(id, 'PATCH', data, jwt('study-owner')); assert.equal(saved.status, 200, await saved.text());
});
