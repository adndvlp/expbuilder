import { afterAll, beforeAll, expect, it, jest } from "@jest/globals";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import express from "express";
import request from "supertest";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";

let root;
let app;
const previousRoot = process.env.DB_ROOT;
const previousPath = process.env.DB_PATH;
beforeAll(async () => {
  root = await fs.mkdtemp(
    path.join(os.tmpdir(), "expbuilder-memory-metadata-"),
  );
  process.env.DB_ROOT = root;
  delete process.env.DB_PATH;
  jest.resetModules();
  const { db, ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  db.data.experiments.push({ experimentID: "E1", name: "Memory test" });
  await db.write();
  for (const type of ["img", "aud", "vid"])
    await fs.mkdir(path.join(root, "Memory test", type), { recursive: true });
  await sharp({
    create: { width: 1200, height: 800, channels: 4, background: "red" },
  })
    .png()
    .toFile(path.join(root, "Memory test/img/large photo.png"));
  await fs.writeFile(
    path.join(root, "Memory test/img/broken.png"),
    "not an image",
  );
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=48000:cl=stereo",
    "-t",
    "1",
    path.join(root, "Memory test/aud/tone.wav"),
  ]);
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=64x32:r=10",
    "-t",
    "0.3",
    "-c:v",
    "libvpx",
    path.join(root, "Memory test/vid/movie.webm"),
  ]);
  app = express();
  app.use((await import("../../routes/files/memory.js")).default);
});
afterAll(async () => {
  if (previousRoot === undefined) delete process.env.DB_ROOT;
  else process.env.DB_ROOT = previousRoot;
  if (previousPath === undefined) delete process.env.DB_PATH;
  else process.env.DB_PATH = previousPath;
  await fs.rm(root, { recursive: true, force: true });
});

const inspect = (file) =>
  request(app).get("/api/media-memory-metadata/E1").query({ file });

it("returns actual stored size and original image dimensions", async () => {
  const response = await inspect("img/large%20photo.png").expect(200);
  const stat = await fs.stat(
    path.join(root, "Memory test/img/large photo.png"),
  );
  expect(response.body).toMatchObject({
    sizeBytes: stat.size,
    width: 1200,
    height: 800,
  });
});
it("inspects real audio headers without decoding a complete AudioBuffer", async () => {
  const response = await inspect("aud/tone.wav").expect(200);
  expect(response.body).toMatchObject({
    durationSeconds: 1,
    sampleRate: 48000,
    channels: 2,
  });
});
it("inspects real video headers and measures its file size", async () => {
  const response = await inspect("vid/movie.webm").expect(200);
  const stat = await fs.stat(path.join(root, "Memory test/vid/movie.webm"));
  expect(response.body).toMatchObject({
    sizeBytes: stat.size,
    width: 64,
    height: 32,
  });
});
it("preserves measured file size when decoding metadata is unsupported", async () => {
  const response = await inspect("img/broken.png").expect(200);
  expect(response.body).toEqual({ sizeBytes: 12 });
});
it.each([
  "https://external.test/file.mp4",
  "vid/../movie.webm",
  "vid/%2e%2e%2fsecret",
  "vid/%5csecret",
  "vid/%zz",
  "others/file.txt",
])("rejects non-library or escaping media references: %s", async (file) => {
  await inspect(file).expect(400);
});
it("rejects symlinks escaping the experiment's media directory", async () => {
  const outside = path.join(root, "outside.mp4");
  await fs.writeFile(outside, "private");
  await fs.symlink(outside, path.join(root, "Memory test/vid/escaped.mp4"));
  await inspect("vid/escaped.mp4").expect(400);
});
it("reports a missing resource", async () => {
  await inspect("vid/missing.mp4").expect(404);
});
