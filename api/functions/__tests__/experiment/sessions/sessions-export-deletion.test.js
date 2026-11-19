import { jest } from '@jest/globals';
import { makeTransactionalFirestore } from '../../helpers/transactional-firestore.js';
import { makeReq, makeRes } from '../../helpers/firestore-mock.js';
const store = makeTransactionalFirestore(), removeFile = jest.fn(async () => ({ success: true }));
const collectionPaths = [], removePresence = jest.fn(async () => {}), originalCollection = store.db.collection;
store.db.collection = name => {
  const collection = originalCollection(name), doc = collection.doc;
  return { ...collection, doc: id => {
    const ref = doc(id), subcollection = ref.collection;
    ref.collection = child => { collectionPaths.push(`${ref.path}/${child}`); return subcollection(child); };
    return ref;
  } };
};
jest.unstable_mockModule('../../../app.js', () => ({ db: store.db, app: {} }));
jest.unstable_mockModule('../../../experiment/sessions/logging/write-log.js', () => ({ default: async () => {} }));
jest.unstable_mockModule('../../../oauth/index.js', () => ({ getValidToken: async () => ({ success: true, access_token: 'token' }) }));
jest.unstable_mockModule('../../../experiment/sessions/storage.js', () => ({ deleteSession: removeFile }));
jest.unstable_mockModule('firebase-admin/database', () => ({ getDatabase: () => ({ ref: path => ({ remove: () => removePresence(path) }) }) }));
jest.unstable_mockModule('../../../experiment/sessions/services/folder.js', () => ({ deleteFolder: async () => ({ success: true }) }));
jest.unstable_mockModule('../../../experiment/hosting/services.js', () => ({ deleteRepositoryGithub: async () => ({ success: true }) }));
const { handleDeleteSession } = await import('../../../experiment/sessions/handlers/delete-session.js');
const base = 'experiments/EID/sessions/S1';
beforeEach(() => {
  store.reset(); removeFile.mockClear(); removePresence.mockClear(); collectionPaths.length = 0;
  store.records.set('experiments/EID', { owner: 'owner', storageProvider: 'osf', sessions: 1 });
  store.records.set(base, { sessionProtocolVersion: 2, exportRequestedRevision: 1, exportConfirmedRevision: 0, exportFence: 1 });
  store.records.set(base + '/event_receipts/A', { eventId: 'A' });
  store.records.set(base + '/trials/A', { response: 'A' });
  store.records.set(base + '/export_jobs/1', { status: 'pending', dispatchDue: true });
  store.records.set(base + '/export_jobs/1/chunks/0', { data: 'snapshot' });
  store.records.set(base + '/recovery_sources/original', { data: 'original backup' });
  store.records.set(base + '/recovery_plans/plan', { status: 'export_requested' });
});
test.each([2, 3])('deleting a protocol %s session stops its jobs and removes new child resources', async version => {
  store.records.set(base, { ...store.records.get(base), sessionProtocolVersion: version });
  const res = makeRes(); await handleDeleteSession(makeReq(), res, 'EID', 'S1');
  expect(res.statusCode).toBe(200);
  expect([...store.records.keys()].filter(key => key.startsWith(base))).toEqual([]);
  expect(store.records.get('experiments/EID').sessions).toBe(0);
  expect(removeFile).toHaveBeenCalledTimes(1);
});
test('deleting a session with an active or uncertain writer preserves both copies until the write is reconciled', async () => {
  store.records.set(base + '/export_jobs/1', { status: 'reconciling', phase: 'writing', dispatchDue: true });
  const res = makeRes(); await handleDeleteSession(makeReq(), res, 'EID', 'S1');
  expect(res.statusCode).toBe(409);
  expect(removeFile).not.toHaveBeenCalled();
  expect(store.records.has(base + '/trials/A')).toBe(true);
});
test('current experiment deletion removes session data and presence without consulting publication history', async () => {
  store.records.set(base, { ...store.records.get(base), sessionProtocolVersion: 3 });
  store.records.set('experiments/EID', { ...store.records.get('experiments/EID'), sessionExportProtocolVersion: 1 });
  store.records.set('experiments/another/sessions/S2/trials/B', { response: 'keep' });
  const { deleteExperiment } = await import('../../../experiment/delete.js');
  await deleteExperiment('EID', null);
  expect([...store.records.keys()].filter(key => key.startsWith('experiments/EID'))).toEqual([]);
  expect(collectionPaths).not.toContain('experiments/EID/publications');
  expect(removePresence.mock.calls.map(([path]) => path).sort()).toEqual(['session_connection_leases/EID', 'session_connections/EID', 'sessions/EID']);
  expect(store.records.get('experiments/another/sessions/S2/trials/B')).toEqual({ response: 'keep' });
});
test('experiment deletion waits for uncertain writes instead of removing their only recoverable copies', async () => {
  store.records.set('experiments/EID', { ...store.records.get('experiments/EID'), sessionExportProtocolVersion: 1 });
  store.records.set(base + '/export_jobs/1', { experimentID: 'EID', status: 'reconciling', phase: 'writing' });
  const { deleteExperiment } = await import('../../../experiment/delete.js');
  await expect(deleteExperiment('EID', null)).rejects.toMatchObject({ status: 409 });
  expect(store.records.has(base + '/trials/A')).toBe(true);
});
test('experiment deletion waits for an in-flight publication so it cannot overwrite the deletion', async () => {
  store.records.set('experiments/EID', { ...store.records.get('experiments/EID'), publicationLeaseUntil: Date.now() + 60000 });
  const { deleteExperiment } = await import('../../../experiment/delete.js');
  await expect(deleteExperiment('EID', null)).rejects.toMatchObject({ status: 409 });
  expect(store.records.has('experiments/EID')).toBe(true);
});
