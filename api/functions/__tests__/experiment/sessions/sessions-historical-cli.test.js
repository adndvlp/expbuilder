import { jest } from '@jest/globals';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeTransactionalFirestore } from '../../helpers/transactional-firestore.js';
const store = makeTransactionalFirestore(), inspect = jest.fn(async () => ({ exists: false }));
jest.unstable_mockModule('../../../app.js', () => ({ db: store.db }));
jest.unstable_mockModule('../../../experiment/sessions/export/providers/google-drive.js', () => ({ googleDriveExportAdapter: () => ({ inspect }) }));
const { recoveryCommand } = await import('../../../experiment/sessions/recovery/cli.js');
let directory;
const savedProject = process.env.GCLOUD_PROJECT, savedConfig = process.env.FIREBASE_CONFIG;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'historical-cli-')); store.reset(); process.env.RECOVERY_TEST_TOKEN = 'do-not-copy-this-token';
  store.records.set('experiments/EID', { owner: 'owner', storageProvider: 'googledrive', driveFolderId: 'folder' });
  store.records.set('experiments/EID/sessions/SID', { participantNumber: 23, condition: 0, createdAt: '2026-11-05' });
  store.records.set('experiments/EID/sessions/SID/trials/old', { response: 'A' });
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); delete process.env.RECOVERY_TEST_TOKEN;
  if (savedProject === undefined) delete process.env.GCLOUD_PROJECT; else process.env.GCLOUD_PROJECT = savedProject;
  if (savedConfig === undefined) delete process.env.FIREBASE_CONFIG; else process.env.FIREBASE_CONFIG = savedConfig;
});
const args = () => ['--project', 'demo-test', '--experiment', 'EID', '--session', 'SID', '--token-env', 'RECOVERY_TEST_TOKEN', '--out', path.join(directory, 'plan.json')];
test('default command is inspection only, creates a private plan and never copies credentials', async () => {
  const before = structuredClone([...store.records]); const result = await recoveryCommand(args());
  expect(result.status).toBe('ready'); expect([...store.records]).toEqual(before);
  expect((await stat(result.file)).mode & 0o777).toBe(0o600);
  expect(await readFile(result.file, 'utf8')).not.toContain('do-not-copy-this-token');
  await expect(recoveryCommand(args())).rejects.toThrow('EEXIST');
});
test('unsupported switches cannot silently defeat an operator intended dry run', async () => {
  const before = structuredClone([...store.records]);
  await expect(recoveryCommand([...args(), '--dry-run', 'true'])).rejects.toThrow('Unsupported option');
  expect([...store.records]).toEqual(before);
});
test('does not select a project or credentials implicitly', async () => {
  await expect(recoveryCommand([])).rejects.toThrow('explicit project');
  await expect(recoveryCommand(['--project', 'demo-test'])).rejects.toThrow('token-env');
});
