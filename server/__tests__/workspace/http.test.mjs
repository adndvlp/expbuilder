import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";

test("workspace commands round trip through real HTTP routes and an isolated JSON database", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "workspace-v2-test-"));
  process.env.DB_ROOT = dir;
  process.env.DB_PATH = path.join(dir, "db.json");
  const seed = {
    experiments: [{ experimentID: "empty" }],
    sessionResults: [{ mustRemain: true }],
    trials: [
      {
        experimentID: "test",
        updatedAt: "seed",
        entryItemId: 1,
        timeline: [
          { id: 1, type: "trial" },
          { id: 2, type: "trial" },
          { id: 3, type: "trial" },
        ],
        loops: [],
        trials: [
          {
            id: 1,
            name: "A",
            parentLoopId: null,
            defaultNextTrialId: 2,
            branches: [2, 3],
            branchConditions: [],
            parameters: { text: "kept" },
          },
          {
            id: 2,
            name: "B",
            parentLoopId: null,
            defaultNextTrialId: null,
            branches: [],
            branchConditions: [],
          },
          {
            id: 3,
            name: "C",
            parentLoopId: null,
            defaultNextTrialId: null,
            branches: [],
            branchConditions: [],
          },
        ],
      },
    ],
  };
  await writeFile(process.env.DB_PATH, JSON.stringify(seed));
  const router = (await import("../../routes/workspace/index.js")).default;
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = await new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  const url =
    "http://127.0.0.1:" + server.address().port + "/api/workspace/test";
  let revision = "seed",
    sequence = 0;
  const request = async (kind, args = {}, options = {}) => {
    const response = await fetch(url + "/commands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": options.key ?? "operation-" + sequence++,
      },
      body: JSON.stringify({
        kind,
        args,
        expectedRevision: options.revision ?? revision,
      }),
    });
    const result = await response.json();
    if (response.ok) revision = result.revision;
    return { response, result };
  };
  try {
    await t.test("GET does not convert or write data", async () => {
      const before = await readFile(process.env.DB_PATH, "utf8"),
        response = await fetch(url),
        body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.document.workspaceSchemaVersion, undefined);
      assert.equal(await readFile(process.env.DB_PATH, "utf8"), before);
    });
    await t.test(
      "new empty experiments load read-only and initialize through the conversion command",
      async () => {
        const before = await readFile(process.env.DB_PATH, "utf8"),
          response = await fetch(url.replace("/test", "/empty")),
          snapshot = await response.json();
        assert.equal(response.status, 200);
        assert.equal(snapshot.document.entryItemId, null);
        assert.equal(await readFile(process.env.DB_PATH, "utf8"), before);
        const converted = await fetch(
          url.replace("/test", "/empty") + "/commands",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": "empty",
            },
            body: JSON.stringify({
              kind: "convertWorkspace",
              args: {},
              expectedRevision: snapshot.revision,
            }),
          },
        );
        assert.equal(converted.status, 200);
        assert.equal(
          (await converted.json()).document.workspaceSchemaVersion,
          2,
        );
      },
    );
    let conversion;
    await t.test(
      "conversion persists routing-only references and does not modify participant data",
      async () => {
        const { response, result } = await request(
          "convertWorkspace",
          {},
          { key: "conversion" },
        );
        assert.equal(response.status, 200);
        conversion = result;
        const data = JSON.parse(await readFile(process.env.DB_PATH, "utf8"));
        assert.equal(data.trials[0].workspaceSchemaVersion, 2);
        assert.equal(
          data.trials[0].trials[0].branchConditions[0].kind,
          "route",
        );
        assert.deepEqual(data.sessionResults, seed.sessionResults);
      },
    );
    await t.test(
      "creation uses a real numeric ID and preserves the configured start",
      async () => {
        const { response, result } = await request("addTrial", {
          trial: { name: "Detached", parameters: { complete: true } },
        });
        assert.equal(response.status, 200);
        const added = result.document.trials.find((t) => t.name === "Detached");
        assert.equal(typeof added.id, "number");
        assert.deepEqual(added.branches, []);
        assert.equal(result.document.entryItemId, 1);
      },
    );
    await t.test(
      "replaying an older conversion returns its original response without reverting later work",
      async () => {
        const { response, result } = await request(
          "convertWorkspace",
          {},
          { key: "conversion", revision: "seed" },
        );
        assert.equal(response.status, 200);
        assert.deepEqual(result, conversion);
        const data = JSON.parse(await readFile(process.env.DB_PATH, "utf8"));
        assert.equal(data.trials[0].trials.length, 4);
        revision = data.trials[0].authoringRevision;
      },
    );
    await t.test(
      "invalid commands, stale revisions and reused keys leave the database unchanged",
      async () => {
        let before = await readFile(process.env.DB_PATH, "utf8");
        let result = await request("connect", { sourceId: 1, targetId: 999 });
        assert.equal(result.response.status, 400);
        assert.equal(await readFile(process.env.DB_PATH, "utf8"), before);
        result = await request("addTrial", {}, { revision: "stale" });
        assert.equal(result.response.status, 409);
        assert.equal(await readFile(process.env.DB_PATH, "utf8"), before);
        result = await request("addTrial", {}, { key: "conversion" });
        assert.equal(result.response.status, 409);
        assert.equal(await readFile(process.env.DB_PATH, "utf8"), before);
      },
    );
    await t.test(
      "delete and undo persist only the intended navigation changes",
      async () => {
        const removed = await request("removeConnection", {
          sourceId: 1,
          targetId: 2,
        });
        assert.equal(removed.response.status, 200);
        assert.deepEqual(removed.result.document.trials[0].branches, [3]);
        const restored = await request("applyHistory", {
          changes: removed.result.undoPatch,
          direction: "undo",
        });
        assert.equal(restored.response.status, 200);
        assert.deepEqual(restored.result.document.trials[0].branches, [2, 3]);
        assert.deepEqual(restored.result.document.trials[0].parameters, {
          text: "kept",
        });
      },
    );
    await t.test(
      "old raw readers and all legacy writers are rejected after conversion",
      async () => {
        const raw = url.replace("/workspace/test", "/trial/test/1");
        assert.equal((await fetch(raw)).status, 409);
        assert.equal(
          (
            await fetch(raw, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-Workspace-Schema": "2",
              },
              body: JSON.stringify({ name: "blocked" }),
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "a failed disk write leaves neither records nor receipts and a retry creates only once",
      async () => {
        const { db } = await import("../../utils/db.js");
        const before = await readFile(process.env.DB_PATH, "utf8"),
          write = db.write;
        let failed;
        try {
          db.write = async () => {
            throw Error("test storage unavailable");
          };
          failed = await request(
            "addTrial",
            { trial: { name: "Retry" } },
            { key: "storage-retry" },
          );
        } finally {
          db.write = write;
        }
        assert.equal(failed.response.status, 500);
        assert.equal(await readFile(process.env.DB_PATH, "utf8"), before);
        const retry = await request(
          "addTrial",
          { trial: { name: "Retry" } },
          { key: "storage-retry" },
        );
        assert.equal(retry.response.status, 200);
        assert.equal(
          retry.result.document.trials.filter((t) => t.name === "Retry").length,
          1,
        );
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
