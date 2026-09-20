import { jest } from "@jest/globals";
import {
  makeDocSnapshot,
  makeFsMock,
} from "../../helpers/firestore-mock.js";

const fs = makeFsMock();
const mockGetValidToken = jest.fn();
const mockFetch = jest.fn();
const mockCreateExperiment = jest.fn();
const mockCreateFolder = jest.fn();
const mockDeleteFolder = jest.fn();

jest.unstable_mockModule("../../../app.js", () => ({ db: fs.db, app: {} }));
jest.unstable_mockModule("../../../oauth/index.js", () => ({
  getValidToken: mockGetValidToken,
}));
jest.unstable_mockModule("../../../utils/fetch-with-timeout.js", () => ({
  default: mockFetch,
}));
jest.unstable_mockModule("../../../experiment/create.js", () => ({
  createExperiment: mockCreateExperiment,
}));
jest.unstable_mockModule("../../../experiment/sessions/services/folder.js", () => ({
  createFolder: mockCreateFolder,
  deleteFolder: mockDeleteFolder,
}));

const { createExperimentIfMissing } = await import(
  "../../../experiment/publish/create-if-missing.js"
);
const { handleProviderChange } = await import(
  "../../../experiment/publish/provider-change.js"
);

beforeEach(() => {
  fs.refsByPath.clear();
  fs.colsByPath.clear();
  fs.db.collection.mockClear();
  mockGetValidToken.mockReset();
  mockFetch.mockReset();
  mockCreateExperiment.mockReset();
  mockDeleteFolder.mockReset();
  mockCreateFolder.mockReset();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("handleProviderChange", () => {
  test("fails provider change when the folder cannot be created and restores the previous provider", async () => {
    const experimentRef = fs.getRef("experiments/EID");
    const userRef = fs.getRef("users/u1");
    userRef.get.mockResolvedValueOnce(makeDocSnapshot({ id: "u1", data: {} }));
    mockGetValidToken.mockResolvedValueOnce({
      success: true,
      access_token: "osf-token",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: { id: "proj-new" } }),
    });
    mockCreateFolder.mockResolvedValueOnce({
      success: false,
      errorText: "component quota",
    });

    await expect(
      handleProviderChange(
        experimentRef,
        { storageProvider: "dropbox" },
        "osf",
        "u1",
        "repo",
      ),
    ).resolves.toEqual({
      ok: false,
      response: {
        status: 400,
        body: {
          success: false,
          message: "Could not create the experiment folder in osf",
          error: "component quota",
        },
      },
    });

    expect(userRef.update).toHaveBeenCalledWith({ osfProjectId: "proj-new" });
    expect(mockCreateFolder).toHaveBeenCalledWith(
      "osf",
      "osf-token",
      "proj-new",
      "repo",
    );
    // All-or-nothing: the provider field is restored so the experiment
    // keeps writing to its previous (working) storage.
    expect(experimentRef.update).toHaveBeenCalledWith({
      storageProvider: "dropbox",
    });
    expect(experimentRef.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ osfComponentId: expect.any(String) }),
    );
  });

  test("fails provider change after token failure for the new provider", async () => {
    const experimentRef = fs.getRef("experiments/EID");
    mockGetValidToken.mockResolvedValueOnce({
      success: false,
      error: "no drive token",
    });

    await expect(
      handleProviderChange(
        experimentRef,
        { storageProvider: "dropbox" },
        "googledrive",
        "u1",
        "repo",
      ),
    ).resolves.toEqual({
      ok: false,
      response: {
        status: 400,
        body: {
          success: false,
          message:
            "Could not get a valid googledrive token to create the experiment folder",
          error: "no drive token",
        },
      },
    });

    expect(experimentRef.update).toHaveBeenCalledWith({
      storageProvider: "googledrive",
    });
    expect(experimentRef.update).toHaveBeenCalledWith({
      storageProvider: "dropbox",
    });
    expect(mockCreateFolder).not.toHaveBeenCalled();
  });

  test("continues when cleanup of the previous provider throws", async () => {
    const experimentRef = fs.getRef("experiments/EID");
    mockGetValidToken
      .mockResolvedValueOnce({ success: true, access_token: "drive-token" })
      .mockResolvedValueOnce({ success: true, access_token: "osf-old-token" });
    mockCreateFolder.mockResolvedValueOnce({
      success: true,
      folderId: "drive-folder-id",
    });
    mockDeleteFolder.mockRejectedValueOnce(new Error("cleanup failed"));

    await expect(
      handleProviderChange(
        experimentRef,
        {
          storageProvider: "osf",
          osfComponentId: "old-component",
        },
        "googledrive",
        "u1",
        "repo",
      ),
    ).resolves.toEqual({ ok: true });

    expect(console.warn).toHaveBeenCalledWith(
      "[PROVIDER CHANGE] Old folder cleanup failed (non-fatal):",
      "cleanup failed",
    );
    expect(experimentRef.update).toHaveBeenCalledWith({
      osfComponentId: null,
      osfUploadLink: null,
    });
  });

  test("fails when the initial provider update throws", async () => {
    const experimentRef = fs.getRef("experiments/EID");
    experimentRef.update.mockRejectedValueOnce(new Error("update failed"));

    await expect(
      handleProviderChange(
        experimentRef,
        { storageProvider: "dropbox" },
        "googledrive",
        "u1",
        "repo",
      ),
    ).resolves.toEqual({
      ok: false,
      response: {
        status: 500,
        body: {
          success: false,
          message: "Could not update the storage provider",
          error: "update failed",
        },
      },
    });
  });
});
