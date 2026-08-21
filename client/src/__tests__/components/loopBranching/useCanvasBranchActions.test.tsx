import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasBranchActions } from "../../../pages/ExperimentBuilder/components/Canvas/hooks/useCanvasBranchActions";
import type { CanvasActionScope } from "../../../pages/ExperimentBuilder/components/Canvas/actions";
import type useTrials from "../../../pages/ExperimentBuilder/hooks/useTrials";

const mocks = vi.hoisted(() => ({
  loadLevels: vi.fn(),
  createBranch: vi.fn(),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "experiment-1",
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/Canvas/features/loop-branching/loopBranchApi",
  () => ({
    loadLoopBranchLevels: mocks.loadLevels,
    createLoopBranch: mocks.createBranch,
  }),
);

const scope: CanvasActionScope = {
  kind: "loop",
  loopId: "inner",
  rootItems: [],
  items: [
    {
      id: 1,
      type: "trial",
      name: "Source",
      branches: [99],
      parentLoopId: "inner",
    },
  ],
};

function createTrialsMock() {
  return {
    timeline: [],
    createTrial: vi.fn(),
    createLoop: vi.fn(),
    getTrial: vi.fn(),
    getLoop: vi.fn(),
    updateTrial: vi.fn(),
    updateLoop: vi.fn(),
    updateTrialField: vi.fn(),
    updateTimeline: vi.fn(),
    getTimeline: vi.fn().mockResolvedValue(undefined),
    getLoopTimeline: vi.fn().mockResolvedValue([]),
    applyGraphSnapshot: vi.fn(),
    setSelectedTrial: vi.fn(),
    setSelectedLoop: vi.fn(),
  } as unknown as ReturnType<typeof useTrials>;
}

describe("useCanvasBranchActions loop levels", () => {
  const graph = {
    revision: "2",
    root: { scopeId: null, parentScopeId: null, items: [] },
    scopes: {},
    edges: [],
    diagnostics: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadLevels.mockResolvedValue([
      {
        scopeId: "inner",
        name: "Inner",
        relation: "current",
        branchCount: 0,
      },
      {
        scopeId: null,
        name: "Main timeline",
        relation: "root",
        branchCount: 1,
      },
    ]);
    mocks.createBranch.mockResolvedValue({
      trial: {
        id: 100,
        type: "Trial",
        name: "New Trial",
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
        branches: [],
      },
      crossedLoopIds: ["inner"],
      graph,
    });
  });

  it("opens level first and placement second only for an occupied level", async () => {
    const trials = createTrialsMock();
    const view = renderHook(() => useCanvasBranchActions(trials, scope));

    await act(async () => view.result.current.onAddBranch(1));
    expect(view.result.current.showLoopBranchLevelModal).toBe(true);
    expect(view.result.current.showAddTrialModal).toBe(false);

    await act(async () =>
      view.result.current.handleLoopBranchLevelConfirm(null),
    );
    expect(view.result.current.showLoopBranchLevelModal).toBe(false);
    expect(view.result.current.showAddTrialModal).toBe(true);
    expect(mocks.createBranch).not.toHaveBeenCalled();

    await act(async () => view.result.current.handleAddTrialConfirm(true));
    expect(mocks.createBranch).toHaveBeenCalledWith(
      "experiment-1",
      1,
      null,
      "parallel",
    );
    await waitFor(() =>
      expect(trials.applyGraphSnapshot).toHaveBeenCalledWith(graph),
    );
    expect(trials.getTimeline).not.toHaveBeenCalled();
    expect(trials.getLoopTimeline).not.toHaveBeenCalled();
  });

  it("creates directly after choosing an empty level", async () => {
    const trials = createTrialsMock();
    const view = renderHook(() => useCanvasBranchActions(trials, scope));

    await act(async () => view.result.current.onAddBranch(1));
    await act(async () =>
      view.result.current.handleLoopBranchLevelConfirm("inner"),
    );

    expect(mocks.createBranch).toHaveBeenCalledWith(
      "experiment-1",
      1,
      "inner",
      "parallel",
    );
    expect(view.result.current.showAddTrialModal).toBe(false);
  });
});
