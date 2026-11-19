import { jest } from '@jest/globals';
import { makeTransactionalFirestore } from '../../helpers/transactional-firestore.js';
import { makeReq, makeRes } from '../../helpers/firestore-mock.js';
import { createHash } from 'node:crypto';
import { createDefaultPublicSettings } from '../../../experiment/settings.js';

export const store = makeTransactionalFirestore(), realtime = new Map(), realtimeWrites = [];
export const base = 'experiments/EID/sessions/S1';
export const token = 'writer-token-'.repeat(4);
export const connection = (id = 'C1', generation = 1) => ({ connectionId: id, connectionGeneration: generation, writeToken: token });
export const enqueue = jest.fn(async () => {});
export const rtdb = { ref: path => ({
  once: async () => ({ val: () => realtime.get(path) ?? null }),
  set: async value => { realtimeWrites.push({ path, value }); realtime.set(path, structuredClone(value)); },
  update: async value => { realtimeWrites.push({ path, value }); realtime.set(path, { ...realtime.get(path), ...value }); },
  remove: async () => { realtime.delete(path); },
}) };
jest.unstable_mockModule('../../../app.js', () => ({ db: store.db, app: {} }));
jest.unstable_mockModule('firebase-admin/database', () => ({ getDatabase: () => rtdb }));
jest.unstable_mockModule('firebase-admin/firestore', () => ({ FieldValue: { increment: value => ({ __op: 'increment', value }) } }));
jest.unstable_mockModule('firebase-functions/v2/https', () => ({ onRequest: (_options, handler) => handler }));
jest.unstable_mockModule('firebase-functions/v2/database', () => ({ onValueWritten: (_options, handler) => handler }));
jest.unstable_mockModule('firebase-functions/v2/tasks', () => ({ onTaskDispatched: (_options, handler) => handler }));
jest.unstable_mockModule('firebase-admin/functions', () => ({ getFunctions: () => ({ taskQueue: () => ({ enqueue }) }) }));
jest.unstable_mockModule('../../../experiment/sessions/logging/write-log.js', () => ({ default: async () => {} }));
jest.unstable_mockModule('../../../utils/fetch-with-timeout.js', () => ({ default: async () => { throw new Error('Unexpected external service call'); } }));
const { apiData } = await import('../../../experiment/sessions/api/data-router.js');
export const request = async body => {
  const response = makeRes(); await apiData(makeReq({ body: { experimentID: 'EID', sessionId: 'S1', ...body } }), response); return response;
};
export const create = (id = 'C1') => request({ action: 'createSession', sessionProtocolVersion: 3, ...connection(id) });
export const resume = (id = 'C2') => request({ action: 'resumeSession', sessionProtocolVersion: 3, ...connection(id) });
export function presence(id, generation, connected, changedAt) {
  realtime.set(`session_connections/EID/S1/${id}`, { generation, connected, changedAt, token });
}
export const activate = (id = 'C1', generation = 1) => request({ action: 'activateConnection', ...connection(id, generation) });
export function event(sequence, response = String(sequence)) {
  const payload = { response, trial_type: 'test' };
  return { eventId: 'event-' + sequence, sequence, payload, payloadHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}
export function setup(indexed = true, provider = 'googledrive') {
  store.reset(); realtime.clear(); realtimeWrites.length = 0; enqueue.mockClear();
  store.records.set('experiments/EID', { ...createDefaultPublicSettings(), active: true, owner: 'owner', sessions: 0, currentCondition: 0, nConditions: 1,
    sessionExportProtocolVersion: 1, batchConfig: { useIndexedDB: indexed, batchSize: 1, resumeTimeoutMinutes: 1 }, storageProvider: provider,
    driveFolderId: 'new-folder', dropboxFolder: '/new-folder', osfUploadLink: 'https://files.osf.io/new-folder/',
    publishedConfiguration: { storageProvider: provider,
      exportDestination: { provider, owner: 'owner', folder: 'original-folder' }, validation: { useValidation: true, allowJSON: true, requiredFields: ['trial_type'] } } });
}
