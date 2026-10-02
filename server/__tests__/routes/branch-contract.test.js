import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { buildExperimentGraph } from "../../routes/timeline/graph/buildExperimentGraph.js";

const condition = (target) => ({
  id: 10,
  rules: [{ column: "response", op: "==", value: "yes" }],
  nextTrialId: target,
  customParameters: { stimulus: { source: "typed", value: "keep" } },
});

const seedDoc = () => ({
  experimentID: "E1",
  updatedAt: "before",
  trials: [
    { id: 1, name: "A", branches: ["2"], branchConditions: [condition("2")] },
    { id: 2, name: "B", parentLoopId: "container", branches: [3] },
    { id: 3, name: "C", branches: [] },
  ],
  loops: [{ id: "container", name: "Container", trials: [2], repetitions: 2 }],
  timeline: [
    { id: 1, type: "trial", name: "A", branches: ["2"] },
    { id: "container", type: "loop", name: "Container", trials: [2] },
    { id: 3, type: "trial", name: "C", branches: [] },
  ],
});

describe("trial-only branching contract", () => {
  let tmpDir, db, app, agent;
  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "branch-contract-"));
    process.env.DB_ROOT = tmpDir;
    delete process.env.DB_PATH;
    jest.resetModules();
    const database = await import("../../utils/db.js");
    db = database.db;
    db.data = {};
    database.ensureDbData();
    db.data.experiments.push({ experimentID: "E1", name: "Experiment" });
    db.data.trials.push(seedDoc());
    await db.write();
    app = express();
    app.use(express.json());
    app.use((await import("../../routes/timeline/index.js")).default);
    agent = {
      ...(await import("../../agent/tools/create/loop-create.js"))
        .loopCreateTools,
      ...(await import("../../agent/tools/create/loop-update.js"))
        .loopUpdateTools,
      ...(await import("../../agent/tools/create/trials.js")).trialTools,
      ...(await import("../../agent/tools/create/timeline.js")).timelineTools,
    };
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DB_ROOT;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function expectUnchanged(action, expectedCode) {
    const before = structuredClone(db.data);
    const write = jest.spyOn(db, "write");
    const result = await action();
    expect(result.code).toBe(expectedCode);
    expect(write).not.toHaveBeenCalled();
    expect(db.data).toEqual(before);
    await db.read();
    expect(db.data).toEqual(before);
  }

  test.each([
    [
      "post",
      "/api/loop/E1",
      { name: "Invalid", trials: [2], branches: [] },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "post",
      "/api/loop/E1",
      { name: "Invalid", trials: [2], branchConditions: [] },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "patch",
      "/api/loop/E1/container",
      { name: "Changed", trials: [1], branches: null },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "patch",
      "/api/loop/E1/container",
      { name: "Changed", branchConditions: [condition(3)] },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "post",
      "/api/trial/E1",
      { name: "Invalid", parentLoopId: "container", branches: ["container"] },
      "BRANCH_TARGET_NOT_TRIAL",
    ],
    [
      "post",
      "/api/trial/E1",
      { name: "Invalid", branchConditions: [condition("container")] },
      "BRANCH_TARGET_NOT_TRIAL",
    ],
    [
      "patch",
      "/api/trial/E1/1",
      {
        name: "Changed",
        parentLoopId: "container",
        branches: [3, "container"],
      },
      "BRANCH_TARGET_NOT_TRIAL",
    ],
    [
      "patch",
      "/api/trial/E1/1",
      { name: "Changed", branchConditions: [condition("container")] },
      "BRANCH_TARGET_NOT_TRIAL",
    ],
    [
      "patch",
      "/api/timeline/E1",
      {
        timeline: [
          { id: "container", type: "loop", name: "Invalid", branches: [] },
        ],
      },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "patch",
      "/api/timeline/E1",
      {
        timeline: [
          {
            id: "container",
            type: "loop",
            name: "Invalid",
            branchConditions: [],
          },
        ],
      },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "patch",
      "/api/timeline/E1",
      {
        timeline: [
          { id: 1, type: "trial", name: "Invalid", branches: ["container"] },
        ],
      },
      "BRANCH_TARGET_NOT_TRIAL",
    ],
  ])(
    "API rejects %s %s: %j without changes",
    async (method, url, payload, code) => {
      await expectUnchanged(
        async () =>
          (await request(app)[method](url).send(payload).expect(400)).body,
        code,
      );
    },
  );

  test.each([
    [
      "create_loop",
      { name: "Invalid", trials: [2], branches: [] },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "create_loop",
      { name: "Invalid", trials: [2], branchConditions: [] },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "update_loop",
      {
        loopId: "container",
        updates: { name: "Changed", trials: [1], branches: [3] },
      },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "update_loop",
      {
        loopId: "container",
        updates: { name: "Changed", branchConditions: [] },
      },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "create_trial",
      { name: "Invalid", plugin: "plugin-dynamic", branches: ["container"] },
      "BRANCH_TARGET_NOT_TRIAL",
    ],
    [
      "create_trial",
      {
        name: "Invalid",
        plugin: "plugin-dynamic",
        branchConditions: [condition("container")],
      },
      "BRANCH_TARGET_NOT_TRIAL",
    ],
    [
      "update_trial",
      { trialId: 1, updates: { name: "Changed", branches: ["container"] } },
      "BRANCH_TARGET_NOT_TRIAL",
    ],
    [
      "update_trial",
      {
        trialId: 1,
        updates: {
          name: "Changed",
          branchConditions: [condition("container")],
        },
      },
      "BRANCH_TARGET_NOT_TRIAL",
    ],
    [
      "reorder_timeline",
      {
        timeline: [
          { id: "container", type: "loop", name: "Invalid", branches: [] },
        ],
      },
      "BRANCH_SOURCE_NOT_TRIAL",
    ],
    [
      "reorder_timeline",
      {
        timeline: [
          { id: 1, type: "trial", name: "Invalid", branches: ["container"] },
        ],
      },
      "BRANCH_TARGET_NOT_TRIAL",
    ],
  ])("agent rejects %s: %j without changes", async (tool, payload, code) => {
    await expectUnchanged(
      () => agent[tool].execute({ experimentID: "E1", ...payload }),
      code,
    );
  });

  test("rejects loop fields before creating a document", async () => {
    await expectUnchanged(
      async () =>
        (
          await request(app)
            .post("/api/loop/new")
            .send({ name: "Invalid", trials: [], branches: [] })
            .expect(400)
        ).body,
      "BRANCH_SOURCE_NOT_TRIAL",
    );
  });

  test.each([
    ["container", 3],
    [1, "container"],
  ])(
    "connection validation rejects loop endpoint %s → %s",
    async (source, target) => {
      const result = await request(app)
        .get("/api/validate-connection/E1")
        .query({ source, target })
        .expect(200);
      expect(result.body.isValid).toBe(false);
    },
  );

  test("graph reports invalid loop edges and emits trial edges only", () => {
    const doc = seedDoc();
    doc.trials[0].branches.push("container");
    doc.loops[0].branches = [3];
    const graph = buildExperimentGraph(doc);
    expect(
      graph.edges.map(({ sourceId, targetId }) => [sourceId, targetId]),
    ).toEqual([
      [1, 2],
      [2, 3],
    ]);
    expect(graph.diagnostics).toEqual(
      expect.arrayContaining([
        { code: "BRANCH_SOURCE_NOT_TRIAL", sourceId: "container" },
        { code: "BRANCH_TARGET_NOT_TRIAL", sourceId: 1, targetId: "container" },
      ]),
    );
    expect(
      graph.root.items.find(({ id }) => id === "container"),
    ).not.toHaveProperty("branches");
  });

  test("graph reports a conditional loop target even without a structural edge", () => {
    const doc = seedDoc();
    doc.trials[0].branchConditions = [condition("container")];
    expect(buildExperimentGraph(doc).diagnostics).toContainEqual({
      code: "BRANCH_TARGET_NOT_TRIAL",
      sourceId: 1,
      targetId: "container",
    });
  });

  test.each([
    ["container", "inner", []],
    ["inner", "sibling", ["inner"]],
    ["inner", null, ["inner", "container"]],
    [null, "inner", []],
  ])(
    "keeps trial identities when routing from %s to %s",
    (sourceOwner, targetOwner, exitedLoopIds) => {
      const doc = seedDoc();
      doc.trials[0].parentLoopId = sourceOwner;
      doc.trials[1].parentLoopId = targetOwner;
      doc.loops = [
        { id: "container", name: "Container", trials: ["inner", "sibling"] },
        { id: "inner", name: "Inner", parentLoopId: "container", trials: [] },
        {
          id: "sibling",
          name: "Sibling",
          parentLoopId: "container",
          trials: [],
        },
      ];
      doc.timeline = [{ id: "container", type: "loop", name: "Container" }];
      for (const trial of doc.trials) {
        if (trial.parentLoopId) {
          doc.loops
            .find(({ id }) => id === trial.parentLoopId)
            .trials.push(trial.id);
        } else {
          doc.timeline.push({ id: trial.id, type: "trial", name: trial.name });
        }
      }
      const graph = buildExperimentGraph(doc);
      expect(graph.diagnostics).toEqual([]);
      expect(graph.edges.find(({ sourceId }) => sourceId === 1)).toEqual({
        sourceId: 1,
        targetId: 2,
        sourceOwnerId: sourceOwner,
        targetOwnerId: targetOwner,
        exitedLoopIds,
      });
      expect(doc.trials[0].branches).toEqual(["2"]);
    },
  );

  test.each(["api", "agent"])(
    "%s grouping preserves exact trial IDs, conditions, and parameters",
    async (via) => {
      const args = { name: "Nested", trials: [2], parentLoopId: "container" };
      const result =
        via === "api"
          ? (await request(app).post("/api/loop/E1").send(args).expect(200))
              .body
          : await agent.create_loop.execute({ experimentID: "E1", ...args });
      expect(result.success).toBe(true);
      const doc = db.data.trials[0];
      expect(doc.trials[0].branches).toEqual(["2"]);
      expect(doc.trials[0].branchConditions).toEqual([condition("2")]);
      expect(doc.trials[1].branches).toEqual([3]);
      expect(doc.trials[1].parentLoopId).toBe(result.loop.id);
      expect(result.loop).not.toHaveProperty("branches");
      expect(result.loop).not.toHaveProperty("branchConditions");
      const graph = buildExperimentGraph(doc);
      expect(graph.diagnostics).toEqual([]);
      expect(
        graph.edges.find(({ sourceId }) => sourceId === 2).exitedLoopIds,
      ).toEqual([result.loop.id, "container"]);
    },
  );

  test.each(["api", "agent"])(
    "%s accepts conditional trial destinations across scopes",
    async (via) => {
      const updates = {
        branches: ["2", 3],
        branchConditions: [condition("2"), condition(null)],
      };
      const result =
        via === "api"
          ? (
              await request(app)
                .patch("/api/trial/E1/1")
                .send(updates)
                .expect(200)
            ).body
          : await agent.update_trial.execute({
              experimentID: "E1",
              trialId: 1,
              updates,
            });
      expect(result.success).toBe(true);
      expect(result.trial.branches).toEqual(["2", 3]);
      expect(result.trial.branchConditions).toEqual(updates.branchConditions);
      expect(buildExperimentGraph(db.data.trials[0]).diagnostics).toEqual([]);
    },
  );

  test("agent schemas exclude loop branching even when fields are empty", () => {
    const loop = { experimentID: "E1", name: "Loop", trials: [] };
    expect(agent.create_loop.parameters.safeParse(loop).success).toBe(true);
    for (const field of ["branches", "branchConditions"]) {
      expect(
        agent.create_loop.parameters.safeParse({ ...loop, [field]: [] })
          .success,
      ).toBe(false);
      expect(
        agent.reorder_timeline.parameters.safeParse({
          experimentID: "E1",
          timeline: [
            { id: "container", type: "loop", name: "Loop", [field]: [] },
          ],
        }).success,
      ).toBe(false);
    }
  });
});
