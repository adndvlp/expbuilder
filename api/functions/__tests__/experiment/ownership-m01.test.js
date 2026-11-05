import { jest } from "@jest/globals";
import { makeReq, makeRes } from "../helpers/firestore-mock.js";
import { makeExperimentStore } from "../helpers/experiment-store.js";

const store = makeExperimentStore();
const log = jest.fn();
const folder = jest.fn();
const removeFolder = jest.fn();
const upload = jest.fn();
const removeRepo = jest.fn();
const token = jest.fn();
const githubToken = jest.fn();
const repository = jest.fn();
const participantUpload = jest.fn();
const finalize = jest.fn();
const rtdbRemove = jest.fn();
jest.unstable_mockModule("../../app.js", () => ({ db: store.db, app: {} }));
jest.unstable_mockModule("firebase-functions/v2/https", () => ({
  onRequest: (...args) => args.at(-1),
}));
jest.unstable_mockModule("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: async () => ({ uid: "owner" }) }),
}));
jest.unstable_mockModule("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "server-time",
    increment: (value) => value,
  },
}));
jest.unstable_mockModule("firebase-admin/database", () => ({
  getDatabase: () => ({ ref: () => ({ remove: rtdbRemove }) }),
}));
jest.unstable_mockModule(
  "../../experiment/sessions/logging/write-log.js",
  () => ({ default: log }),
);
jest.unstable_mockModule("../../oauth/index.js", () => ({
  getValidToken: token,
}));
jest.unstable_mockModule("../../oauth/providers/github/token.js", () => ({
  getGithubToken: githubToken,
  getGithubOwner: async () => "github-owner",
}));
jest.unstable_mockModule(
  "../../experiment/sessions/services/folder.js",
  () => ({ createFolder: folder, deleteFolder: removeFolder }),
);
jest.unstable_mockModule("../../experiment/hosting/services.js", () => ({
  uploadFileGithub: upload,
  deleteRepositoryGithub: removeRepo,
  getRepositoryInfo: repository,
  createRepositoryGithub: jest.fn(),
  waitForGithubRepoReady: jest.fn(),
  enableGithubPages: async () => ({
    success: true,
    pagesUrl: "https://example.invalid/study/",
  }),
}));
jest.unstable_mockModule(
  "../../experiment/participant-files/upload.js",
  () => ({ uploadFileToBucket: participantUpload }),
);
jest.unstable_mockModule(
  "../../experiment/sessions/finalization/finalize.js",
  () => ({ finalizeSession: finalize }),
);

const { publishExperiment } = await import("../../experiment/publish/index.js");
const { createExperiment } = await import("../../experiment/create.js");
const { apiDeleteExperiment } = await import("../../experiment/api/delete.js");
const { apiData } = await import(
  "../../experiment/sessions/api/data-router.js"
);
const { apiDataComplete } = await import(
  "../../experiment/sessions/api/data-complete.js"
);
const { apiCondition } = await import("../../experiment/api/condition.js");
const { uploadParticipantFile } = await import(
  "../../experiment/participant-files/api/upload.js"
);
const request = (body) =>
  makeReq({ body, headers: { authorization: "Bearer test-token" } });
const publish = (extra = {}) =>
  request({
    uid: "owner",
    experimentID: "study",
    repoName: "study",
    htmlContent: "<html/>",
    storageProvider: "googledrive",
    ...extra,
  });

beforeEach(() => {
  store.reset();
  jest.clearAllMocks();
  folder.mockReset().mockResolvedValue({ success: true, folderId: "folder" });
  token.mockReset().mockResolvedValue({ success: true, access_token: "dummy" });
  githubToken
    .mockReset()
    .mockResolvedValue({ success: true, access_token: "dummy" });
  repository.mockReset().mockResolvedValue({ success: true });
  upload.mockReset().mockResolvedValue({ success: true, commit: "commit" });
  participantUpload
    .mockReset()
    .mockResolvedValue("https://example.invalid/file");
  finalize.mockReset().mockResolvedValue({ success: true });
  removeFolder.mockReset().mockResolvedValue({ success: true });
});

for (const [owner, status, code] of [
  ["another", 403, "EXPERIMENT_FORBIDDEN"],
  [undefined, 409, "OWNERSHIP_UNRESOLVED"],
]) {
  test.each([
    ["publish", publishExperiment],
    ["delete", apiDeleteExperiment],
  ])(
    "%s rejects an unauthorized existing experiment without effects: " + code,
    async (_name, endpoint) => {
      const original = {
        ...(owner && { owner }),
        active: true,
        sessions: 17,
        storageProvider: "googledrive",
        driveFolderId: "original",
      };
      store.seed("experiments/study", original);
      const res = makeRes();
      await endpoint(publish(), res);
      expect(res.statusCode).toBe(status);
      expect(res.jsonBody.code).toBe(code);
      expect(store.read("experiments/study")).toEqual(original);
      expect(store.changes).toEqual([]);
      for (const effect of [
        log,
        folder,
        removeFolder,
        upload,
        removeRepo,
        token,
        githubToken,
      ])
        expect(effect).not.toHaveBeenCalled();
    },
  );
}

test("publication requires an experiment ID before reserving or contacting providers", async () => {
  const res = makeRes();
  await publishExperiment(publish({ experimentID: undefined }), res);
  expect(res.statusCode).toBe(400);
  expect(upload).not.toHaveBeenCalled();
  expect(store.changes).toEqual([]);
});

test("a forged uid cannot act as the authenticated owner", async () => {
  const res = makeRes();
  await publishExperiment(publish({ uid: "another" }), res);
  expect(res.statusCode).toBe(403);
  expect(folder).not.toHaveBeenCalled();
  expect(store.changes).toEqual([]);
});

test("anonymous creation is rejected before logs or folders", async () => {
  await expect(
    createExperiment("study", "Study", undefined),
  ).rejects.toMatchObject({ status: 401 });
  expect(folder).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled();
  expect(store.changes).toEqual([]);
});

test("ownership is reserved inactive before preparing storage and activates only after upload", async () => {
  folder.mockImplementationOnce(async () => {
    expect(store.read("experiments/study")).toMatchObject({
      owner: "owner",
      active: false,
      provisioningState: "preparing",
      sessions: 0,
    });
    return { success: true, folderId: "folder" };
  });
  upload.mockImplementationOnce(async () => {
    expect(store.read("experiments/study")).toMatchObject({
      owner: "owner",
      active: false,
      provisioningState: "ready",
    });
    return { success: true, commit: "commit" };
  });
  const res = makeRes();
  await publishExperiment(publish(), res);
  expect(res.statusCode).toBe(200);
  expect(store.read("experiments/study")).toMatchObject({
    owner: "owner",
    active: true,
    provisioningState: "ready",
    initialPublicationPending: false,
    mutationLease: null,
  });
});

test("a failed folder retains the owner and retries without resetting identity or counters", async () => {
  folder.mockResolvedValueOnce({
    success: false,
    errorText: "provider unavailable",
  });
  const failed = await createExperiment("study", "Study", "owner");
  expect(failed.success).toBe(false);
  const reserved = store.read("experiments/study");
  expect(reserved).toMatchObject({
    owner: "owner",
    active: false,
    provisioningState: "failed",
  });
  const ready = await createExperiment("study", "Changed name", "owner");
  expect(ready.success).toBe(true);
  expect(store.read("experiments/study")).toMatchObject({
    owner: "owner",
    title: "Study",
    active: false,
    provisioningState: "ready",
    createdAt: reserved.createdAt,
    sessions: 0,
  });
});

test("two users racing to reserve one ID create resources for exactly one owner", async () => {
  const results = await Promise.allSettled([
    createExperiment("study", "Study", "owner"),
    createExperiment("study", "Study", "another"),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected").reason).toMatchObject({
    code: "EXPERIMENT_FORBIDDEN",
  });
  expect(folder).toHaveBeenCalledTimes(1);
  expect(store.read("experiments/study").owner).toBe("owner");
});

test("republishing a paused legacy experiment preserves identity, counters and pause", async () => {
  store.seed("experiments/study", {
    owner: "owner",
    active: false,
    sessions: 17,
    currentCondition: 6,
    createdAt: "original",
    storageProvider: "googledrive",
    driveFolderPath: "/original",
  });
  const res = makeRes();
  await publishExperiment(publish(), res);
  expect(res.statusCode).toBe(200);
  expect(store.read("experiments/study")).toMatchObject({
    owner: "owner",
    active: false,
    sessions: 17,
    currentCondition: 6,
    createdAt: "original",
  });
});

test("administrative session access rejects an ownerless experiment", async () => {
  store.seed("experiments/study", { active: true });
  const res = makeRes();
  await apiData(
    request({
      action: "updateSessionName",
      experimentID: "study",
      sessionId: "session",
      sessionName: "new",
    }),
    res,
  );
  expect(res.statusCode).toBe(409);
  expect(res.jsonBody.code).toBe("OWNERSHIP_UNRESOLVED");
  expect(store.changes).toEqual([]);
});

const participantCases = [
  ["conditions", apiCondition, { experimentID: "study" }],
  ["create session", apiData, { experimentID: "study", sessionId: "session" }],
  [
    "append",
    apiData,
    {
      experimentID: "study",
      sessionId: "session",
      data: { trial_type: "test" },
    },
  ],
  [
    "complete",
    apiDataComplete,
    {
      experimentID: "study",
      sessionId: "session",
      trialsData: [{ trial_type: "test" }],
    },
  ],
  [
    "legacy file",
    apiData,
    { experimentID: "study", filename: "results.json", data: "[]" },
  ],
  [
    "finish",
    apiData,
    { action: "finish", experimentID: "study", sessionId: "session" },
  ],
  [
    "participant file",
    uploadParticipantFile,
    {
      experimentID: "study",
      files: [{ name: "a.txt", data: "aGk=", type: "text/plain", size: 2 }],
    },
  ],
];
for (const state of ["preparing", "failed", "awaiting_publication"]) {
  test.each(participantCases)(
    "public %s rejects " + state + " without writing or requesting OAuth",
    async (_name, endpoint, body) => {
      store.seed("experiments/study", {
        owner: "owner",
        active: true,
        storageProvider: "googledrive",
        activeConditionAssignment: true,
        nConditions: 2,
        provisioningState: state === "awaiting_publication" ? "ready" : state,
        initialPublicationPending: state === "awaiting_publication",
      });
      const res = makeRes();
      await endpoint(makeReq({ body }), res);
      expect(res.statusCode).toBe(409);
      expect(res.jsonBody.code).toBe("EXPERIMENT_NOT_READY");
      expect(store.changes).toEqual([]);
      for (const effect of [token, participantUpload, finalize, log])
        expect(effect).not.toHaveBeenCalled();
    },
  );
}

test("legacy participant condition requests still work without researcher authentication", async () => {
  store.seed("experiments/study", {
    owner: "owner",
    active: true,
    activeConditionAssignment: true,
    nConditions: 1,
  });
  const res = makeRes();
  await apiCondition(makeReq({ body: { experimentID: "study" } }), res);
  expect(res.statusCode).toBe(200);
  expect(res.jsonBody.condition).toBe(0);
});

test("a failed first HTML upload leaves capture inactive", async () => {
  upload.mockResolvedValueOnce({ success: false, errorText: "upload failed" });
  const res = makeRes();
  await publishExperiment(publish(), res);
  expect(res.statusCode).toBe(400);
  expect(store.read("experiments/study")).toMatchObject({
    owner: "owner",
    active: false,
    initialPublicationPending: true,
    mutationLease: null,
  });
});

test("a concurrent deletion cannot race a publication preparing its folder", async () => {
  let started;
  const preparing = new Promise((resolve) => {
    started = resolve;
  });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  folder.mockImplementationOnce(async () => {
    started();
    await gate;
    return { success: true, folderId: "folder" };
  });
  const publication = publishExperiment(publish(), makeRes());
  await preparing;
  try {
    const res = makeRes();
    await apiDeleteExperiment(publish(), res);
    expect(res.statusCode).toBe(409);
    expect(res.jsonBody.code).toBe("PUBLICATION_IN_PROGRESS");
    expect(removeFolder).not.toHaveBeenCalled();
  } finally {
    release();
    await publication;
  }
});

test("a stale deletion stops before deleting session history after losing its permission", async () => {
  store.seed("experiments/study", {
    owner: "owner",
    storageProvider: "googledrive",
    driveFolderPath: "/original",
  });
  store.seed("experiments/study/sessions/session", { keep: true });
  removeFolder.mockImplementationOnce(async () => {
    const data = store.read("experiments/study");
    store.seed("experiments/study", {
      ...data,
      mutationLease: { ...data.mutationLease, leaseToken: "newer-operation" },
    });
    return { success: true };
  });
  const res = makeRes();
  await apiDeleteExperiment(publish(), res);
  expect(res.statusCode).toBe(409);
  expect(res.jsonBody.code).toBe("MUTATION_LEASE_LOST");
  expect(store.read("experiments/study/sessions/session")).toEqual({
    keep: true,
  });
});

test("the HTTP response is sent only after releasing the mutation permission", async () => {
  const res = makeRes();
  const observed = [];
  res.json.mockImplementation((body) => {
    observed.push(store.read("experiments/study").mutationLease);
    res.jsonBody = body;
    return res;
  });
  await publishExperiment(publish(), res);
  expect(res.statusCode).toBe(200);
  expect(observed).toEqual([null]);
});
