import { describe, expect, it, vi } from "vitest";
import { ScenarioAuthoringSession } from "../../../../../runtime-e2e/authoring/ScenarioAuthoringSession";
import type { ExperimentAuthoringClient } from "./types";

const graph = (revision: string, itemId?: number) => ({
  revision,
  root: {
    scopeId: null,
    parentScopeId: null,
    items: itemId === undefined
      ? []
      : [{ id: itemId, name: `Trial ${itemId}`, type: "trial" as const }],
  },
  scopes: {},
  edges: [],
  diagnostics: [],
});

function client(): ExperimentAuthoringClient {
  return {
    createExperiment: vi.fn().mockResolvedValue({
      experimentID: "experiment-1",
      name: "Vertical",
    }),
    getGraph: vi.fn(),
    createTrial: vi.fn().mockResolvedValue({
      success: true,
      trial: { id: 1, name: "New Trial", type: "Trial" },
      graph: graph("r1", 1),
    }),
    updateTrial: vi.fn().mockResolvedValue({
      success: true,
      trial: { id: 1, name: "Source", type: "Trial" },
      graph: graph("r2", 1),
    }),
    createLoopBranch: vi.fn().mockResolvedValue({
      success: true,
      trial: { id: 2, name: "Exit", type: "Trial" },
      graph: graph("r3", 2),
    }),
    loadLoopBranchLevels: vi.fn().mockResolvedValue([]),
  } as unknown as ExperimentAuthoringClient;
}

describe("scenario authoring state boundary", () => {
  it("bootstraps an empty UI graph and replaces it from every mutation", async () => {
    const api = client();
    const session = new ScenarioAuthoringSession("http://unused", api);
    await session.createExperiment("Vertical");

    expect(session.graph.root.items).toEqual([]);
    expect(api.getGraph).not.toHaveBeenCalled();

    const actions = session.canvasDependencies();
    await actions.createTrial({
      name: "New Trial",
      type: "Trial",
      plugin: "plugin-dynamic",
      parameters: {},
      trialCode: "",
    });
    expect(session.graph.revision).toBe("r1");

    await actions.updateTrial(1, { name: "Source" });
    expect(session.graph.revision).toBe("r2");

    await session.loopBranchDependencies().createBranch(
      "experiment-1",
      1,
      null,
      "parallel",
    );
    expect(session.graph.revision).toBe("r3");
  });
});
