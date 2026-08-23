import { describe, expect, it, vi } from "vitest";
import { createExperimentAuthoringClient } from "./client";
import { AuthoringRequestError } from "./http";

const response = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("experiment authoring client", () => {
  it("unwraps the canonical graph response", async () => {
    const graph = {
      revision: "r1",
      root: { scopeId: null, parentScopeId: null, items: [] },
      scopes: {},
      edges: [],
      diagnostics: [],
    };
    const client = createExperimentAuthoringClient({
      fetchImpl: vi.fn().mockResolvedValue(response({ graph })),
    });

    await expect(client.getGraph("E1")).resolves.toEqual(graph);
  });

  it("uses the production authoring endpoints from experiment creation through loop branching", async () => {
    const graph = { revision: "r1", root: { items: [] }, scopes: {}, edges: [], diagnostics: [] };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true, experiment: { experimentID: "E1", name: "Vertical" } }))
      .mockResolvedValueOnce(response({ success: true, trial: { id: 1, name: "Source" }, graph }))
      .mockResolvedValueOnce(response({ success: true, loop: { id: "loop_1", name: "Loop" }, graph }))
      .mockResolvedValueOnce(response({ success: true, trial: { id: 2, name: "Exit" }, crossedLoopIds: ["loop_1"], graph }));
    const client = createExperimentAuthoringClient({
      baseUrl: "http://127.0.0.1:4321/",
      fetchImpl,
    });

    const experiment = await client.createExperiment({ name: "Vertical" });
    await client.createTrial(experiment.experimentID, {
      type: "Trial",
      name: "Source",
      plugin: "plugin-dynamic",
      parameters: {},
      trialCode: "",
    });
    await client.createLoop(experiment.experimentID, {
      name: "Loop",
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      orderColumns: [],
      categories: false,
      categoryColumn: "",
      categoryData: [],
      trials: [1],
      code: "",
    });
    const branch = await client.createLoopBranch("E1", 1, null, "parallel", {
      expectedRevision: "r1",
      idempotencyKey: "branch-command-1",
    });

    expect(branch.crossedLoopIds).toEqual(["loop_1"]);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:4321/api/create-experiment",
      "http://127.0.0.1:4321/api/trial/E1",
      "http://127.0.0.1:4321/api/loop/E1",
      "http://127.0.0.1:4321/api/loop-branch/E1",
    ]);
    expect(JSON.parse(String(fetchImpl.mock.calls[3][1]?.body))).toEqual({
      sourceTrialId: 1,
      targetScopeId: null,
      mode: "parallel",
      expectedRevision: "r1",
    });
    expect(fetchImpl.mock.calls[3][1]?.headers).toEqual(
      expect.objectContaining({ "Idempotency-Key": "branch-command-1" }),
    );
  });

  it("preserves endpoint, status, and a non-JSON server body in failures", async () => {
    const client = createExperimentAuthoringClient({
      fetchImpl: vi.fn().mockResolvedValue(response("<!doctype html>", 404)),
    });

    await expect(client.createExperiment({ name: "Broken" })).rejects.toEqual(
      expect.objectContaining<Partial<AuthoringRequestError>>({
        name: "AuthoringRequestError",
        method: "POST",
        path: "/api/create-experiment",
        status: 404,
        responseBody: "<!doctype html>",
      }),
    );
  });
});
