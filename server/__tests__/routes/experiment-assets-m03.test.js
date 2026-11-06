import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

let directory, app, db;
const previousRoot = process.env.DB_ROOT,
  previousPath = process.env.DB_PATH;
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "assets-m03-"));
  process.env.DB_ROOT = directory;
  delete process.env.DB_PATH;
  jest.resetModules();
  const database = await import("../../utils/db.js");
  db = database.db;
  db.data = {};
  database.ensureDbData();
  await db.write();
  app = express();
  app.use(express.json());
  app.use(
    (await import("../../modules/session-persistence/dbQueue.js"))
      .serializeDbRequest,
  );
  app.use((await import("../../routes/experiments.js")).default);
  app.use((await import("../../routes/files.js")).default);
});
afterEach(() => {
  if (previousRoot === undefined) delete process.env.DB_ROOT;
  else process.env.DB_ROOT = previousRoot;
  if (previousPath === undefined) delete process.env.DB_PATH;
  else process.env.DB_PATH = previousPath;
  fs.rmSync(directory, { recursive: true, force: true });
  jest.restoreAllMocks();
});
const create = async (name) =>
  (await request(app).post("/api/create-experiment").send({ name }).expect(200))
    .body.experiment;
const upload = (id, bytes = "one") =>
  request(app)
    .post("/api/upload-files/" + id)
    .attach("files", Buffer.from(bytes), "same.png");
const remove = (id) =>
  request(app)
    .delete("/api/delete-experiment/" + id)
    .send({ scope: "local" });

test("equal titles use independent directories, uploads, listing, serving and deletion", async () => {
  const a = await create("Equal"),
    b = await create("Equal");
  expect(a.assetDirectory).toBe(`experiments/${a.experimentID}/media`);
  expect(b.assetDirectory).toBe(`experiments/${b.experimentID}/media`);
  await upload(a.experimentID, "alpha").expect(200);
  await upload(b.experimentID, "beta").expect(200);
  expect(
    fs.readFileSync(
      path.join(directory, a.assetDirectory, "img/same.png"),
      "utf8",
    ),
  ).toBe("alpha");
  expect(
    (
      await request(app)
        .get(`/api/list-files/all/${b.experimentID}`)
        .expect(200)
    ).body.files,
  ).toEqual([{ name: "same.png", url: "img/same.png", type: "img" }]);
  expect(
    (
      await request(app).get(`/${a.experimentID}/img/same.png`).expect(200)
    ).body.toString(),
  ).toBe("alpha");
  await remove(a.experimentID).expect(200);
  expect(
    fs.readFileSync(
      path.join(directory, b.assetDirectory, "img/same.png"),
      "utf8",
    ),
  ).toBe("beta");
});
test("a legacy directory is bound once and remains available after changing the title", async () => {
  db.data.experiments.push({ experimentID: "legacy", name: "Original" });
  await db.write();
  fs.mkdirSync(path.join(directory, "Original/img"), { recursive: true });
  fs.writeFileSync(path.join(directory, "Original/img/old.png"), "original");
  await request(app).get("/api/list-files/img/legacy").expect(200);
  await db.read();
  expect(db.data.experiments[0].assetDirectory).toBe("Original");
  db.data.experiments[0].name = "Renamed";
  await db.write();
  expect(
    (await request(app).get("/legacy/img/old.png").expect(200)).body.toString(),
  ).toBe("original");
  await upload("legacy", "next").expect(200);
  expect(fs.existsSync(path.join(directory, "Original/img/same.png"))).toBe(
    true,
  );
  expect(fs.existsSync(path.join(directory, "Renamed"))).toBe(false);
});
test("deleting a legacy record does not remove a directory referenced by another record", async () => {
  db.data.experiments.push(
    { experimentID: "a", name: "Shared" },
    { experimentID: "b", name: "Shared" },
  );
  await db.write();
  fs.mkdirSync(path.join(directory, "Shared/img"), { recursive: true });
  fs.writeFileSync(path.join(directory, "Shared/img/keep.png"), "keep");
  await upload("a").expect(409);
  await remove("a").expect(200);
  expect(
    fs.readFileSync(path.join(directory, "Shared/img/keep.png"), "utf8"),
  ).toBe("keep");
  await request(app).get("/b/img/keep.png").expect(200);
});
test("background writes prevent deletion and reserved legacy directories cannot be removed", async () => {
  const exp = await create("Safe");
  const { beginAssetWrite } = await import(
    "../../modules/experiment-assets/activity.js"
  );
  const finish = beginAssetWrite(exp.assetDirectory);
  try {
    await remove(exp.experimentID).expect(409);
  } finally {
    finish();
  }
  await db.read();
  db.data.experiments.push({ experimentID: "unsafe", name: "DATABASE" });
  await db.write();
  await remove("unsafe").expect(409);
  expect(fs.existsSync(path.join(directory, "database/db.json"))).toBe(true);
});
test("publication does not read a legacy HTML artifact outside the artifact directory", async () => {
  const exp = await create("../outside");
  fs.writeFileSync(
    path.join(directory, "outside.html"),
    '<html><head></head><body><p id="outside-secret">private</p></body></html>',
  );
  const originalFetch = global.fetch,
    originalUrl = process.env.FIREBASE_URL;
  process.env.FIREBASE_URL = "https://backend.example.invalid";
  global.fetch = jest.fn(async () => ({
    status: 200,
    json: async () => ({ success: true }),
  }));
  try {
    await db.read();
    await request(app)
      .post(`/api/publish-experiment/${exp.experimentID}`)
      .send({
        uid: "owner",
        generatedPublicCode: "code();",
        functionalSettings: db.data.configs[0].functionalSettings,
      })
      .expect(200);
    expect(
      JSON.parse(global.fetch.mock.calls[0][1].body).htmlContent,
    ).not.toContain("outside-secret");
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.FIREBASE_URL;
    else process.env.FIREBASE_URL = originalUrl;
  }
});
test("unknown experiment uploads fail without creating orphan folders", async () => {
  await upload("missing").expect(404);
  expect(fs.existsSync(path.join(directory, "missing"))).toBe(false);
});
test("legacy names that resolve to the same physical directory are protected as shared media", async () => {
  db.data.experiments.push(
    { experimentID: "upper", name: "CaseStudy" },
    { experimentID: "lower", name: "casestudy" },
  );
  await db.write();
  fs.mkdirSync(path.join(directory, "CaseStudy/img"), { recursive: true });
  fs.writeFileSync(path.join(directory, "CaseStudy/img/keep.png"), "keep");
  const sameDirectory = fs.existsSync(
    path.join(directory, "casestudy/img/keep.png"),
  );
  if (sameDirectory) {
    await upload("lower").expect(409);
    await remove("upper").expect(200);
    expect(
      fs.readFileSync(path.join(directory, "casestudy/img/keep.png"), "utf8"),
    ).toBe("keep");
  } else {
    await upload("lower").expect(200);
    await remove("upper").expect(200);
    expect(fs.existsSync(path.join(directory, "casestudy/img/same.png"))).toBe(
      true,
    );
  }
});
test("library paths cannot read or delete database files through type or filename parameters", async () => {
  await create("Safe");
  const before = fs.readFileSync(
    path.join(directory, "database/db.json"),
    "utf8",
  );
  await request(app).get("/api/list-files/database/missing").expect(400);
  await request(app)
    .delete("/api/delete-file/img/..%2F..%2Fdatabase%2Fdb.json/missing")
    .expect(400);
  expect(
    fs.readFileSync(path.join(directory, "database/db.json"), "utf8"),
  ).toBe(before);
});
test("a symlink in a media directory is rejected rather than exposing another directory", async () => {
  const exp = await create("Safe");
  const target = path.join(directory, "outside");
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "secret.png"), "private");
  const media = path.join(directory, exp.assetDirectory ?? "Safe");
  fs.mkdirSync(media, { recursive: true });
  fs.symlinkSync(target, path.join(media, "img"));
  await request(app).get(`/api/list-files/img/${exp.experimentID}`).expect(409);
  await request(app).get(`/${exp.experimentID}/img/secret.png`).expect(409);
});
