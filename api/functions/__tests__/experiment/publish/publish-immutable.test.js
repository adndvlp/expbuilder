import { jest } from '@jest/globals';
import { makeTransactionalFirestore } from '../../helpers/transactional-firestore.js';
const store = makeTransactionalFirestore(), files = new Map();
const upload = jest.fn(async (_token, _owner, _repo, path, content) => { files.set(path, content); return { success: true }; });
jest.unstable_mockModule('../../../app.js', () => ({ db: store.db }));
jest.unstable_mockModule('../../../experiment/hosting/services.js', () => ({ uploadFileGithub: upload }));
const publish = async (batch = { useIndexedDB: true, batchSize: 1, resumeTimeoutMinutes: 1 }, code = 'A') => {
  const { publishImmutableArtifact } = await import('../../../experiment/publish/immutable.js');
  return publishImmutableArtifact({ accessToken: 'token', owner: 'lab', repoName: 'study', experimentID: 'EID',
    htmlContent: `<html><head></head><body><script>const _PUBLIC_PUBLICATION_CONFIG = ${JSON.stringify({ batchConfig: batch })}; const _PUBLIC_PUBLICATION_ID = '__PUBLICATION_ID__'; const _PUBLIC_EXECUTION_REVISION = '__EXECUTION_REVISION__';</script>${code}<img src="img/a.png"></body></html>`,
    mediaFiles: [{ type: 'img', filename: 'a.png', content: Buffer.from(code).toString('base64') }] });
};
beforeEach(() => { store.reset(); files.clear(); upload.mockClear(); store.records.set('experiments/EID', { owner: 'uid', storageProvider: 'googledrive', driveFolderId: 'original', requiredFields: ['trial_type'] }); });
test('ON → OFF → ON keeps HTML, media, destination and configuration for every prior publication', async () => {
  const first = await publish(); const original = files.get(`publications/${first.publicationId}/index.html`);
  await publish({ useIndexedDB: false, batchSize: 20, resumeTimeoutMinutes: 30 }, 'B');
  await publish(undefined, 'C');
  expect(files.get(`publications/${first.publicationId}/index.html`)).toBe(original);
  expect(String(files.get(`publications/${first.publicationId}/img/a.png`))).toBe('A');
  expect(store.records.get(`experiments/EID/publications/${first.publicationId}`)).toMatchObject({ status: 'ready', configuration: {
    batchConfig: { useIndexedDB: true, batchSize: 1, resumeTimeoutMinutes: 1 }, exportDestination: { folder: 'original' } } });
  expect(String(files.get('index.html'))).toContain('<base href="./publications/');
});
test('a failed immutable media upload leaves the published entry and active manifest unchanged', async () => {
  const first = await publish(), entry = files.get('index.html');
  upload.mockImplementationOnce(async () => ({ success: false, errorText: 'unavailable' }));
  await expect(publish(undefined, 'B')).rejects.toThrow();
  expect(files.get('index.html')).toBe(entry);
  expect(store.records.get('experiments/EID').activePublicationId).toBe(first.publicationId);
});
test.each([0, 1.5, 1441])('rejects unsupported timeout %s before uploading', async minutes => {
  await expect(publish({ useIndexedDB: false, batchSize: 1, resumeTimeoutMinutes: minutes })).rejects.toThrow();
  expect(upload).not.toHaveBeenCalled();
});
test('concurrent publications cannot race the mutable entry against its active manifest', async () => {
  let release, entered;
  const blocked = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  upload.mockImplementationOnce(async () => { entered(); await blocked; return { success: true }; });
  const first = publish(undefined, 'first'); await started;
  try { await expect(publish(undefined, 'second')).rejects.toMatchObject({ status: 409 }); }
  finally { release(); }
  const result = await first;
  expect(store.records.get('experiments/EID').activePublicationId).toBe(result.publicationId);
});
