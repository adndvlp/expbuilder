/**
 * Tests for experiment/index.js::createExperiment + apiDeleteExperiment HTTP wrapper.
 *
 * createExperiment: per-provider provider-fields wiring, OSF projectId resolution,
 * token failure path, folder error path, anonymous (no-uid) skip-folder branch.
 *
 * apiDeleteExperiment: 400 missing param, 404 EXPERIMENT_NOT_FOUND mapping,
 * 500 generic, 200 happy path.
 */
import { jest } from "@jest/globals";
import { makeFsMock, makeReq, makeRes, makeSnapshot } from "../../helpers/firestore-mock.js";

const fs = makeFsMock();
const mockWriteLog = jest.fn().mockResolvedValue(true);
const mockGetValidToken = jest.fn();
const mockCreateFolder = jest.fn();
const mockDeleteFolder = jest.fn();
const mockDeleteRepositoryGithub = jest.fn();

const rtdbRefRemove = jest.fn().mockResolvedValue(undefined);
const rtdbRef = jest.fn(() => ({ remove: rtdbRefRemove }));
const mockGetDatabase = jest.fn(() => ({ ref: rtdbRef }));

jest.unstable_mockModule("firebase-functions/v2/https", () => ({
  onRequest: (...args) => args[args.length - 1],
}));
jest.unstable_mockModule("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: jest.fn().mockResolvedValue({ uid: "u1" }) }),
}));
jest.unstable_mockModule("../../../utils/auth.js", () => ({
  requireAuth: jest.fn().mockResolvedValue("u1"),
  verifyFirebaseAuth: jest.fn().mockResolvedValue({ ok: true, uid: "u1" }),
}));
jest.unstable_mockModule("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: (n) => ({ __op: "increment", value: n }),
    serverTimestamp: () => ({ __op: "serverTimestamp" }),
  },
}));
jest.unstable_mockModule("firebase-admin/database", () => ({
  getDatabase: mockGetDatabase,
}));
jest.unstable_mockModule("../../../app.js", () => ({ db: fs.db, app: {} }));
jest.unstable_mockModule("../../../experiment/sessions/logging/write-log.js", () => ({
  default: mockWriteLog,
}));
jest.unstable_mockModule("../../../experiment/sessions/services/folder.js", () => ({
  createFolder: mockCreateFolder,
  deleteFolder: mockDeleteFolder,
}));
jest.unstable_mockModule("../../../oauth/index.js", () => ({
  getValidToken: mockGetValidToken,
}));
jest.unstable_mockModule("../../../experiment/hosting/services.js", () => ({
  createRepositoryGithub: jest.fn(),
  uploadFileGithub: jest.fn(),
  enableGithubPages: jest.fn(),
  deleteRepositoryGithub: mockDeleteRepositoryGithub,
  getRepositoryInfo: jest.fn(),
  waitForGithubRepoReady: jest.fn(),
}));
jest.unstable_mockModule("../../../oauth/providers/github/token.js", () => ({
  getGithubToken: jest.fn(),
  getGithubOwner: jest.fn(),
}));

const { createExperiment, apiDeleteExperiment } = await import(
  "../../../experiment/index.js"
);

beforeEach(() => {
  fs.refsByPath.clear();
  fs.colsByPath.clear();
  fs.db.collection.mockClear();
  fs.db.batch.mockClear();
  mockWriteLog.mockClear();
  mockGetValidToken.mockReset();
  mockCreateFolder.mockReset();
  mockDeleteFolder.mockReset();
  mockDeleteRepositoryGithub.mockReset();
  rtdbRef.mockClear();
  rtdbRefRemove.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────
// createExperiment
// ─────────────────────────────────────────────────────────────────────────

describe("createExperiment — googledrive", () => {
  test('AC05: valid explicit settings remain unchanged and other defaults are initialized', async () => {
    const batchConfig = { useIndexedDB: false, batchSize: 7, resumeTimeoutMinutes: 1 };
    await createExperiment('custom', 'Custom', undefined, 'googledrive', { batchConfig, sessions: 100, currentCondition: 100 });
    expect(fs.getRef('experiments/custom').create).toHaveBeenCalledWith(expect.objectContaining({ batchConfig,
      recruitmentConfig: { platform: 'none', prolificCompletionCode: '' },
      captchaConfig: { enabled: false, provider: 'hcaptcha', siteKey: '' }, sessions: 0, currentCondition: 0 }));
  });
  test('invalid overrides fail before provider calls, logging or experiment writes', async () => {
    await expect(createExperiment('invalid', 'Invalid', 'u1', 'googledrive', { batchConfig: { useIndexedDB: true, batchSize: -1, resumeTimeoutMinutes: 1 } })).rejects.toMatchObject({ status: 400 });
    expect(mockWriteLog).not.toHaveBeenCalled(); expect(mockCreateFolder).not.toHaveBeenCalled();
    expect(fs.db.collection).not.toHaveBeenCalled();
  });
  test('AC05: creating an existing document cannot reset its configuration or counters', async () => {
    const ref = fs.getRef('experiments/existing'); ref.create.mockRejectedValueOnce({ code: 6 });
    await expect(createExperiment('existing', 'Existing')).rejects.toThrow('EXPERIMENT_ALREADY_EXISTS');
    expect(ref.set).not.toHaveBeenCalled(); expect(ref.update).not.toHaveBeenCalled();
  });
  test("creates folder, persists driveFolderId/driveFolderPath, owner set", async () => {
    mockGetValidToken.mockResolvedValueOnce({ success: true, access_token: "tok" });
    mockCreateFolder.mockResolvedValueOnce({ success: true, folderId: "fldX" });

    const r = await createExperiment("EID", "My Exp", "u1", "googledrive");

    expect(r.success).toBe(true);
    expect(r.folderCreated).toBe(true);
    expect(r.folderId).toBe("fldX");
    expect(r.folderPath).toBe("/ExpBuilder/My Exp");
    expect(r).not.toHaveProperty("storageError");

    expect(mockCreateFolder).toHaveBeenCalledWith(
      "googledrive",
      "tok",
      "/ExpBuilder/My Exp",
      "My Exp",
    );

    const ref = fs.getRef("experiments/EID");
    expect(ref.create).toHaveBeenCalledTimes(1);
    const body = ref.create.mock.calls[0][0];
    expect(body).toMatchObject({
      title: "My Exp",
      storageProvider: "googledrive",
      driveFolderPath: "/ExpBuilder/My Exp",
      driveFolderId: "fldX",
      active: true,
      sessions: 0,
      owner: "u1",
      id: "EID",
      batchConfig: { useIndexedDB: true, batchSize: 0, resumeTimeoutMinutes: 30 },
      recruitmentConfig: { platform: 'none', prolificCompletionCode: '' },
      captchaConfig: { enabled: false, provider: 'hcaptcha', siteKey: '' },
    });
    // logs counter incremented
    expect(mockWriteLog).toHaveBeenCalledWith("EID", "createExperiment");
  });
});
