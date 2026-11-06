import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import JSZip from "jszip";
import { jest } from "@jest/globals";

let app, db, directory;
const rootBefore = process.env.DB_ROOT,
  pathBefore = process.env.DB_PATH,
  fetchBefore = global.fetch;
const settings = {
  schemaVersion: 1,
  revision: 3,
  batchConfig: { useIndexedDB: false, batchSize: 7, resumeTimeoutMinutes: 60 },
  recruitmentConfig: { platform: "prolific", prolificCompletionCode: "DONE" },
  captchaConfig: { enabled: true, provider: "hcaptcha", siteKey: "public" },
};
const graph = (id) => ({
  experimentID: id,
  entryItemId: 1,
  trials: [
    {
      id: 1,
      name: "T",
      defaultNextTrialId: null,
      branchConditions: [],
      branches: [],
      stimulus: `http://localhost:3000/${id}/img/x.png`,
    },
  ],
  loops: [],
  timeline: [{ id: 1, type: "trial" }],
});
const binary = (res, done) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => done(null, Buffer.concat(chunks)));
};
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "packages-m03-"));
  process.env.DB_ROOT = directory;
  delete process.env.DB_PATH;
  jest.resetModules();
  const mod = await import("../../utils/db.js");
  db = mod.db;
  db.data = {};
  mod.ensureDbData();
  await db.write();
  app = express();
  app.use(express.json());
  app.use(
    (await import("../../modules/session-persistence/dbQueue.js"))
      .serializeDbRequest,
  );
  app.use((await import("../../routes/experiments.js")).default);
  app.use((await import("../../routes/configs.js")).default);
  app.use((await import("../../routes/db.js")).default);
  global.fetch = jest.fn(() => {
    throw new Error("No remote operation is allowed during import");
  });
});
afterEach(() => {
  if (rootBefore === undefined) delete process.env.DB_ROOT;
  else process.env.DB_ROOT = rootBefore;
  if (pathBefore === undefined) delete process.env.DB_PATH;
  else process.env.DB_PATH = pathBefore;
  global.fetch = fetchBefore;
  jest.restoreAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});
async function seed(id = "origin", name = "Equal") {
  const exp = {
    experimentID: id,
    name,
    author: "Tep",
    assetDirectory: `experiments/${id}/media`,
    owner: "remote-owner",
    pagesUrl: "https://original.invalid",
    driveFolderId: "original-folder",
    githubTokens: { access_token: "secret" },
    cloudBinding: {
      projectId: "original",
      experimentID: id,
      verifiedOwnerUid: "remote-owner",
    },
  };
  db.data.experiments.push(exp);
  db.data.trials.push(graph(id));
  db.data.configs.push({
    experimentID: id,
    data: { generatedCode: "old generated" },
    isDevMode: false,
    functionalSettings: settings,
    settingsMigration: { state: "complete", source: "local" },
    sessionNameConfig: { tokens: [], separator: "_" },
  });
  db.data.sessionResults.push({
    experimentID: id,
    sessionId: "old",
    data: [{ secret: "result" }],
  });
  db.data.sessionCounters[id] = 11;
  await db.write();
  fs.mkdirSync(path.join(directory, exp.assetDirectory, "img"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(directory, exp.assetDirectory, "img/x.png"),
    "design",
  );
  return exp;
}
async function exported(query = "") {
  return (
    await request(app)
      .get("/api/export-all-experiments" + query)
      .buffer(true)
      .parse(binary)
      .expect(200)
  ).body;
}
const inspect = (buffer) =>
  request(app)
    .post("/api/import-experiments/inspect")
    .attach("zipfile", buffer, "package.zip");
const apply = (id, mode = "copy", extra = {}) =>
  request(app)
    .post(`/api/import-experiments/${id}/apply`)
    .send({ mode, ...extra });
async function legacy(payload) {
  const zip = new JSZip();
  zip.file("Old/data.json", JSON.stringify(payload));
  zip.file("Old/img/x.png", "design");
  return zip.generateAsync({ type: "nodebuffer" });
}

test("portable v2 export separates equal titles, hashes media and excludes operational and participant data", async () => {
  await seed();
  await seed("second");
  const zip = await JSZip.loadAsync(await exported("?kind=portable"));
  const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  expect(manifest).toMatchObject({
    format: "expbuilder",
    schemaVersion: 2,
    kind: "portable",
  });
  expect(manifest.entries).toHaveLength(2);
  expect(new Set(manifest.entries.map((e) => e.path)).size).toBe(2);
  const value = JSON.parse(
    await zip.file(manifest.entries[0].path).async("string"),
  );
  expect(value.experiment).toMatchObject({ name: "Equal", author: "Tep" });
  expect(value.experiment.owner).toBeUndefined();
  expect(value.experiment.githubTokens).toBeUndefined();
  expect(value.experiment.cloudBinding).toBeUndefined();
  expect(value.sessionResults).toBeUndefined();
  expect(value.sessionCounter).toBeUndefined();
  expect(value.config.functionalSettings).toEqual(settings);
  expect(manifest.entries[0].media[0]).toMatchObject({
    logicalPath: "img/x.png",
    size: 6,
    sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});
test("two imports as copies preserve internal IDs and design settings with independent identity and files", async () => {
  const original = await seed();
  const buffer = await exported();
  const first = (await inspect(buffer).expect(200)).body;
  expect(first.entries[0].settingsState).toBe("complete");
  const a = (await apply(first.importID).expect(200)).body;
  const again = (await apply(first.importID).expect(200)).body;
  expect(again.idMap).toEqual(a.idMap);
  const second = (await inspect(buffer).expect(200)).body;
  const b = (await apply(second.importID).expect(200)).body;
  const aid = a.idMap.origin,
    bid = b.idMap.origin;
  expect(aid).not.toBe("origin");
  expect(bid).not.toBe(aid);
  await db.read();
  expect(db.data.experiments).toHaveLength(3);
  for (const id of [aid, bid]) {
    const copy = db.data.experiments.find((e) => e.experimentID === id);
    expect(copy.name).toBe("Equal");
    expect(copy.author).toBe("Tep");
    expect(copy.owner).toBeUndefined();
    expect(copy.cloudBinding).toBeUndefined();
    expect(copy.pagesUrl).toBeUndefined();
    const trials = db.data.trials.find((t) => t.experimentID === id);
    expect(trials.trials[0].id).toBe(1);
    expect(trials.trials[0].stimulus).toBe("img/x.png");
    const cfg = db.data.configs.find((c) => c.experimentID === id);
    expect(cfg.functionalSettings.batchConfig.batchSize).toBe(7);
    expect(cfg.settingsMigration).toEqual({
      state: "complete",
      source: "package",
    });
    expect(cfg.data.generatedCode).toBe("");
    expect(db.data.sessionResults.some((s) => s.experimentID === id)).toBe(
      false,
    );
    expect(db.data.sessionCounters[id] ?? 0).toBe(0);
    expect(
      fs.readFileSync(
        path.join(directory, copy.assetDirectory, "img/x.png"),
        "utf8",
      ),
    ).toBe("design");
  }
  expect(
    db.data.experiments.find((e) => e.experimentID === "origin"),
  ).toMatchObject(original);
  expect(global.fetch).not.toHaveBeenCalled();
});
test("legacy settings remain pending review and a DevMode source is retained with an explicit deployment review", async () => {
  const buffer = await legacy({
    experiment: { experimentID: "old", name: "Old" },
    trials: graph("old"),
    config: {
      experimentID: "old",
      isDevMode: true,
      data: { generatedCode: 'fetch("http://localhost:3000/old")' },
    },
  });
  const plan = (await inspect(buffer).expect(200)).body;
  expect(plan.entries[0].settingsState).toBe("needs_review");
  const result = (await apply(plan.importID).expect(200)).body;
  await db.read();
  const cfg = db.data.configs.find((c) => c.experimentID === result.idMap.old);
  expect(cfg.settingsMigration).toEqual({
    state: "needs_review",
    source: "package",
  });
  expect(cfg.functionalSettings).toBeUndefined();
  expect(cfg.data.generatedCode).toBe('fetch("http://localhost:3000/old")');
  expect(cfg.deploymentReview.required).toBe(true);
});
test("restoration requires explicit replacement and refuses a stale preview", async () => {
  await seed();
  const buffer = await exported();
  const plan = (await inspect(buffer).expect(200)).body;
  expect(plan.entries[0].collision).toBe(true);
  await apply(plan.importID, "restore").expect(409);
  db.data.experiments[0].description = "edited";
  await db.write();
  await apply(plan.importID, "restore", { replaceExisting: true }).expect(409);
  await db.read();
  expect(db.data.experiments[0].description).toBe("edited");
});
test("restoring empty histories clears residual sessions and counters while preserving ID and requiring association verification", async () => {
  await seed();
  const buffer = await legacy({
    experiment: {
      experimentID: "origin",
      name: "Restored",
      cloudBinding: { projectId: "foreign" },
    },
    trials: graph("origin"),
    config: { experimentID: "origin", data: {}, isDevMode: false },
    sessionResults: [],
    participantFiles: [],
    sessionCounter: 0,
  });
  db.data.mutationReceipts = [{ experimentId: "origin", payload: "{}" }];
  await db.write();
  const plan = (await inspect(buffer).expect(200)).body;
  await apply(plan.importID, "restore", { replaceExisting: true }).expect(200);
  await db.read();
  expect(db.data.experiments[0]).toMatchObject({
    experimentID: "origin",
    name: "Restored",
  });
  expect(db.data.experiments[0].cloudBinding).toBeUndefined();
  expect(db.data.sessionResults).toHaveLength(0);
  expect(db.data.sessionCounters.origin).toBe(0);
  expect(db.data.mutationReceipts).toHaveLength(0);
  expect(global.fetch).not.toHaveBeenCalled();
});
test("a failed database write rolls back both metadata and replaced media", async () => {
  await seed();
  const buffer = await legacy({
    experiment: { experimentID: "origin", name: "Changed" },
    trials: graph("origin"),
    sessionResults: [],
  });
  const plan = (await inspect(buffer).expect(200)).body;
  jest.spyOn(db, "write").mockRejectedValueOnce(new Error("disk failure"));
  const failure = await apply(plan.importID, "restore", {
    replaceExisting: true,
  }).expect(500);
  expect(failure.body.code).toBe("IMPORT_ROLLED_BACK");
  await db.read();
  expect(db.data.experiments[0].name).toBe("Equal");
  expect(
    fs.readFileSync(
      path.join(directory, "experiments/origin/media/img/x.png"),
      "utf8",
    ),
  ).toBe("design");
});
test("a portable package cannot be restored under its origin identity", async () => {
  await seed();
  const plan = (await inspect(await exported("?kind=portable")).expect(200))
    .body;
  await apply(plan.importID, "restore", { replaceExisting: true }).expect(400);
});
test("unsupported versions, empty archives and damaged media fail before changing local records", async () => {
  await seed();
  const buffer = await exported();
  const zip = await JSZip.loadAsync(buffer);
  const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  manifest.schemaVersion = 999;
  zip.file("manifest.json", JSON.stringify(manifest));
  await inspect(await zip.generateAsync({ type: "nodebuffer" })).expect(400);
  await inspect(await new JSZip().generateAsync({ type: "nodebuffer" })).expect(
    400,
  );
  manifest.schemaVersion = 2;
  zip.file("manifest.json", JSON.stringify(manifest));
  zip.file(manifest.entries[0].media[0].path, "tampered");
  await inspect(await zip.generateAsync({ type: "nodebuffer" })).expect(400);
  await db.read();
  expect(db.data.experiments).toHaveLength(1);
});
test("the legacy automatic importer refuses mutation without an inspection and explicit intent", async () => {
  await request(app)
    .post("/api/import-experiments")
    .attach(
      "zipfile",
      await legacy({ experiment: { experimentID: "old", name: "Old" } }),
      "old.zip",
    )
    .expect(426);
  await db.read();
  expect(db.data.experiments).toHaveLength(0);
});
test("deployment-specific settings require explicit review before publication and retain their values", async () => {
  await seed();
  const plan = (await inspect(await exported()).expect(200)).body;
  const imported = (await apply(plan.importID).expect(200)).body,
    id = imported.idMap.origin;
  const saved = (
    await request(app)
      .get("/api/functional-settings/" + id)
      .expect(200)
  ).body;
  expect(saved.deploymentReview).toMatchObject({
    required: true,
    reasons: expect.any(Array),
  });
  await request(app)
    .post("/api/publish-experiment/" + id)
    .send({
      uid: "owner",
      generatedPublicCode: "code",
      functionalSettings: saved.functionalSettings,
    })
    .expect(422);
  await request(app)
    .put("/api/functional-settings/" + id)
    .send({
      expectedRevision: saved.revision,
      settings: saved.functionalSettings,
    })
    .expect(422);
  await request(app)
    .put("/api/functional-settings/" + id)
    .send({
      expectedRevision: saved.revision,
      settings: saved.functionalSettings,
      confirmDeploymentReview: true,
    })
    .expect(200);
  const reviewed = (await request(app).get("/api/functional-settings/" + id))
    .body;
  expect(reviewed.deploymentReview.required).toBe(false);
  expect(reviewed.functionalSettings.captchaConfig.siteKey).toBe("public");
  expect(global.fetch).not.toHaveBeenCalled();
});
test("copy preserves loops, conditional navigation and CSV references while separating participant files", async () => {
  const original = await seed();
  const doc = db.data.trials[0];
  doc.entryItemId = "loop";
  doc.timeline = [{ id: "loop", type: "loop" }];
  doc.trials[0].parentLoopId = "loop";
  doc.trials[0].branches = [1];
  doc.trials[0].branchConditions = [
    {
      id: "again",
      rules: [{ trialId: 1, column: "response", op: "==", value: "again" }],
      nextTrialId: 1,
    },
  ];
  doc.trials[0].csvJson = [
    {
      stimulus: "http://localhost:3000/origin/img/x.png?version=1",
      audio: "https://example.org/intentional.mp3",
      label: "origin",
    },
  ];
  doc.loops = [
    {
      id: "loop",
      trials: [1],
      entryItemId: 1,
      nextItemId: null,
      repetitions: 4,
    },
  ];
  db.data.participantFiles = [
    {
      id: "private",
      experimentID: "origin",
      sessionId: "old",
      filename: "private.txt",
    },
  ];
  fs.mkdirSync(
    path.join(directory, original.assetDirectory, "participant-files"),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(
      directory,
      original.assetDirectory,
      "participant-files/private.txt",
    ),
    "private result",
  );
  await db.write();
  const before = structuredClone(doc),
    buffer = await exported();
  const plan = (await inspect(buffer).expect(200)).body,
    result = (await apply(plan.importID).expect(200)).body,
    id = result.idMap.origin;
  await db.read();
  const copy = db.data.trials.find((t) => t.experimentID === id);
  expect(copy.loops).toEqual(before.loops);
  expect(copy.entryItemId).toBe("loop");
  expect(copy.trials[0].branchConditions).toEqual(
    before.trials[0].branchConditions,
  );
  expect(copy.trials[0].csvJson).toEqual([
    {
      stimulus: "img/x.png?version=1",
      audio: "https://example.org/intentional.mp3",
      label: "origin",
    },
  ]);
  expect(
    fs.existsSync(
      path.join(
        directory,
        `experiments/${id}/media/participant-files/private.txt`,
      ),
    ),
  ).toBe(false);
  expect(db.data.participantFiles).toHaveLength(1);
  fs.writeFileSync(
    path.join(
      directory,
      original.assetDirectory,
      "participant-files/private.txt",
    ),
    "changed",
  );
  const restore = (await inspect(buffer).expect(200)).body;
  await apply(restore.importID, "restore", { replaceExisting: true }).expect(
    200,
  );
  expect(
    fs.readFileSync(
      path.join(
        directory,
        original.assetDirectory,
        "participant-files/private.txt",
      ),
      "utf8",
    ),
  ).toBe("private result");
});
test("backup association hints exclude credentials even if bindings acquire new operational fields", async () => {
  await seed();
  db.data.experiments[0].cloudBinding.access_token = "DO_NOT_EXPORT_TOKEN";
  db.data.experiments[0].githubBinding = {
    repositoryId: 123,
    accountId: 9,
    ownerLogin: "owner",
    repoName: "repo",
    branch: "main",
    tokens: { access_token: "DO_NOT_EXPORT_TOKEN" },
  };
  await db.write();
  const zip = await JSZip.loadAsync(await exported());
  const value = JSON.parse(
    await zip.file("experiments/origin/data.json").async("string"),
  );
  expect(JSON.stringify(value)).not.toContain("DO_NOT_EXPORT_TOKEN");
  expect(value.remoteHints.githubBinding.repositoryId).toBe(123);
});
test("typed component media values are rebased and an existing review remains pending", async () => {
  await seed();
  db.data.trials[0].trials[0].columnMapping = {
    components: {
      source: "typed",
      value: [
        {
          type: "ImageComponent",
          stimulus: {
            source: "typed",
            value: "http://localhost:3000/origin/img/x.png",
          },
        },
        {
          type: "VideoComponent",
          stimulus: {
            source: "typed",
            value: ["/origin/vid/clip.mp4", "https://example.org/clip.mp4"],
          },
        },
        {
          type: "TextComponent",
          text: {
            source: "typed",
            value: "http://localhost:3000/origin/img/x.png",
          },
        },
      ],
    },
  };
  db.data.configs[0].deploymentReview = {
    required: true,
    reasons: ["Existing review must be retained."],
  };
  await db.write();
  const preview = (await inspect(await exported()).expect(200)).body;
  const result = (await apply(preview.importID).expect(200)).body;
  await db.read();
  const id = result.idMap.origin;
  const components = db.data.trials.find((t) => t.experimentID === id).trials[0]
    .columnMapping.components.value;
  expect(components[0].stimulus.value).toBe("img/x.png");
  expect(components[1].stimulus.value).toEqual([
    "vid/clip.mp4",
    "https://example.org/clip.mp4",
  ]);
  expect(components[2].text.value).toBe(
    "http://localhost:3000/origin/img/x.png",
  );
  expect(
    db.data.configs.find((c) => c.experimentID === id).deploymentReview.reasons,
  ).toContain("Existing review must be retained.");
});
