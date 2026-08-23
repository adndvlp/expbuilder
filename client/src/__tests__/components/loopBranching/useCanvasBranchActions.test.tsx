import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasBranchActions } from "../../../pages/ExperimentBuilder/components/Canvas/hooks/useCanvasBranchActions";
import type { CanvasActionScope } from "../../../pages/ExperimentBuilder/components/Canvas/actions";
import type useTrials from "../../../pages/ExperimentBuilder/hooks/useTrials";
import { AuthoringRequestError } from "../../../pages/ExperimentBuilder/modules/experiment-authoring/http";

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
    {
      id: 2,
      type: "trial",
      name: "Later trial",
      branches: [],
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
    mocks.loadLevels.mockResolvedValue({
      revision: "1",
      levels: [
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
      ],
    });
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

  it("[TC-01A] [TC-05] opens level first for a non-terminal trial and placement second only for an occupied level", async () => {
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
      expect.objectContaining({
        expectedRevision: "1",
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(trials.applyGraphSnapshot).toHaveBeenCalledWith(graph),
    );
    expect(trials.getTimeline).not.toHaveBeenCalled();
    expect(trials.getLoopTimeline).not.toHaveBeenCalled();
    expect(trials.setSelectedTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 100 }),
    );
    expect(trials.setSelectedLoop).toHaveBeenCalledWith(null);
  });

  it("[TC-01] [TC-08] opens level selection for a branchless loop trial and selects the created target", async () => {
    const trials = createTrialsMock();
    const branchlessScope: CanvasActionScope = {
      ...scope,
      items: [{ ...scope.items[0]!, branches: [] }, scope.items[1]!],
    };
    const view = renderHook(() =>
      useCanvasBranchActions(trials, branchlessScope),
    );

    await act(async () => view.result.current.onAddBranch(1));
    expect(view.result.current.showLoopBranchLevelModal).toBe(true);
    expect(mocks.createBranch).not.toHaveBeenCalled();
    expect(trials.createTrial).not.toHaveBeenCalled();

    await act(async () =>
      view.result.current.handleLoopBranchLevelConfirm("inner"),
    );
    expect(mocks.createBranch).toHaveBeenCalledTimes(1);
    expect(trials.setSelectedTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 100 }),
    );
  });

  it("[TC-02] cancels a started level flow without mutating the graph", async () => {
    const trials = createTrialsMock();
    const view = renderHook(() => useCanvasBranchActions(trials, scope));

    await act(async () => view.result.current.onAddBranch(1));
    act(() => view.result.current.cancelLoopBranchFlow());

    expect(view.result.current.showLoopBranchLevelModal).toBe(false);
    expect(view.result.current.showAddTrialModal).toBe(false);
    expect(mocks.createBranch).not.toHaveBeenCalled();
    expect(trials.applyGraphSnapshot).not.toHaveBeenCalled();
  });

  it("[TD-05] [TC-09] keeps ineligible root sources on the existing Parent vs Branch flow", async () => {
    const trials = createTrialsMock();
    const rootScope: CanvasActionScope = {
      kind: "root",
      items: [
        { id: 1, type: "trial", name: "Parent", branches: [2] },
        { id: 2, type: "trial", name: "Existing", branches: [] },
      ],
    };
    const view = renderHook(() =>
      useCanvasBranchActions(trials, rootScope),
    );

    await act(async () => view.result.current.onAddBranch(1));
    expect(view.result.current.showAddTrialModal).toBe(true);
    expect(view.result.current.showLoopBranchLevelModal).toBe(false);
    expect(mocks.loadLevels).not.toHaveBeenCalled();
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
      expect.objectContaining({
        expectedRevision: "1",
        idempotencyKey: expect.any(String),
      }),
    );
    expect(view.result.current.showAddTrialModal).toBe(false);
  });

  it("[TC-07] reloads level options after a revision conflict without applying stale state", async () => {
    const refreshedLevels = [
      {
        scopeId: "inner",
        name: "Inner refreshed",
        relation: "current" as const,
        branchCount: 2,
      },
    ];
    mocks.loadLevels
      .mockResolvedValueOnce({
        revision: "1",
        levels: [
          {
            scopeId: "inner",
            name: "Inner",
            relation: "current",
            branchCount: 0,
          },
        ],
      })
      .mockResolvedValueOnce({ revision: "2", levels: refreshedLevels });
    mocks.createBranch.mockRejectedValueOnce(
      new AuthoringRequestError({
        method: "POST",
        path: "/api/loop-branch/experiment-1",
        status: 409,
        responseBody: { code: "REVISION_CONFLICT" },
      }),
    );
    const trials = createTrialsMock();
    const view = renderHook(() => useCanvasBranchActions(trials, scope));

    await act(async () => view.result.current.onAddBranch(1));
    await act(async () =>
      view.result.current.handleLoopBranchLevelConfirm("inner"),
    );

    await waitFor(() =>
      expect(view.result.current.loopBranchLevels).toEqual(refreshedLevels),
    );
    expect(view.result.current.showLoopBranchLevelModal).toBe(true);
    expect(mocks.loadLevels).toHaveBeenCalledTimes(2);
    expect(trials.applyGraphSnapshot).not.toHaveBeenCalled();
  });
});
