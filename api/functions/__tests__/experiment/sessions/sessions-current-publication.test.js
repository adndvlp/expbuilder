import { jest } from '@jest/globals';
import { store, base, setup, request, connection, realtimeWrites } from './lifecycle-test-harness.js';

const configuration = () => ({ batchConfig: { useIndexedDB: true, batchSize: 1, resumeTimeoutMinutes: 1 },
  storageProvider: 'googledrive', exportDestination: { provider: 'googledrive', owner: 'owner', folder: 'published-folder' },
  validation: { useValidation: true, allowJSON: true, requiredFields: ['trial_type'] } });
const create = extra => request({ action: 'createSession', sessionProtocolVersion: 3, ...connection(), ...extra });
beforeEach(() => {
  setup(); store.records.clear();
  store.records.set('experiments/EID', { active: true, owner: 'owner', sessions: 0, currentCondition: 0, nConditions: 1,
    publishedConfiguration: configuration(), batchConfig: { useIndexedDB: false, batchSize: 9, resumeTimeoutMinutes: 30 } });
  jest.spyOn(Date, 'now').mockReturnValue(100000);
});
afterEach(() => jest.restoreAllMocks());

test('starts from the one published configuration without any publication ID or history document', async () => {
  const response = await create();
  expect(response.statusCode).toBe(201);
  expect(response.jsonBody).toMatchObject({ decision: 'resume_allowed', sessionProtocolVersion: 3, participantNumber: 0,
    configuration: configuration(), connection: { id: 'C1', generation: 1 } });
  expect(store.records.get(base).configuration).toEqual(configuration());
  expect(store.records.get(base).exportDestination.folder).toBe('published-folder');
  for (const key of ['publicationId', 'executionRevision', 'artifactUrl', 'entryUrl']) {
    expect(response.jsonBody).not.toHaveProperty(key); expect(store.records.get(base)).not.toHaveProperty(key);
  }
  expect([...store.records.keys()].sort()).toEqual(['experiments/EID', base]);
});

test('registration retry preserves identity and frozen settings after another publication', async () => {
  expect((await create()).statusCode).toBe(201);
  const experiment = store.records.get('experiments/EID');
  experiment.publishedConfiguration = { ...configuration(), batchConfig: { useIndexedDB: false, batchSize: 9, resumeTimeoutMinutes: 30 } };
  const response = await create();
  expect(response.statusCode).toBe(200);
  expect(response.jsonBody).toMatchObject({ participantNumber: 0, configuration: configuration(), connection: { generation: 1 } });
  expect(experiment.sessions).toBe(1); expect(experiment.currentCondition).toBe(1);
});

test('the handshake returns the current public contract instead of forwarding private or retired document fields', async () => {
  await create();
  const data = store.records.get(base), checkpoint = { completed: { builderId: 'A', eventId: 'event-0', sequence: 0 }, cursor: { targetId: 'B' } };
  Object.assign(data, { publicationId: 'obsolete', executionRevision: 'obsolete', artifactUrl: '/obsolete', entryUrl: '/obsolete',
    extraInternalField: 'private', resumeCheckpoint: checkpoint, resumeCheckpointSequence: 0, receivedEventCount: 1 });
  store.records.set(base + '/event_receipts/event-0', { eventId: 'event-0', sequence: 0, payloadHash: 'a'.repeat(64) });
  const before = structuredClone(data), response = await create();
  expect(response.statusCode).toBe(200);
  expect(response.jsonBody).toMatchObject({ experimentID: 'EID', sessionId: 'S1', participantNumber: 0, condition: 0,
    sessionProtocolVersion: 3, eventProtocolVersion: 1, lifecycle: 'active', configuration: configuration(),
    connection: { id: 'C1', generation: 1, phase: 'connecting' }, receivedEventCount: 1,
    resumeCheckpoint: checkpoint, resumeCheckpointSequence: 0,
    receivedEvents: [{ eventId: 'event-0', sequence: 0, payloadHash: 'a'.repeat(64) }] });
  for (const key of ['publicationId', 'executionRevision', 'artifactUrl', 'entryUrl', 'writeTokenHash', 'extraInternalField']) {
    expect(response.jsonBody).not.toHaveProperty(key);
  }
  expect(store.records.get(base)).toEqual(before);
});

test('client configuration and unpublished editor settings cannot replace the server published configuration', async () => {
  const response = await create({ configuration: { ...configuration(), batchConfig: { useIndexedDB: false, batchSize: 1, resumeTimeoutMinutes: 100 } } });
  expect(response.statusCode).toBe(201);
  expect(response.jsonBody.configuration).toEqual(configuration());
});

test('an unpublished experiment cannot allocate a session or writer lease', async () => {
  delete store.records.get('experiments/EID').publishedConfiguration;
  const response = await create();
  expect(response.statusCode).toBe(409);
  expect(store.records.has(base)).toBe(false); expect(realtimeWrites).toEqual([]);
  expect(store.records.get('experiments/EID').sessions).toBe(0);
});

test('new registration waits for an in-progress publication without allocating a participant', async () => {
  store.records.get('experiments/EID').publicationLeaseUntil = 200000;
  const response = await create();
  expect(response.statusCode).toBe(409);
  expect(store.records.has(base)).toBe(false); expect(realtimeWrites).toEqual([]);
  expect(store.records.get('experiments/EID').sessions).toBe(0);
});

test('a failed registration transaction leaves counters and writer leases unchanged', async () => {
  store.failNextCommit(new Error('transaction failed'));
  expect((await create()).statusCode).toBe(503);
  expect(store.records.has(base)).toBe(false); expect(realtimeWrites).toEqual([]);
  expect(store.records.get('experiments/EID')).toMatchObject({ sessions: 0, currentCondition: 0 });
});
