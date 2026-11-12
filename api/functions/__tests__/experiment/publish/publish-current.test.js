import { jest } from '@jest/globals';
import { makeTransactionalFirestore } from '../../helpers/transactional-firestore.js';
import { makeReq, makeRes } from '../../helpers/firestore-mock.js';

const store = makeTransactionalFirestore(), files = new Map();
const upload = jest.fn(async (_token, _owner, _repo, filePath, content) => {
  files.set(filePath, content); return { success: true };
});
jest.unstable_mockModule('../../../app.js', () => ({ db: store.db }));
jest.unstable_mockModule('firebase-functions/v2/https', () => ({ onRequest: (_options, handler) => handler }));
jest.unstable_mockModule('../../../utils/auth.js', () => ({ requireAuth: async () => 'owner' }));
jest.unstable_mockModule('../../../experiment/hosting/services.js', () => ({ uploadFileGithub: upload }));
jest.unstable_mockModule('../../../oauth/providers/github/token.js', () => ({
  getGithubToken: async () => ({ success: true, access_token: 'test-token' }), getGithubOwner: async () => 'lab',
}));
jest.unstable_mockModule('../../../experiment/publish/repo.js', () => ({
  provisionRepository: async () => ({ success: true, repoExists: true }), enablePages: async () => 'https://lab.github.io/study/',
}));
jest.unstable_mockModule('../../../experiment/publish/create-if-missing.js', () => ({ createExperimentIfMissing: jest.fn() }));
jest.unstable_mockModule('../../../experiment/publish/provider-change.js', () => ({ handleProviderChange: jest.fn() }));
jest.unstable_mockModule('../../../experiment/publish/ensure-storage.js', () => ({ ensureExperimentStorage: async () => ({ ok: true }) }));

const { publishCurrentExperiment: publish } = await import('../../../experiment/publish/current.js');
const { publishExperiment } = await import('../../../experiment/publish/index.js');
const { uploadMediaFiles } = await import('../../../experiment/publish/media.js');
const batch = { useIndexedDB: true, batchSize: 1, resumeTimeoutMinutes: 1 };
function input(code = 'A', batchConfig = batch) {
  return { accessToken: 'test-token', owner: 'lab', repoName: 'study', experimentID: 'EID',
    htmlContent: `<html><head></head><body><script>const _PUBLIC_PUBLICATION_CONFIG = ${JSON.stringify({ batchConfig })};</script>${code}<img src="img/a.bin"></body></html>`,
    mediaFiles: ['img', 'vid', 'aud'].map(type => ({ type, filename: `${type === 'img' ? 'a' : type}.bin`, content: Buffer.from(code).toString('base64') })) };
}
beforeEach(() => {
  store.reset(); files.clear(); upload.mockReset();
  upload.mockImplementation(async (_token, _owner, _repo, filePath, content) => { files.set(filePath, content); return { success: true }; });
  store.records.set('experiments/EID', { owner: 'owner', storageProvider: 'googledrive', driveFolderId: 'original',
    useValidation: true, requiredFields: ['trial_type'] });
});

test('the HTTP publisher writes only the current HTML/media and one configuration on the experiment', async () => {
  const request = input();
  const res = makeRes();
  await publishExperiment(makeReq({ body: { ...request, storageProvider: 'googledrive' } }), res);
  expect(res.statusCode).toBe(200);
  expect([...files.keys()].sort()).toEqual(['aud/aud.bin', 'img/a.bin', 'index.html', 'vid/vid.bin']);
  expect(files.get('index.html')).toBe(request.htmlContent);
  expect(String(files.get('img/a.bin'))).toBe('A');
  expect([...store.records.keys()]).toEqual(['experiments/EID']);
  expect(store.records.get('experiments/EID')).toMatchObject({ sessionExportProtocolVersion: 1, publishedConfiguration: {
    batchConfig: batch, storageProvider: 'googledrive', exportDestination: { provider: 'googledrive', owner: 'owner', folder: 'original' },
    validation: { useValidation: true, requiredFields: ['trial_type'] },
  } });
  for (const key of ['publicationId', 'executionRevision', 'artifactUrl']) expect(res.jsonBody).not.toHaveProperty(key);
});

test('ON → OFF → ON replaces the same paths and the single published configuration', async () => {
  await publish(input('A'));
  await publish(input('B', { useIndexedDB: false, batchSize: 9, resumeTimeoutMinutes: 30 }));
  await publish(input('C', { ...batch, batchSize: 3 }));
  expect(files.size).toBe(4);
  expect(files.get('index.html')).toBe(input('C', { ...batch, batchSize: 3 }).htmlContent);
  expect(String(files.get('img/a.bin'))).toBe('C');
  expect([...store.records.keys()]).toEqual(['experiments/EID']);
  expect(store.records.get('experiments/EID').publishedConfiguration.batchConfig).toEqual({ ...batch, batchSize: 3 });
});

test('the media uploader has only the root layout even if a caller supplies an obsolete extra argument', async () => {
  await uploadMediaFiles('test-token', 'lab', 'study', input().mediaFiles, 'publications/obsolete/');
  expect([...files.keys()].sort()).toEqual(['aud/aud.bin', 'img/a.bin', 'vid/vid.bin']);
  expect(String(files.get('img/a.bin'))).toBe('A');
});

test('publishing stores only the current configuration contract, without passing arbitrary publication fields through', async () => {
  const config = { batchConfig: batch, recruitmentConfig: { platform: 'none', prolificCompletionCode: '' },
    captchaConfig: { enabled: false, provider: 'hcaptcha', siteKey: '' } };
  const request = input();
  request.htmlContent = `<script>const _PUBLIC_PUBLICATION_CONFIG = ${JSON.stringify({ ...config,
    publicationId: 'obsolete', executionRevision: 'obsolete', artifactUrl: '/obsolete', entryUrl: '/obsolete', extraInternalField: 'unused' })};</script>`;
  await publish(request);
  expect(store.records.get('experiments/EID').publishedConfiguration).toEqual({ ...config,
    storageProvider: 'googledrive', exportDestination: { provider: 'googledrive', owner: 'owner', folder: 'original' },
    validation: { useValidation: true, allowCSV: true, allowJSON: true, requiredFields: ['trial_type'] } });
  expect([...store.records.keys()]).toEqual(['experiments/EID']);
});

test('a resource upload failure preserves the confirmed configuration and does not replace index.html', async () => {
  await publish(input());
  const previous = structuredClone(store.records.get('experiments/EID').publishedConfiguration), entry = files.get('index.html');
  upload.mockResolvedValueOnce({ success: false, errorText: 'unavailable' });
  await expect(publish(input('B', { ...batch, batchSize: 3 }))).rejects.toThrow();
  expect(files.get('index.html')).toBe(entry);
  expect(store.records.get('experiments/EID').publishedConfiguration).toEqual(previous);
  expect(store.records.get('experiments/EID').publicationLeaseUntil).toBe(0);
});

test('an HTML upload failure cannot confirm new settings', async () => {
  await publish(input());
  const previous = structuredClone(store.records.get('experiments/EID').publishedConfiguration), entry = files.get('index.html');
  upload.mockImplementation(async (_token, _owner, _repo, filePath, content) => {
    if (filePath === 'index.html') return { success: false, errorText: 'unavailable' };
    files.set(filePath, content); return { success: true };
  });
  await expect(publish(input('B', { ...batch, batchSize: 3 }))).rejects.toThrow();
  expect(files.get('index.html')).toBe(entry);
  expect(store.records.get('experiments/EID').publishedConfiguration).toEqual(previous);
});

test.each([0, 1.5, 1441])('rejects timeout %s before uploading', async resumeTimeoutMinutes => {
  await expect(publish(input('B', { ...batch, resumeTimeoutMinutes }))).rejects.toMatchObject({ status: 400 });
  expect(upload).not.toHaveBeenCalled();
});

test('rejects a traversal in a media filename before uploading', async () => {
  await expect(publish({ ...input(), mediaFiles: [{ type: 'img', filename: '../outside.png', content: 'QQ==' }] })).rejects.toMatchObject({ status: 400 });
  expect(upload).not.toHaveBeenCalled();
});

test('concurrent publication cannot replace the entry or settings owned by another publisher', async () => {
  let release, entered;
  const blocked = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  upload.mockImplementationOnce(async () => { entered(); await blocked; return { success: true }; });
  const first = publish(input('A')); await started;
  try { await expect(publish(input('B', { ...batch, batchSize: 3 }))).rejects.toMatchObject({ status: 409 }); }
  finally { release(); }
  await first;
  expect(store.records.get('experiments/EID').publishedConfiguration.batchConfig).toEqual(batch);
  expect(files.get('index.html')).toBe(input().htmlContent);
});
