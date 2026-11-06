import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import CSV from 'csv-string';
import { makeTransactionalFirestore } from '../../helpers/transactional-firestore.js';
import { makeReq, makeRes } from '../../helpers/firestore-mock.js';

export const store = makeTransactionalFirestore();
export const base = 'experiments/EID/sessions/S1';
let realtimeState = { state: 'in-progress' };
export const setRealtimeState = value => { realtimeState = value; };
export const realtimeUpdates = [];
export const providerHttp = jest.fn(async () => { throw new Error('Unexpected provider request in isolated job test'); });
jest.unstable_mockModule('../../../app.js', () => ({ db: store.db, app: {} }));
jest.unstable_mockModule('firebase-functions/v2/https', () => ({ onRequest: (_options, handler) => handler }));
jest.unstable_mockModule('firebase-admin/firestore', () => ({ FieldValue: { increment: value => ({ __op: 'increment', value }) } }));
jest.unstable_mockModule('firebase-admin/database', () => ({ getDatabase: () => ({ ref: () => ({
  once: async () => ({ val: () => realtimeState }), update: async value => { realtimeUpdates.push(value); },
}) }) }));
jest.unstable_mockModule('../../../experiment/sessions/logging/write-log.js', () => ({ default: async () => {} }));
jest.unstable_mockModule('../../../oauth/index.js', () => ({ getValidToken: async () => ({ success: true, access_token: 'token' }) }));
jest.unstable_mockModule('../../../utils/fetch-with-timeout.js', () => ({ default: providerHttp }));
const { apiData } = await import('../../../experiment/sessions/api/data-router.js');

export const hash = value => createHash('sha256').update(value).digest('hex');
export function event(sequence, response = String(sequence)) {
  const payload = { response, trial_type: 'test' };
  return { eventId: 'event-' + sequence, sequence, payload, payloadHash: hash(JSON.stringify(payload)), checkpoint: { completed: response } };
}
export function expected(events) {
  return { expectedEventCount: events.length, expectedLastSequence: events.length - 1,
    eventsHash: hash(JSON.stringify(events.map(({ eventId, payloadHash, sequence }) => ({ eventId, payloadHash, sequence })))) };
}
export async function request(body) {
  const response = makeRes();
  await apiData(makeReq({ body: { experimentID: 'EID', sessionId: 'S1', ...body } }), response);
  return response;
}
export const append = events => request({ action: 'appendEvents', data: { protocolVersion: 1, events } });
export const recover = events => request({ action: 'recoverEvents', data: { protocolVersion: 1, events } });
export const close = events => request({ action: 'completeSession', ...expected(events) });
export const status = () => request({ action: 'sessionStatus' });
export const processJob = async (revision, adapter, now) => {
  const { processSessionExport } = await import('../../../experiment/sessions/export/process.js');
  return processSessionExport({ experimentID: 'EID', sessionId: 'S1', revision }, { adapter, now });
};
export const requestExport = async () => {
  const { requestSessionExport } = await import('../../../experiment/sessions/export/request.js');
  return requestSessionExport('EID', 'S1');
};
export function setup(provider = 'osf') {
  store.reset();
  providerHttp.mockReset(); providerHttp.mockImplementation(async () => { throw new Error('Unexpected provider request in isolated job test'); });
  realtimeState = { state: 'in-progress' }; realtimeUpdates.length = 0;
  store.records.set('experiments/EID', { active: true, sessions: 1, storageProvider: provider, owner: 'owner', osfUploadLink: 'folder', driveFolderId: 'folder', dropboxFolder: '/folder' });
  store.records.set(base, { experimentID: 'EID', sessionId: 'S1', participantNumber: 23, condition: 0, createdAt: '2026-11-05T00:00:00Z',
    sessionProtocolVersion: 2, eventProtocolVersion: 1, lifecycle: 'active', trialCount: 0, receivedEventCount: 0, metadata: { browser: 'Chrome' }, sessionName: 'Subject A' });
  store.records.set('experiments/EID/session_metadata/S1', { sessionName: 'Subject A' });
}
export function fakeAdapter(conditional = true) {
  let csv = null, version = 0;
  const resource = () => ({ provider: 'test', id: 'stable-file', revision: String(version), fileUrl: 'https://storage.test/stable-file' });
  const adapter = {
    conditional,
    reserve: jest.fn(async () => resource()),
    read: jest.fn(async () => ({ exists: csv !== null, csv, resource: resource(), version: String(version) })),
    write: jest.fn(async (_resource, body, previous) => {
      if (conditional && String(version) !== previous.version) throw Object.assign(new Error('revision conflict'), { status: 409, noEffect: true });
      csv = body; version++;
      return resource();
    }),
    get csv() { return csv; },
    set csv(value) { csv = value; version++; },
    rows() { const table = CSV.parse(csv ?? ''); return table.slice(1).map(row => Object.fromEntries(table[0].map((key, i) => [key, row[i]]))); },
  };
  return adapter;
}
