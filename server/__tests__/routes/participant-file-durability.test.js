import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { jest } from "@jest/globals";

const temporaryRoots = [];

async function createApp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "participant-durability-"));
  temporaryRoots.push(root);
  process.env.DB_ROOT = root;
  delete process.env.DB_PATH;
  jest.resetModules();

  const { db, ensureDbData } = await import("../../utils/db.js");
  db.data = {};
  ensureDbData();
  await db.write();

  const router = (await import("../../routes/files.js")).default;
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(router);
  return { app, db, root };
}

async function seedSession(db) {
  db.data.sessionResults.push({
    experimentID: "E1",
    sessionId: "session-1",
    data: [],
  });
  await db.write();
}

function uploadBody(files) {
  return { sessionId: "session-1", files };
}

afterEach(() => {
  jest.restoreAllMocks();
  temporaryRoots.splice(0).forEach((root) => {
    fs.rmSync(root, { recursive: true, force: true });
  });
});

test("rejects malformed participant files before touching disk", async () => {
  const { app, db, root } = await createApp();
  await seedSession(db);

  await request(app)
    .post("/api/participant-files/E1")
    .send(uploadBody([{ name: "invalid.txt", data: 42 }]))
    .expect(400, { error: "Invalid file payload" });

  await db.read();
  expect(db.data.participantFiles).toEqual([]);
  expect(fs.existsSync(path.join(root, "E1", "participant-files"))).toBe(false);
});

test("rolls back every file when a batch write fails partway", async () => {
  const { app, db, root } = await createApp();
  await seedSession(db);
  const originalWrite = fs.writeFileSync;
  jest
    .spyOn(fs, "writeFileSync")
    .mockImplementationOnce((...args) => originalWrite.call(fs, ...args))
    .mockImplementationOnce(() => {
      throw new Error("disk failed");
    });
  jest.spyOn(console, "error").mockImplementation(() => {});

  await request(app)
    .post("/api/participant-files/E1")
    .send(
      uploadBody([
        { name: "first.txt", data: Buffer.from("first").toString("base64") },
        { name: "second.txt", data: Buffer.from("second").toString("base64") },
      ]),
    )
    .expect(500);

  await db.read();
  expect(db.data.participantFiles).toEqual([]);
  const folder = path.join(root, "E1", "participant-files");
  expect(fs.existsSync(folder) ? fs.readdirSync(folder) : []).toEqual([]);
});

test("stores same-named files separately and sanitizes the session prefix", async () => {
  const { app, db, root } = await createApp();
  db.data.sessionResults.push({
    experimentID: "E1",
    sessionId: "session/with spaces",
    data: [],
  });
  await db.write();
  const encoded = Buffer.from("result").toString("base64");

  const response = await request(app)
    .post("/api/participant-files/E1")
    .send({
      sessionId: "session/with spaces",
      files: [
        { name: "same.txt", data: encoded },
        { name: "same.txt", data: encoded },
      ],
    })
    .expect(200);

  expect(new Set(response.body.fileUrls)).toHaveProperty("size", 2);
  await db.read();
  const filenames = db.data.participantFiles.map((record) => record.filename);
  expect(new Set(filenames)).toHaveProperty("size", 2);
  expect(filenames.every((name) => name.startsWith("session_with_spaces_"))).toBe(true);
  expect(fs.readdirSync(path.join(root, "E1", "participant-files"))).toHaveLength(2);
});

test("rolls back files and records when db.json persistence fails", async () => {
  const { app, db, root } = await createApp();
  await seedSession(db);
  jest.spyOn(db, "write").mockRejectedValueOnce(new Error("database failed"));
  jest.spyOn(console, "error").mockImplementation(() => {});

  await request(app)
    .post("/api/participant-files/E1")
    .send(
      uploadBody([
        { name: "result.txt", data: Buffer.from("result").toString("base64") },
      ]),
    )
    .expect(500);

  await db.read();
  expect(db.data.participantFiles).toEqual([]);
  const folder = path.join(root, "E1", "participant-files");
  expect(fs.existsSync(folder) ? fs.readdirSync(folder) : []).toEqual([]);
});

test("keeps a file recoverable when deleting its db record fails", async () => {
  const { app, db, root } = await createApp();
  const folder = path.join(root, "E1", "participant-files");
  const filePath = path.join(folder, "result.txt");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(filePath, "result");
  db.data.participantFiles.push({
    id: "file-1",
    experimentID: "E1",
    sessionId: "session-1",
    filename: "result.txt",
  });
  await db.write();
  jest.spyOn(db, "write").mockRejectedValueOnce(new Error("database failed"));

  await request(app)
    .delete("/api/participant-files/E1/file-1")
    .expect(500);

  expect(fs.existsSync(filePath)).toBe(true);
  await db.read();
  expect(db.data.participantFiles).toHaveLength(1);
});
