import { jest } from "@jest/globals";
import { makeExperimentStore } from "../../helpers/experiment-store.js";
const store = makeExperimentStore(),
  prepare = jest.fn();
jest.unstable_mockModule("../../../app.js", () => ({ db: store.db }));
jest.unstable_mockModule("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "created" },
}));
jest.unstable_mockModule(
  "../../../experiment/sessions/logging/write-log.js",
  () => ({ default: jest.fn() }),
);
jest.unstable_mockModule(
  "../../../experiment/bindings/prepare-storage.js",
  () => ({ prepareStorageBinding: prepare }),
);
jest.unstable_mockModule("../../../oauth/index.js", () => ({
  getValidToken: async () => ({ success: false, error: "old path" }),
}));
const { createExperiment } = await import("../../../experiment/create.js");
beforeEach(() => {
  store.reset();
  prepare.mockReset().mockImplementation(async (mutation, uid, provider) => {
    expect(mutation.data).toMatchObject({
      owner: uid,
      active: false,
      initialPublicationPending: true,
    });
    await mutation.update({
      storageBinding: {
        provider,
        accountId: "account",
        folderId: "stable-folder",
      },
      driveFolderId: "stable-folder",
      provisioningState: "ready",
    });
    return {
      binding: { provider, folderId: "stable-folder" },
      projection: { driveFolderId: "stable-folder" },
    };
  });
});
test.each(["googledrive", "dropbox", "osf"])(
  "%s creation delegates to ID-based preparation after reserving ownership",
  async (provider) => {
    expect(
      (await createExperiment("study", "Title", "owner", provider)).success,
    ).toBe(true);
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({ created: true }),
      "owner",
      provider,
    );
    expect(store.read("experiments/study")).toMatchObject({
      id: "study",
      title: "Title",
      owner: "owner",
      active: false,
      sessions: 0,
    });
  },
);
test("failed preparation retains identity and retry preserves its original title and counters", async () => {
  prepare.mockRejectedValueOnce(new Error("unavailable"));
  expect((await createExperiment("study", "First", "owner")).success).toBe(
    false,
  );
  const original = store.read("experiments/study");
  expect(original.provisioningState).toBe("failed");
  expect((await createExperiment("study", "Renamed", "owner")).success).toBe(
    true,
  );
  expect(store.read("experiments/study")).toMatchObject({
    title: "First",
    createdAt: original.createdAt,
    sessions: 0,
    owner: "owner",
  });
});
test("another owner and anonymous callers cannot prepare a reserved identity", async () => {
  await createExperiment("study", "First", "owner");
  prepare.mockClear();
  await expect(
    createExperiment("study", "Other", "foreign"),
  ).rejects.toMatchObject({ code: "EXPERIMENT_FORBIDDEN" });
  await expect(
    createExperiment("other", "Title", undefined),
  ).rejects.toMatchObject({ status: 401 });
  expect(prepare).not.toHaveBeenCalled();
});
test("already prepared experiments are not recreated", async () => {
  await createExperiment("study", "First", "owner");
  prepare.mockClear();
  expect(await createExperiment("study", "Renamed", "owner")).toMatchObject({
    alreadyExists: true,
    folderCreated: false,
  });
  expect(prepare).not.toHaveBeenCalled();
});
