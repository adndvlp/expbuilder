import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

const settings = (revision = 1) => ({
  schemaVersion: 1,
  revision,
  batchConfig: { useIndexedDB: true, batchSize: 9, resumeTimeoutMinutes: 45 },
  recruitmentConfig: { platform: "prolific", prolificCompletionCode: "STUDY" },
  captchaConfig: { enabled: true, provider: "hcaptcha", siteKey: "public-key" },
});
let app, db, tmpDir;
const originalFetch = global.fetch;
const originalProject = process.env.FIREBASE_PROJECT_ID;
const originalUrl = process.env.FIREBASE_URL;
beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "functional-settings-"));
  process.env.DB_ROOT = tmpDir;
  delete process.env.DB_PATH;
  delete process.env.FIREBASE_URL;
  process.env.FIREBASE_PROJECT_ID = "test-project";
  jest.resetModules();
  ({ db } = await import("../../utils/db.js"));
  const { ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  db.data.experiments.push({ experimentID: "legacy", name: "Legacy" });
  await db.write();
  app = express();
  app.use(express.json());
  app.use(
    (await import("../../modules/session-persistence/dbQueue.js"))
      .serializeDbRequest,
  );
  app.use((await import("../../routes/configs.js")).default);
  app.use((await import("../../routes/experiments/crud.js")).default);
});
afterEach(() => {
  global.fetch = originalFetch;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (originalProject === undefined) delete process.env.FIREBASE_PROJECT_ID;
  else process.env.FIREBASE_PROJECT_ID = originalProject;
  if (originalUrl === undefined) delete process.env.FIREBASE_URL;
  else process.env.FIREBASE_URL = originalUrl;
});
const read = () => request(app).get("/api/functional-settings/legacy");
const save = (body) =>
  request(app).put("/api/functional-settings/legacy").send(body);
const migrate = () =>
  request(app)
    .post("/api/functional-settings/legacy/migrate")
    .set("Authorization", "Bearer owner-token")
    .send({ expectedRevision: 0 });
const remote = () => ({
  success: true,
  experimentID: "legacy",
  projectId: "test-project",
  verifiedOwnerUid: "owner",
  settings: settings(),
});

test("new experiments persist explicit complete defaults without a remote call", async () => {
  global.fetch = jest.fn(() => {
    throw new Error("offline");
  });
  const created = await request(app)
    .post("/api/create-experiment")
    .send({ name: "New" })
    .expect(200);
  const result = await request(app)
    .get("/api/functional-settings/" + created.body.experiment.experimentID)
    .expect(200);
  expect(result.body.settingsMigration).toEqual({
    state: "complete",
    source: "new",
  });
  expect(result.body.functionalSettings).toMatchObject({
    schemaVersion: 1,
    revision: 1,
    batchConfig: { batchSize: 0 },
  });
  expect(global.fetch).not.toHaveBeenCalled();
});
test("legacy reads require review rather than inventing a complete configuration", async () => {
  const result = await read().expect(200);
  expect(result.body.functionalSettings).toBeNull();
  expect(result.body.settingsMigration.state).toBe("needs_remote_read");
  await request(app).get("/api/functional-settings/missing").expect(404);
});
test("offline save survives code and session-name saves, with revision conflicts", async () => {
  global.fetch = jest.fn(() => {
    throw new Error("offline");
  });
  await save({
    expectedRevision: 0,
    settings: settings(),
    sessionNameConfig: { tokens: [], separator: "-" },
  }).expect(200);
  await request(app)
    .post("/api/save-config/legacy")
    .send({ config: { code: "generated" }, isDevMode: true })
    .expect(200);
  await request(app)
    .post("/api/session-name-config/legacy")
    .send({ tokens: [], separator: "_" })
    .expect(200);
  const result = await read().expect(200);
  expect(result.body.functionalSettings).toEqual(settings());
  expect(result.body.settingsMigration).toEqual({
    state: "complete",
    source: "local",
  });
  await save({ expectedRevision: 0, settings: settings(99) }).expect(409);
  expect(global.fetch).not.toHaveBeenCalled();
});
test("only one concurrent save based on a revision is committed", async () => {
  const results = await Promise.all([
    save({ expectedRevision: 0, settings: settings() }),
    save({ expectedRevision: 0, settings: settings() }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await read()).body.functionalSettings.revision).toBe(1);
});
test.each([
  [
    "batchConfig",
    { useIndexedDB: true, batchSize: -1, resumeTimeoutMinutes: 30 },
  ],
  ["recruitmentConfig", { platform: "unknown", prolificCompletionCode: "" }],
  ["captchaConfig", { enabled: true, provider: "hcaptcha", siteKey: "" }],
])(
  "invalid %s is rejected without completing migration",
  async (field, value) => {
    await save({
      expectedRevision: 0,
      settings: { ...settings(), [field]: value },
    }).expect(422);
    expect((await read()).body.functionalSettings).toBeNull();
  },
);
test("authorized migration saves once locally and binds the verified project and owner", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => remote() });
  await migrate().expect(200);
  expect(global.fetch).toHaveBeenCalledWith(
    "https://us-central1-test-project.cloudfunctions.net/getExperimentFunctionalSettings",
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer owner-token" }),
    }),
  );
  expect((await read()).body).toMatchObject({
    functionalSettings: settings(),
    settingsMigration: { state: "complete", source: "remote" },
  });
  await db.read();
  expect(db.data.experiments[0].cloudBinding).toMatchObject({
    projectId: "test-project",
    experimentID: "legacy",
    verifiedOwnerUid: "owner",
  });
  await migrate().expect(409);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("denied remote access stays reviewable without losing local design or granting a binding", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({
      code: "EXPERIMENT_FORBIDDEN",
      message: "Not owner",
    }),
  });
  await migrate().expect(403);
  expect((await read()).body).toMatchObject({
    functionalSettings: null,
    settingsMigration: { state: "needs_review" },
  });
  await db.read();
  expect(db.data.experiments[0].cloudBinding).toBeUndefined();
  await save({ expectedRevision: 0, settings: settings() }).expect(200);
});
test("migration refuses an unverified project and requires authentication", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ...remote(), projectId: "another" }),
  });
  await request(app)
    .post("/api/functional-settings/legacy/migrate")
    .send({ expectedRevision: 0 })
    .expect(401);
  await migrate().expect(409);
  expect((await read()).body.functionalSettings).toBeNull();
});
test("a delayed migration cannot overwrite a completed local edit", async () => {
  let resolveRemote;
  global.fetch = jest.fn(
    () =>
      new Promise((resolve) => {
        resolveRemote = resolve;
      }),
  );
  const pending = migrate().then((r) => r);
  for (let i = 0; i < 30 && !resolveRemote; i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  expect(resolveRemote).toBeDefined();
  const manual = settings();
  manual.batchConfig.batchSize = 77;
  await save({ expectedRevision: 0, settings: manual }).expect(200);
  resolveRemote({ ok: true, status: 200, json: async () => remote() });
  expect((await pending).status).toBe(409);
  expect((await read()).body.functionalSettings.batchConfig.batchSize).toBe(77);
});
test("publication rejects unreviewed settings and stale generated settings before any remote request", async () => {
  const publishRouter = (await import("../../routes/experiments/publish.js"))
    .default;
  app.use(publishRouter);
  global.fetch = jest.fn();
  const payload = {
    uid: "owner",
    generatedPublicCode: "code",
    functionalSettings: settings(),
  };
  const unknown = await request(app)
    .post("/api/publish-experiment/legacy")
    .send(payload)
    .expect(422);
  expect(unknown.body.code).toBe("SETTINGS_REVIEW_REQUIRED");
  await save({ expectedRevision: 0, settings: settings() }).expect(200);
  const changed = settings();
  changed.batchConfig.batchSize = 90;
  await save({ expectedRevision: 1, settings: changed }).expect(200);
  const stale = await request(app)
    .post("/api/publish-experiment/legacy")
    .send(payload)
    .expect(409);
  expect(stale.body.code).toBe("SETTINGS_REVISION_CONFLICT");
  expect(global.fetch).not.toHaveBeenCalled();
});
test("recovered settings and provenance survive export in the current ZIP format", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => remote() });
  await migrate().expect(200);
  const { buildExperimentsZip } = await import("../../routes/db/zip.js");
  const { default: JSZip } = await import("jszip");
  await db.read();
  const zip = await JSZip.loadAsync(
    await buildExperimentsZip(db.data.experiments),
  );
  const exported = JSON.parse(
    await zip.file("experiments/legacy/data.json").async("string"),
  );
  expect(exported.config.functionalSettings).toEqual(settings());
  expect(exported.config.settingsMigration).toEqual({
    state: "complete",
    source: "remote",
  });
});
test("remote network failure marks review but never supplies defaults", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("network unavailable"));
  await migrate().expect(503);
  expect((await read()).body).toMatchObject({
    functionalSettings: null,
    settingsMigration: { state: "needs_review" },
  });
});

test("defaults only become complete after an explicit save and retain that review provenance", async () => {
  const { defaultFunctionalSettings } = await import(
    "../../utils/functionalSettings.js"
  );
  expect((await read()).body.functionalSettings).toBeNull();
  await save({
    expectedRevision: 0,
    settings: defaultFunctionalSettings(),
  }).expect(200);
  expect((await read()).body.settingsMigration).toEqual({
    state: "complete",
    source: "reviewed_defaults",
  });
});
