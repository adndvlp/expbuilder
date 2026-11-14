import { jest } from '@jest/globals';
import { store, base, setup, request, connection, realtimeWrites, presence, activate } from './lifecycle-test-harness.js';
import { createDefaultPublicSettings } from '../../../experiment/settings.js';

const saved = () => ({ ...createDefaultPublicSettings(), batchConfig: { useIndexedDB: false, batchSize: 7, resumeTimeoutMinutes: 45 },
  recruitmentConfig: { platform: 'prolific', prolificCompletionCode: 'LATEST' },
  captchaConfig: { enabled: true, provider: 'recaptcha', siteKey: 'latest-key' } });
const create = extra => request({ action: 'createSession', sessionProtocolVersion: 3, ...connection(), ...extra });
beforeEach(() => {
  setup(); Object.assign(store.records.get('experiments/EID'), saved());
  jest.spyOn(Date, 'now').mockReturnValue(100000);
});
afterEach(() => jest.restoreAllMocks());

test('new sessions combine saved public settings with the published destination and validation', async () => {
  const experiment = store.records.get('experiments/EID');
  experiment.publishedConfiguration.captchaConfig = { enabled: false };
  const response = await create({ configuration: { ...saved(), batchConfig: { useIndexedDB: true, batchSize: 99, resumeTimeoutMinutes: 1 } } });
  expect(response.statusCode).toBe(201);
  expect(response.jsonBody.configuration).toEqual({ ...saved(), storageProvider: 'googledrive',
    exportDestination: { provider: 'googledrive', owner: 'owner', folder: 'original-folder' },
    validation: experiment.publishedConfiguration.validation });
  expect(store.records.get(base).configuration).toEqual(response.jsonBody.configuration);
});

test.each([
  ['missing batch', x => { delete x.batchConfig; }],
  ['missing recruitment', x => { delete x.recruitmentConfig; }],
  ['missing captcha', x => { delete x.captchaConfig; }],
  ['invalid timeout', x => { x.batchConfig.resumeTimeoutMinutes = 0; }],
  ['invalid batch', x => { x.batchConfig.batchSize = 1.5; }],
  ['invalid captcha', x => { x.captchaConfig.siteKey = ' '; }],
  ['invalid recruitment', x => { x.recruitmentConfig.platform = 'unknown'; }],
])('%s cannot allocate a participant, session or writer lease', async (_label, change) => {
  const experiment = store.records.get('experiments/EID'); change(experiment);
  const before = structuredClone(experiment), response = await create();
  expect(response.statusCode).toBe(400);
  expect(response.jsonBody.message).toMatch(/save.*settings/i);
  expect(store.records.has(base)).toBe(false);
  expect(store.records.get('experiments/EID')).toEqual(before);
  expect(realtimeWrites).toEqual([]);
});

test('registration retry, activation and resume keep the original settings after another save', async () => {
  const initial = (await create()).jsonBody;
  const checkpoint = { completed: { builderId: 'A', sequence: 0, eventId: 'saved-event' }, cursor: { targetId: 'B' } };
  store.records.get(base).resumeCheckpoint = checkpoint;
  Object.assign(store.records.get('experiments/EID'), createDefaultPublicSettings());
  expect((await create()).jsonBody.configuration).toEqual(initial.configuration);
  presence('C1', 1, true, Date.now());
  expect((await activate()).jsonBody.configuration).toEqual(initial.configuration);
  const next = await create({ sessionId: 'S2', ...connection('C2') });
  expect(next.statusCode).toBe(201);
  expect(next.jsonBody.configuration).toMatchObject(createDefaultPublicSettings());
  expect(next.jsonBody.participantNumber).toBe(1);
  const resumed = await request({ action: 'resumeSession', ...connection(), renewConnection: true });
  expect(resumed.statusCode).toBe(200);
  expect(resumed.jsonBody.configuration).toEqual(initial.configuration);
  expect(resumed.jsonBody.resumeCheckpoint).toEqual(checkpoint);
  expect(store.records.get('experiments/EID').sessions).toBe(2);
});

test.each([true, false])('a save overlapping registration is observed as a complete configuration; save first=%s', async saveFirst => {
  const changes = createDefaultPublicSettings();
  const save = () => store.db.runTransaction(async transaction => {
    transaction.set(store.db.collection('experiments').doc('EID'), changes, { merge: true });
  });
  await Promise.all(saveFirst ? [save(), create()] : [create(), save()]);
  expect(store.records.get(base).configuration).toMatchObject(saveFirst ? changes : saved());
  expect(store.records.get('experiments/EID')).toMatchObject(changes);
});

test('saving a shorter timeout keeps the original deadline and applies it only to a new session', async () => {
  await create(); presence('C1', 1, true, Date.now()); await activate();
  presence('C1', 1, false, 120000); Date.now.mockReturnValue(130000);
  await request({ action: 'sessionStatus' });
  const deadline = 120000 + 45 * 60000;
  expect(store.records.get(base).resumeExpiresAt).toBe(deadline);
  store.records.get('experiments/EID').batchConfig.resumeTimeoutMinutes = 1;
  await request({ action: 'sessionStatus' });
  expect(store.records.get(base).resumeExpiresAt).toBe(deadline);
  const next = await create({ sessionId: 'S2', ...connection('C2') });
  expect(next.jsonBody.configuration.batchConfig.resumeTimeoutMinutes).toBe(1);
  Date.now.mockReturnValue(deadline - 1);
  expect((await request({ action: 'sessionStatus' })).jsonBody.lifecycle).toBe('disconnected');
  Date.now.mockReturnValue(deadline);
  expect((await request({ action: 'sessionStatus' })).jsonBody.lifecycle).toBe('expired');
});

test('invalid editor settings do not block retrying a session that already committed', async () => {
  const initial = (await create()).jsonBody;
  delete store.records.get('experiments/EID').captchaConfig;
  const response = await create();
  expect(response.statusCode).toBe(200);
  expect(response.jsonBody.configuration).toEqual(initial.configuration);
  expect(response.jsonBody.participantNumber).toBe(initial.participantNumber);
  expect(store.records.get('experiments/EID').sessions).toBe(1);
});
