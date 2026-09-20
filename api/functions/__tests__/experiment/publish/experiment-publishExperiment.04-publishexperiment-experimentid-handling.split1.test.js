/**
 * Tests for experiment/index.js::publishExperiment.
 * Covers: OPTIONS preflight, validation, GitHub flow (create vs update branches +
 * repo-ready polling + media upload + Pages fallback), storage-provider change
 * branches (Drive/Dropbox/OSF with inline OSF project creation), the
 * createExperiment-on-missing path, and the catch-all 500.
 */
import { jest } from "@jest/globals";
import { makeFsMock, makeReq, makeRes } from "../../helpers/firestore-mock.js";
import fetchMock from "../../helpers/fetch-mock.js";

const fs = makeFsMock();
const mockWriteLog = jest.fn().mockResolvedValue(true);
const mockGetValidToken = jest.fn();
const mockCreateFolder = jest.fn();
const mockDeleteFolder = jest.fn();
const mockCreateRepositoryGithub = jest.fn();
const mockUploadFileGithub = jest.fn();
const mockEnableGithubPages = jest.fn();
const mockDeleteRepositoryGithub = jest.fn();
const mockGetRepositoryInfo = jest.fn();
const mockWaitForGithubRepoReady = jest.fn();
const mockGetGithubToken = jest.fn();
const mockGetGithubOwner = jest.fn();

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
  createRepositoryGithub: mockCreateRepositoryGithub,
  uploadFileGithub: mockUploadFileGithub,
  enableGithubPages: mockEnableGithubPages,
  deleteRepositoryGithub: mockDeleteRepositoryGithub,
  getRepositoryInfo: mockGetRepositoryInfo,
  waitForGithubRepoReady: mockWaitForGithubRepoReady,
}));
jest.unstable_mockModule("../../../oauth/providers/github/token.js", () => ({
  getGithubToken: mockGetGithubToken,
  getGithubOwner: mockGetGithubOwner,
}));

const { publishExperiment } = await import("../../../experiment/index.js");

beforeEach(() => {
  fs.refsByPath.clear();
  fs.colsByPath.clear();
  fs.db.collection.mockClear();
  fs.db.batch.mockClear();
  mockWriteLog.mockClear();
  mockGetValidToken.mockReset();
  mockCreateFolder.mockReset();
  mockDeleteFolder.mockReset();
  mockCreateRepositoryGithub.mockReset();
  mockUploadFileGithub.mockReset();
  mockEnableGithubPages.mockReset();
  mockDeleteRepositoryGithub.mockReset();
  mockGetRepositoryInfo.mockReset();
  mockWaitForGithubRepoReady.mockReset();
  mockGetGithubToken.mockReset();
  mockGetGithubOwner.mockReset();
  fetchMock.__reset();
});

// ─── Preflight + validation ────────────────────────────────────────────────

// ─── GitHub flow — happy + error paths ─────────────────────────────────────

// ─── Media files ───────────────────────────────────────────────────────────

// ─── experimentID block branches ───────────────────────────────────────────

// ─── Internal error ────────────────────────────────────────────────────────

describe("publishExperiment — experimentID handling", () => {
  test("experiment exists + same provider → validates token and ensures the folder", async () => {
    const experimentRef = fs.getRef("experiments/EID");
    experimentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        storageProvider: "googledrive",
        driveFolderPath: "/ExpBuilder/r",
        driveFolderId: "old-folder-id",
      }),
    });
    mockGetValidToken.mockResolvedValueOnce({ success: true, access_token: "drivetok" });
    mockCreateFolder.mockResolvedValueOnce({ success: true, folderId: "old-folder-id" });
    mockGetGithubToken.mockResolvedValueOnce({ success: true, access_token: "tok" });
    mockGetGithubOwner.mockResolvedValueOnce("o");
    mockGetRepositoryInfo.mockResolvedValueOnce({ success: true });
    mockUploadFileGithub.mockResolvedValueOnce({ success: true });
    mockEnableGithubPages.mockResolvedValueOnce({ success: true, pagesUrl: "u" });

    await publishExperiment(
      makeReq({
        body: {
          uid: "u1",
          repoName: "r",
          htmlContent: "<h/>",
          experimentID: "EID",
          storageProvider: "googledrive",
        },
      }),
      makeRes(),
    );

    expect(mockGetValidToken).toHaveBeenCalledWith("googledrive", "u1");
    expect(mockCreateFolder).toHaveBeenCalledWith(
      "googledrive",
      "drivetok",
      "/ExpBuilder/r",
      "r",
    );
    expect(experimentRef.update).toHaveBeenCalledWith({
      driveFolderPath: "/ExpBuilder/r",
      driveFolderId: "old-folder-id",
    });
  });

  test("same provider + missing folder → recreates it and stores the new id", async () => {
    const experimentRef = fs.getRef("experiments/EID");
    experimentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        storageProvider: "googledrive",
        driveFolderPath: "/ExpBuilder/r",
        driveFolderId: "deleted-folder-id",
      }),
    });
    mockGetValidToken.mockResolvedValueOnce({ success: true, access_token: "drivetok" });
    mockCreateFolder.mockResolvedValueOnce({ success: true, folderId: "new-folder-id" });
    mockGetGithubToken.mockResolvedValueOnce({ success: true, access_token: "tok" });
    mockGetGithubOwner.mockResolvedValueOnce("o");
    mockGetRepositoryInfo.mockResolvedValueOnce({ success: true });
    mockUploadFileGithub.mockResolvedValueOnce({ success: true });
    mockEnableGithubPages.mockResolvedValueOnce({ success: true, pagesUrl: "u" });

    await publishExperiment(
      makeReq({
        body: {
          uid: "u1",
          repoName: "r",
          htmlContent: "<h/>",
          experimentID: "EID",
          storageProvider: "googledrive",
        },
      }),
      makeRes(),
    );

    expect(experimentRef.update).toHaveBeenCalledWith({
      driveFolderPath: "/ExpBuilder/r",
      driveFolderId: "new-folder-id",
    });
  });

  test("same provider + invalid token → 400 and publish stops", async () => {
    fs.getRef("experiments/EID").get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ storageProvider: "googledrive" }),
    });
    mockGetValidToken.mockResolvedValueOnce({ success: false, error: "expired" });

    const res = makeRes();
    await publishExperiment(
      makeReq({
        body: {
          uid: "u1",
          repoName: "r",
          htmlContent: "<h/>",
          experimentID: "EID",
          storageProvider: "googledrive",
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({
      success: false,
      message:
        "Could not get a valid googledrive token to create the experiment folder",
      error: "expired",
    });
    expect(mockCreateFolder).not.toHaveBeenCalled();
    expect(mockGetGithubToken).not.toHaveBeenCalled();
  });

  test("same provider + folder creation failure → 400", async () => {
    fs.getRef("experiments/EID").get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ storageProvider: "dropbox", dropboxFolder: "/ExpBuilder/r" }),
    });
    mockGetValidToken.mockResolvedValueOnce({ success: true, access_token: "dboxtok" });
    mockCreateFolder.mockResolvedValueOnce({
      success: false,
      errorText: "quota exceeded",
    });

    const res = makeRes();
    await publishExperiment(
      makeReq({
        body: {
          uid: "u1",
          repoName: "r",
          htmlContent: "<h/>",
          experimentID: "EID",
          storageProvider: "dropbox",
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({
      success: false,
      message: "Could not create the experiment folder in dropbox",
      error: "quota exceeded",
    });
    expect(mockGetGithubToken).not.toHaveBeenCalled();
  });

  test("same provider + Dropbox → ensures the stored folder and refreshes it", async () => {
    const experimentRef = fs.getRef("experiments/EID");
    experimentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        storageProvider: "dropbox",
        dropboxFolder: "/ExpBuilder/r",
      }),
    });
    mockGetValidToken.mockResolvedValueOnce({ success: true, access_token: "dboxtok" });
    mockCreateFolder.mockResolvedValueOnce({ success: true, alreadyExists: true });
    mockGetGithubToken.mockResolvedValueOnce({ success: true, access_token: "tok" });
    mockGetGithubOwner.mockResolvedValueOnce("o");
    mockGetRepositoryInfo.mockResolvedValueOnce({ success: true });
    mockUploadFileGithub.mockResolvedValueOnce({ success: true });
    mockEnableGithubPages.mockResolvedValueOnce({ success: true, pagesUrl: "u" });

    await publishExperiment(
      makeReq({
        body: {
          uid: "u1",
          repoName: "r",
          htmlContent: "<h/>",
          experimentID: "EID",
          storageProvider: "dropbox",
        },
      }),
      makeRes(),
    );

    expect(mockCreateFolder).toHaveBeenCalledWith(
      "dropbox",
      "dboxtok",
      "/ExpBuilder/r",
      "r",
    );
    expect(experimentRef.update).toHaveBeenCalledWith({
      dropboxFolder: "/ExpBuilder/r",
    });
  });

  test("same provider + OSF → reuses the component and refreshes the upload link", async () => {
    const experimentRef = fs.getRef("experiments/EID");
    experimentRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        storageProvider: "osf",
        title: "my experiment",
        osfComponentId: "comp-old",
      }),
    });
    fs.getRef("users/u1").get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ osfProjectId: "proj-1" }),
    });
    mockGetValidToken.mockResolvedValueOnce({ success: true, access_token: "osftok" });
    mockCreateFolder.mockResolvedValueOnce({
      success: true,
      componentId: "comp-old",
      uploadLink: "https://files.osf.io/upload/new",
      alreadyExists: true,
    });
    mockGetGithubToken.mockResolvedValueOnce({ success: true, access_token: "tok" });
    mockGetGithubOwner.mockResolvedValueOnce("o");
    mockGetRepositoryInfo.mockResolvedValueOnce({ success: true });
    mockUploadFileGithub.mockResolvedValueOnce({ success: true });
    mockEnableGithubPages.mockResolvedValueOnce({ success: true, pagesUrl: "u" });

    await publishExperiment(
      makeReq({
        body: {
          uid: "u1",
          repoName: "r",
          htmlContent: "<h/>",
          experimentID: "EID",
          storageProvider: "osf",
        },
      }),
      makeRes(),
    );

    expect(mockCreateFolder).toHaveBeenCalledWith(
      "osf",
      "osftok",
      "proj-1",
      "my experiment",
    );
    expect(experimentRef.update).toHaveBeenCalledWith({
      osfComponentId: "comp-old",
      osfUploadLink: "https://files.osf.io/upload/new",
    });
  });

  test("same provider + OSF without project id → 400", async () => {
    fs.getRef("experiments/EID").get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ storageProvider: "osf", title: "my experiment" }),
    });
    fs.getRef("users/u1").get.mockResolvedValueOnce({
      exists: true,
      data: () => ({}),
    });
    mockGetValidToken.mockResolvedValueOnce({ success: true, access_token: "osftok" });

    const res = makeRes();
    await publishExperiment(
      makeReq({
        body: {
          uid: "u1",
          repoName: "r",
          htmlContent: "<h/>",
          experimentID: "EID",
          storageProvider: "osf",
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({
      success: false,
      message: "Could not create the experiment folder in osf",
      error: "OSF project not found. Connect your OSF account and try again.",
    });
    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  test("experiment exists + provider change googledrive→dropbox → createFolder + Firestore update", async () => {
    fs.getRef("experiments/EID").get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ storageProvider: "googledrive" }),
    });
    mockGetValidToken.mockResolvedValueOnce({ success: true, access_token: "dboxtok" });
    mockCreateFolder.mockResolvedValueOnce({ success: true });
    mockGetGithubToken.mockResolvedValueOnce({ success: true, access_token: "ghtok" });
    mockGetGithubOwner.mockResolvedValueOnce("o");
    mockGetRepositoryInfo.mockResolvedValueOnce({ success: true });
    mockUploadFileGithub.mockResolvedValueOnce({ success: true });
    mockEnableGithubPages.mockResolvedValueOnce({ success: true, pagesUrl: "u" });

    await publishExperiment(
      makeReq({
        body: {
          uid: "u1",
          repoName: "r",
          htmlContent: "<h/>",
          experimentID: "EID",
          storageProvider: "dropbox",
        },
      }),
      makeRes(),
    );

    // First update: storageProvider switch
    expect(fs.getRef("experiments/EID").update).toHaveBeenCalledWith({
      storageProvider: "dropbox",
    });
    expect(mockCreateFolder).toHaveBeenCalledWith(
      "dropbox",
      "dboxtok",
      "/ExpBuilder/r",
      "r",
    );
    // Second update: dropboxFolder
    expect(fs.getRef("experiments/EID").update).toHaveBeenCalledWith({
      dropboxFolder: "/ExpBuilder/r",
    });
  });

  test("experiment exists + provider change to OSF + no projectId → creates OSF project via fetch, then createFolder", async () => {
    fs.getRef("experiments/EID").get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ storageProvider: "googledrive" }),
    });
    mockGetValidToken.mockResolvedValueOnce({ success: true, access_token: "osftok" });
    fs.getRef("users/u1").get.mockResolvedValueOnce({
      exists: true,
      data: () => ({}),
    });
    fetchMock.__setMockResponses([
      { status: 201, body: { data: { id: "newproj" } } },
    ]);
    mockCreateFolder.mockResolvedValueOnce({
      success: true,
      componentId: "c1",
      uploadLink: "https://up.link/",
    });
    mockGetGithubToken.mockResolvedValueOnce({ success: true, access_token: "ghtok" });
    mockGetGithubOwner.mockResolvedValueOnce("o");
    mockGetRepositoryInfo.mockResolvedValueOnce({ success: true });
    mockUploadFileGithub.mockResolvedValueOnce({ success: true });
    mockEnableGithubPages.mockResolvedValueOnce({ success: true, pagesUrl: "u" });

    await publishExperiment(
      makeReq({
        body: {
          uid: "u1",
          repoName: "r",
          htmlContent: "<h/>",
          experimentID: "EID",
          storageProvider: "osf",
        },
      }),
      makeRes(),
    );

    // User update with new osfProjectId
    expect(fs.getRef("users/u1").update).toHaveBeenCalledWith({
      osfProjectId: "newproj",
    });
    // createFolder uses the new osfProjectId as folderPath
    expect(mockCreateFolder).toHaveBeenCalledWith(
      "osf",
      "osftok",
      "newproj",
      "r",
    );
    // experimentRef updated with OSF identifiers
    expect(fs.getRef("experiments/EID").update).toHaveBeenCalledWith({
      osfComponentId: "c1",
      osfUploadLink: "https://up.link/",
    });
    const fetchCalls = fetchMock.__getCalls();
    expect(fetchCalls[0].url).toBe("https://api.osf.io/v2/nodes/?region=us");
  });
});
