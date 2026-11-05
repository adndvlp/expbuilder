import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

let directory, db, app;
const originalFetch = global.fetch;
const originalRoot = process.env.DB_ROOT;
const originalFunctions = process.env.FIREBASE_URL;
beforeEach(async () => {
  directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "experiment-delete-policy-"),
  );
  process.env.DB_ROOT = directory;
  process.env.FIREBASE_URL = "https://firebase.example.invalid";
  jest.resetModules();
  const database = await import("../../utils/db.js");
  db = database.db;
  db.data = {};
  database.ensureDbData();
  db.data.experiments.push({ experimentID: "study", name: "Study" });
  db.data.trials.push({ experimentID: "study", trials: [{ id: 1 }] });
  await db.write();
  fs.mkdirSync(path.join(directory, "Study/img"), { recursive: true });
  fs.writeFileSync(path.join(directory, "Study/img/stimulus.png"), "original");
  app = express();
  app.use(express.json());
  app.use((await import("../../routes/experiments/crud.js")).default);
});
afterEach(() => {
  global.fetch = originalFetch;
  if (originalRoot === undefined) delete process.env.DB_ROOT;
  else process.env.DB_ROOT = originalRoot;
  if (originalFunctions === undefined) delete process.env.FIREBASE_URL;
  else process.env.FIREBASE_URL = originalFunctions;
  fs.rmSync(directory, { recursive: true, force: true });
});

async function expectPreserved() {
  await db.read();
  expect(db.data.experiments).toHaveLength(1);
  expect(db.data.trials).toHaveLength(1);
  expect(
    fs.readFileSync(path.join(directory, "Study/img/stimulus.png"), "utf8"),
  ).toBe("original");
}

test("remote denial preserves the local design, history and media and forwards authentication", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        code: "EXPERIMENT_FORBIDDEN",
        message: "Not the owner",
      }),
    });
  const response = await request(app)
    .delete("/api/delete-experiment/study")
    .set("Authorization", "Bearer test-token")
    .send({ scope: "remote", uid: "owner" });
  expect(response.status).toBe(403);
  expect(response.body.code).toBe("EXPERIMENT_FORBIDDEN");
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe(
    "Bearer test-token",
  );
  await expectPreserved();
});

test("missing authentication cannot turn remote deletion into local deletion", async () => {
  global.fetch = jest.fn();
  const response = await request(app)
    .delete("/api/delete-experiment/study")
    .send({ scope: "remote", uid: "owner" });
  expect(response.status).toBe(401);
  expect(global.fetch).not.toHaveBeenCalled();
  await expectPreserved();
});

test("a network failure preserves the local experiment", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
  const response = await request(app)
    .delete("/api/delete-experiment/study")
    .set("Authorization", "Bearer test-token")
    .send({ scope: "remote", uid: "owner" });
  expect(response.status).toBe(503);
  await expectPreserved();
});

test("an explicit local-only deletion never contacts Firebase even when signed in", async () => {
  global.fetch = jest.fn();
  await request(app)
    .delete("/api/delete-experiment/study")
    .send({ scope: "local", uid: "owner" })
    .expect(200);
  expect(global.fetch).not.toHaveBeenCalled();
  await db.read();
  expect(db.data.experiments).toEqual([]);
});

test("a successful authorized remote deletion happens before local destruction", async () => {
  global.fetch = jest.fn().mockImplementation(async () => {
    await expectPreserved();
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  });
  await request(app)
    .delete("/api/delete-experiment/study")
    .set("Authorization", "Bearer test-token")
    .send({ scope: "remote", uid: "owner" })
    .expect(200);
  await db.read();
  expect(db.data.experiments).toEqual([]);
  expect(fs.existsSync(path.join(directory, "Study/img/stimulus.png"))).toBe(
    false,
  );
});

test("publication forwards ownership rejection without changing local storage", async () => {
  app.use((await import("../../routes/experiments/publish.js")).default);
  db.data.experiments[0].storage = "googledrive";
  db.data.trials = [
    {
      experimentID: "study",
      entryItemId: null,
      trials: [],
      loops: [],
      timeline: [],
    },
  ];
  await db.write();
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        code: "EXPERIMENT_FORBIDDEN",
        message: "Not the owner",
      }),
    });
  const result = await request(app)
    .post("/api/publish-experiment/study")
    .set("Authorization", "Bearer test-token")
    .send({
      uid: "owner",
      storage: "dropbox",
      generatedPublicCode: "const test = true;",
    });
  expect(result.status).toBe(403);
  expect(result.body.code).toBe("EXPERIMENT_FORBIDDEN");
  await db.read();
  expect(db.data.experiments[0].storage).toBe("googledrive");
});
