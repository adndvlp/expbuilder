import { jest } from '@jest/globals';
import { store, base, realtime, setup, request, create, resume, activate, presence, connection, event } from './lifecycle-test-harness.js';
import { makeReq, makeRes } from '../../helpers/firestore-mock.js';
let time = 100000;
beforeEach(() => { setup(); time = 100000; jest.spyOn(Date, 'now').mockImplementation(() => time); });
afterEach(() => jest.restoreAllMocks());
async function connected() { await create(); presence('C1', 1, true, time); await activate(); }
const append = () => request({ action: 'appendEvents', ...connection(), data: { protocolVersion: 1, events: [event(0)] } });
test('concurrent creation retries allocate one participant and retain their writer grant', async () => {
  const results = await Promise.all([create(), create()]);
  expect(results.map(item => item.jsonBody.participantNumber)).toEqual([0, 0]);
  expect(store.records.get('experiments/EID').sessions).toBe(1);
  expect(store.records.get(base).connectionGeneration).toBe(1);
});
test('limits do not prevent valid resume, but do prevent an explicit new participation', async () => {
  await connected(); presence('C1', 1, false, 120000); time = 130000;
  store.records.set('experiments/EID', { ...store.records.get('experiments/EID'), limitSessions: true, maxSessions: 1 });
  expect((await resume()).jsonBody.decision).toBe('resume_allowed');
  expect((await request({ action: 'createSession', sessionId: 'S2', sessionProtocolVersion: 3, publicationId: 'pub-A', executionRevision: 'rev-A', ...connection('C3') })).statusCode).toBe(409);
});
test('a never-armed initial connection eventually expires and does not lock participation forever', async () => {
  await create(); time = 190000;
  expect((await resume()).jsonBody).toMatchObject({ lifecycle: 'expired', decision: 'session_expired' });
  expect(store.records.get(base).closedAt).toBe(new Date(190000).toISOString());
});
test('a duplicate received event is still acknowledged after timeout without reopening execution', async () => {
  await connected(); await append(); presence('C1', 1, false, 120000); time = 180000;
  const result = await append();
  expect(result.statusCode).toBe(200); expect(result.jsonBody.acknowledged).toHaveLength(1);
  expect(store.records.get(base)).toMatchObject({ lifecycle: 'expired', receivedEventCount: 1 });
  expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ eventCount: 1, destination: { folder: 'original-folder' } });
});
test('a missing original artifact blocks a changed graph without deleting pending data', async () => {
  await connected(); await append(); presence('C1', 1, false, 120000); time = 130000;
  store.records.delete('experiments/EID/publications/pub-A');
  expect((await resume('C2', 'pub-B', 'rev-B')).jsonBody.decision).toBe('revision_unavailable');
  expect(store.records.get(base)).toMatchObject({ publicationId: 'pub-A', receivedEventCount: 1, connectionGeneration: 1 });
});
test('an old public creation shape cannot bypass the new protocol and obtain execution access', async () => {
  await connected(); const result = await request({});
  expect(result.statusCode).toBe(409);
  expect(store.records.get('experiments/EID').sessions).toBe(1);
});
test('recovery can be the first operation to discover expiry without falsely confirming its newly recovered export', async () => {
  await connected(); presence('C1', 1, false, 120000); time = 180000;
  expect((await request({ action: 'recoverEvents', data: { protocolVersion: 1, events: [event(0)] } })).statusCode).toBe(201);
  expect(store.records.get(base)).toMatchObject({ lifecycle: 'expired', exportRequestedRevision: 1, exportStatus: 'pending' });
  expect(store.records.get(base).exportConfirmedRevision || 0).toBe(0);
  expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ status: 'pending', eventCount: 1 });
});
test('the legacy complete endpoint cannot bypass a protocol 3 session', async () => {
  await connected();
  const { apiDataComplete } = await import('../../../experiment/sessions/api/data-complete.js');
  const response = makeRes();
  await apiDataComplete(makeReq({ body: { experimentID: 'EID', sessionId: 'S1', trialsData: [{ response: 'unverified' }] } }), response);
  expect(response.statusCode).toBe(409);
  expect(store.records.get(base).lifecycle).toBe('active');
});
test('a legacy timeout without a generation cannot close the current protocol 3 writer', async () => {
  await connected(); time = 200000;
  realtime.set('sessions/EID/S1', { state: 'disconnected', connected: false, resumeExpiresAt: 180000 });
  const { handleSessionTimeoutTask } = await import('../../../experiment/sessions/timeout/tasks.js');
  await handleSessionTimeoutTask({ experimentID: 'EID', sessionId: 'S1', expiresAt: 180000 });
  expect(store.records.get(base)).toMatchObject({ lifecycle: 'active', connectionGeneration: 1 });
  expect(store.records.has(base + '/export_jobs/1')).toBe(false);
});
test('the legacy whole-file endpoint cannot overwrite a versioned publication', async () => {
  await connected();
  const response = await request({ sessionId: undefined, filename: 'EID_S1.csv', data: 'response\nunverified' });
  expect(response.statusCode).toBe(409);
  expect(store.records.has(base + '/export_jobs/1')).toBe(false);
});
