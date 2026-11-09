import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

let app, db, root;
const prior = {
  root: process.env.DB_ROOT,
  path: process.env.DB_PATH,
  url: process.env.FIREBASE_URL,
  project: process.env.FIREBASE_PROJECT_ID,
  fetch: global.fetch,
};
const context = () => ({
  success: true,
  exists: true,
  experimentID: "study",
  projectId: "m04-project",
  verifiedOwnerUid: "owner",
  storage: {
    state: "bound",
    provider: "dropbox",
    binding: { provider: "dropbox", accountId: "account", folderId: "folder" },
  },
  github: {
    state: "bound",
    binding: {
      repositoryId: "123",
      accountId: "9",
      ownerLogin: "owner",
      repoName: "original",
      branch: "main",
    },
  },
});
beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "bindings-m04-proxy-"));
  process.env.DB_ROOT = root;
  delete process.env.DB_PATH;
  process.env.FIREBASE_URL = "https://backend.example.invalid";
  process.env.FIREBASE_PROJECT_ID = "m04-project";
  jest.resetModules();
  const module = await import("../../utils/db.js");
  db = module.db;
  db.data = {};
  module.ensureDbData();
  db.data.experiments.push({
    experimentID: "study",
    name: "Local",
    remoteAssociationHint: { projectId: "foreign", experimentID: "origin" },
  });
  await db.write();
  app = express();
  app.use(express.json());
  app.use(
    (await import("../../modules/session-persistence/dbQueue.js"))
      .serializeDbRequest,
  );
  app.use((await import("../../routes/experiments.js")).default);
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => context(),
  }));
});
afterEach(() => {
  for (const [name, value] of Object.entries({
    DB_ROOT: prior.root,
    DB_PATH: prior.path,
    FIREBASE_URL: prior.url,
    FIREBASE_PROJECT_ID: prior.project,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  global.fetch = prior.fetch;
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});
const read = () =>
  request(app)
    .get("/api/deployment-context/study")
    .set("Authorization", "Bearer token");
test("requires authentication and a local experiment before proxying", async () => {
  await request(app).get("/api/deployment-context/study").expect(401);
  await request(app)
    .get("/api/deployment-context/missing")
    .set("Authorization", "Bearer token")
    .expect(404);
  expect(global.fetch).not.toHaveBeenCalled();
});
test("returns and records only authoritative bindings, without consulting imported association hints", async () => {
  const response = await read().expect(200);
  expect(response.body.github.binding.repoName).toBe("original");
  expect(global.fetch).toHaveBeenCalledWith(
    "https://backend.example.invalid/getExperimentDeploymentContext",
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer token" }),
      body: JSON.stringify({
        experimentID: "study",
        backendProjectId: "m04-project",
      }),
    }),
  );
  await db.read();
  expect(db.data.experiments[0].cloudBinding).toMatchObject({
    projectId: "m04-project",
    experimentID: "study",
    verifiedOwnerUid: "owner",
  });
  expect(db.data.experiments[0].storage).toBe("dropbox");
});
test("a returned identity for another backend is rejected before saving metadata", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ...context(), projectId: "another" }),
  });
  await read().expect(409);
  await db.read();
  expect(db.data.experiments[0].cloudBinding).toBeUndefined();
});
test("preserves an ownership rejection from the backend", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({
      success: false,
      code: "EXPERIMENT_FORBIDDEN",
      message: "Not the owner",
    }),
  });
  const response = await read().expect(403);
  expect(response.body.code).toBe("EXPERIMENT_FORBIDDEN");
  await db.read();
  expect(db.data.experiments[0].cloudBinding).toBeUndefined();
});
test("an older backend without the new function requires an upgrade", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => {
      throw new Error("HTML response");
    },
  });
  expect((await read().expect(426)).body.code).toBe("BACKEND_UPGRADE_REQUIRED");
});
test("inspection and confirmation use separate actions and cannot override the selected experiment", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ...context(), preview: { fingerprint: "verified" } }),
  });
  await request(app)
    .post("/api/deployment-bindings/study/inspect")
    .set("Authorization", "Bearer token")
    .send({
      experimentID: "foreign",
      selection: { repository: "owner/original" },
    })
    .expect(200);
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
    experimentID: "study",
    action: "inspect",
    selection: { repository: "owner/original" },
    backendProjectId: "m04-project",
  });
  await request(app)
    .post("/api/deployment-bindings/study/confirm")
    .set("Authorization", "Bearer token")
    .send({
      fingerprint: "verified",
      contextFingerprint: "revision",
      selection: { repository: "owner/original" },
    })
    .expect(200);
  expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toMatchObject({
    experimentID: "study",
    action: "confirm",
    fingerprint: "verified",
  });
});
test("a slow context read does not hold the database lock for participant writes", async () => {
  let finish;
  global.fetch.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({ ok: true, status: 200, json: async () => context() });
      }),
  );
  const pending = read().then((value) => value);
  for (let i = 0; i < 30 && !finish; i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  expect(finish).toBeDefined();
  const { withDbMutation } = await import(
    "../../modules/session-persistence/dbQueue.js"
  );
  let timer;
  try {
    await Promise.race([
      withDbMutation((data) => {
        data.sessionCounters.study = 7;
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Context request holds the database lock")),
          1000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  finish();
  await pending;
  await db.read();
  expect(db.data.sessionCounters.study).toBe(7);
});
test("repair forwards only the explicit resource, acknowledgement and verified preview to the fixed experiment", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      ...context(),
      repairResult: { resource: "github", urlMayChange: true },
    }),
  });
  await request(app)
    .post("/api/deployment-bindings/study/repair/confirm")
    .set("Authorization", "Bearer token")
    .send({
      experimentID: "foreign",
      resource: "github",
      confirmReplacement: true,
      acknowledgeDataLoss: true,
      fingerprint: "preview",
      contextFingerprint: "original",
      backendProjectId: "m04-project",
    })
    .expect(200);
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
    experimentID: "study",
    action: "repair-confirm",
    resource: "github",
    confirmReplacement: true,
    acknowledgeDataLoss: true,
    backendProjectId: "m04-project",
  });
});
test("a preview from another backend is rejected before sending a repair request", async () => {
  await request(app)
    .post("/api/deployment-bindings/study/repair/confirm")
    .set("Authorization", "Bearer token")
    .send({ resource: "storage", backendProjectId: "old-project" })
    .expect(409);
  expect(global.fetch).not.toHaveBeenCalled();
});
