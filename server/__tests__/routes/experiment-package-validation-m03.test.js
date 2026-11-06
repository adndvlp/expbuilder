import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import JSZip from "jszip";
import { jest } from "@jest/globals";

let app, db, root, assets;
const previousRoot = process.env.DB_ROOT,
  previousPath = process.env.DB_PATH;
const binary = (res, done) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => done(null, Buffer.concat(chunks)));
};
beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "package-validation-m03-"));
  process.env.DB_ROOT = root;
  delete process.env.DB_PATH;
  jest.resetModules();
  const module = await import("../../utils/db.js");
  db = module.db;
  db.data = {};
  module.ensureDbData();
  db.data.experiments.push({
    experimentID: "study",
    name: "Study",
    assetDirectory: "experiments/study/media",
  });
  db.data.configs.push({ experimentID: "study", data: {} });
  await db.write();
  fs.mkdirSync(path.join(root, "experiments/study/media/img"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "experiments/study/media/img/a.png"),
    "original",
  );
  assets = await import("../../modules/experiment-assets/activity.js");
  app = express();
  app.use(express.json());
  app.use(
    (await import("../../modules/session-persistence/dbQueue.js"))
      .serializeDbRequest,
  );
  app.use((await import("../../routes/db.js")).default);
});
afterEach(() => {
  if (previousRoot === undefined) delete process.env.DB_ROOT;
  else process.env.DB_ROOT = previousRoot;
  if (previousPath === undefined) delete process.env.DB_PATH;
  else process.env.DB_PATH = previousPath;
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});
const inspect = (buffer) =>
  request(app)
    .post("/api/import-experiments/inspect")
    .attach("zipfile", buffer, "backup.zip");
const apply = (id) =>
  request(app)
    .post(`/api/import-experiments/${id}/apply`)
    .send({ mode: "restore", replaceExisting: true });
async function exported() {
  return (
    await request(app)
      .get("/api/export-all-experiments")
      .buffer(true)
      .parse(binary)
      .expect(200)
  ).body;
}
test("media edits after inspection invalidate a restoration preview", async () => {
  const preview = (await inspect(await exported()).expect(200)).body;
  fs.writeFileSync(
    path.join(root, "experiments/study/media/img/a.png"),
    "edited",
  );
  expect((await apply(preview.importID).expect(409)).body.code).toBe(
    "IMPORT_PREVIEW_STALE",
  );
  expect(
    fs.readFileSync(
      path.join(root, "experiments/study/media/img/a.png"),
      "utf8",
    ),
  ).toBe("edited");
});
test("background media writes block inspection, export, apply and reset without changing data", async () => {
  const buffer = await exported();
  const preview = (await inspect(buffer).expect(200)).body;
  const before = fs.readFileSync(path.join(root, "database/db.json"), "utf8");
  const finish = assets.beginAssetWrite("experiments/study/media");
  try {
    await inspect(buffer).expect(409);
    await request(app).get("/api/export-all-experiments").expect(409);
    await apply(preview.importID).expect(409);
    const reset = await request(app)
      .post("/api/app/reset")
      .send({})
      .expect(409);
    expect(reset.body.code).toBe("ASSETS_BUSY");
    expect(fs.readFileSync(path.join(root, "database/db.json"), "utf8")).toBe(
      before,
    );
  } finally {
    finish();
  }
});
test("reset removes import receipts and staged previews so old requests cannot resurrect data", async () => {
  const preview = (await inspect(await exported()).expect(200)).body;
  db.data.importCommits = { old: { result: { success: true } } };
  await db.write();
  await request(app).post("/api/app/reset").send({}).expect(200);
  await db.read();
  expect(db.data.importCommits).toEqual({});
  await apply(preview.importID).expect(404);
});
test.each(["null-manifest", "null-entry", "null-file", "invalid-history"])(
  "malformed %s is rejected before any local mutation",
  async (kind) => {
    const zip = await JSZip.loadAsync(await exported());
    const manifest = JSON.parse(
      await zip.file("manifest.json").async("string"),
    );
    if (kind === "null-entry") manifest.entries = [null];
    if (kind === "null-file") manifest.entries[0].media = [null];
    if (kind === "invalid-history") {
      const file = manifest.entries[0].path;
      const data = JSON.parse(await zip.file(file).async("string"));
      data.sessionResults = [null];
      const bytes = Buffer.from(JSON.stringify(data));
      zip.file(file, bytes);
      const { digest } = await import(
        "../../modules/experiment-packages/format.js"
      );
      manifest.entries[0].size = bytes.length;
      manifest.entries[0].sha256 = digest(bytes);
    }
    zip.file(
      "manifest.json",
      JSON.stringify(kind === "null-manifest" ? null : manifest),
    );
    const before = fs.readFileSync(path.join(root, "database/db.json"), "utf8");
    await inspect(await zip.generateAsync({ type: "nodebuffer" })).expect(400);
    expect(fs.readFileSync(path.join(root, "database/db.json"), "utf8")).toBe(
      before,
    );
  },
);
test("invalid dictionary identities are rejected before inspection stages files", async () => {
  const zip = new JSZip();
  zip.file(
    "Invalid/data.json",
    JSON.stringify({
      experiment: { experimentID: "__proto__", name: "Invalid" },
    }),
  );
  await inspect(await zip.generateAsync({ type: "nodebuffer" })).expect(400);
});
test("export rejects an oversized design file before trying to read it into a package", async () => {
  const originalStat = fs.statSync;
  const file = path.join(root, "experiments/study/media/img/a.png");
  jest.spyOn(fs, "statSync").mockImplementation((candidate, ...args) => {
    const stat = originalStat(candidate, ...args);
    if (candidate === file) stat.size = 256 * 1024 * 1024 + 1;
    return stat;
  });
  await request(app).get("/api/export-all-experiments").expect(413);
});
