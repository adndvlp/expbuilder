import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Loop,
  Trial,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import { useCanvasWorkspace } from "../../pages/ExperimentBuilder/components/Canvas/hooks/useCanvasWorkspace";
import type { TimelineItem } from "../../pages/ExperimentBuilder/contexts/TrialsContext";

const mocks = vi.hoisted(() => ({
  trials: {} as Record<string, unknown>,
  flowOptions: null as Record<string, unknown> | null,
  loadLevels: vi.fn(),
  createBranch: vi.fn(),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trials,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "experiment-1",
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/features/loop-branching/loopBranchApi",
  () => ({
    loadLoopBranchLevels: mocks.loadLevels,
    createLoopBranch: mocks.createBranch,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/hooks/useFlowLayout",
  () => ({
    useFlowLayout: (options: Record<string, unknown>) => {
      mocks.flowOptions = options;
      return { nodes: [], edges: [] };
    },
  }),
);

const loopItems: TimelineItem[] = [
  { id: 10, type: "trial", name: "Task", branches: [] },
  { id: 11, type: "trial", name: "End", branches: [] },
];
const makeTrial = (id: number, overrides: Partial<Trial> = {}): Trial => ({
  id,
  type: "Trial",
  name: `Trial ${id}`,
  plugin: "plugin-dynamic",
  parameters: {},
  trialCode: "",
  branches: [],
  ...overrides,
});
const makeLoop = (id: string, overrides: Partial<Loop> = {}): Loop => ({
  id,
  name: id,
  repetitions: 1,
  randomize: false,
  orders: false,
  stimuliOrders: [],
  orderColumns: [],
  categories: false,
  categoryColumn: "",
  categoryData: [],
  trials: [],
  code: "",
  ...overrides,
});
function createTrialsMock() {
  const parent = makeLoop("parent", { trials: [10, 11] });
  const trials = {
    timeline: [
      { id: "before", type: "trial", name: "Before" },
      { id: "parent", type: "loop", name: "Parent loop" },
    ] as TimelineItem[],
    loopTimeline: [] as TimelineItem[],
    loopTimelineCache: {},
    activeLoopId: null,
    selectedTrial: null,
    selectedLoop: null,
    setSelectedTrial: vi.fn(),
    setSelectedLoop: vi.fn(),
    getTrial: vi.fn(async (id: string | number) =>
      id === 10 || id === 11 ? makeTrial(Number(id)) : null,
    ),
    getLoop: vi.fn(async (id: string | number) =>
      id === "parent" ? parent : null,
    ),
    getLoopTimeline: vi.fn(async () => loopItems),
    activateLoopTimeline: vi.fn(() => true),
    clearLoopTimeline: vi.fn(),
    createTrial: vi.fn(async (input: Omit<Trial, "id">) =>
      makeTrial(99, input),
    ),
    createLoop: vi.fn(async (input: Omit<Loop, "id">) =>
      makeLoop("nested-created", input),
    ),
    updateTrial: vi.fn(async () => null),
    updateLoop: vi.fn(async () => null),
    updateTrialField: vi.fn(async () => true),
    updateTimeline: vi.fn(async () => true),
    applyGraphSnapshot: vi.fn(),
  };
  mocks.trials = trials;
  return trials;
}

async function activateParentScope(
  result: { current: ReturnType<typeof useCanvasWorkspace> },
) {
  await act(async () => {
    await result.current.expanded.expandLoop({
      id: "parent",
      name: "Parent loop",
    });
  });
  expect(result.current.actionScope).toMatchObject({
    kind: "loop",
    loopId: "parent",
  });
}

describe("useCanvasWorkspace active action scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadLevels.mockResolvedValue({
      revision: "1",
      levels: [
        {
          scopeId: "parent",
          name: "Parent loop",
          relation: "current",
          branchCount: 0,
        },
      ],
    });
    mocks.createBranch.mockResolvedValue({
      trial: makeTrial(99, { parentLoopId: "parent" }),
      crossedLoopIds: [],
      graph: {
        revision: "2",
        root: { scopeId: null, parentScopeId: null, items: [] },
        scopes: {},
        edges: [],
        diagnostics: [],
      },
    });
  });

  it("routes a non-terminal trial through level selection in the expanded loop", async () => {
    const trials = createTrialsMock();
    const { result } = renderHook(() => useCanvasWorkspace());
    await activateParentScope(result);

    await act(async () => {
      await result.current.branchActions.onAddBranch(10);
    });

    expect(result.current.branchActions.showLoopBranchLevelModal).toBe(true);
    expect(mocks.loadLevels).toHaveBeenCalledWith("experiment-1", 10);
    expect(trials.createTrial).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.branchActions.handleLoopBranchLevelConfirm("parent");
    });

    expect(mocks.createBranch).toHaveBeenCalledWith(
      "experiment-1",
      10,
      "parent",
      "parallel",
      expect.objectContaining({
        expectedRevision: "1",
        idempotencyKey: expect.any(String),
      }),
    );
    expect(trials.applyGraphSnapshot).toHaveBeenCalledTimes(1);
    expect(trials.updateTrial).not.toHaveBeenCalled();
    expect(trials.updateTimeline).not.toHaveBeenCalled();
  });

  it("routes nested-loop creation to the expanded parent", async () => {
    const trials = createTrialsMock();
    const { result } = renderHook(() => useCanvasWorkspace());
    await activateParentScope(result);

    await act(async () => {
      await result.current.loopActions.handleAddLoop([10, 11]);
    });

    expect(trials.createLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        parentLoopId: "parent",
        trials: [10, 11],
      }),
    );
    expect(trials.updateLoop).not.toHaveBeenCalled();
    expect(trials.updateTimeline).not.toHaveBeenCalled();
  });

  it("routes move persistence to the expanded loop", async () => {
    const trials = createTrialsMock();
    const { result } = renderHook(() => useCanvasWorkspace());
    await activateParentScope(result);

    act(() => result.current.moveActions.onMoveItem(11));
    await act(async () => {
      await result.current.moveActions.handleMoveItemConfirm(10, true);
    });

    expect(trials.updateTrial).toHaveBeenCalledWith(10, { branches: [11] });
    expect(trials.updateLoop).toHaveBeenCalledWith("parent", { trials: [10] });
    expect(trials.updateTimeline).not.toHaveBeenCalled();
  });

  it("switches between already expanded scopes without fetching again", async () => {
    const trials = createTrialsMock();
    const { result } = renderHook(() => useCanvasWorkspace());
    await activateParentScope(result);

    await act(async () => {
      expect(await result.current.expanded.activateScope(null)).toBe(true);
      expect(await result.current.expanded.activateScope("parent")).toBe(true);
    });

    expect(trials.getLoopTimeline).toHaveBeenCalledTimes(1);
    expect(trials.activateLoopTimeline).toHaveBeenCalledWith(null);
    expect(trials.activateLoopTimeline).toHaveBeenLastCalledWith("parent");
  });

  it("synchronizes only the matching expanded loop cache entry", async () => {
    const trials = createTrialsMock();
    const view = renderHook(() => useCanvasWorkspace());
    await activateParentScope(view.result);
    const updatedItems = [
      { id: 10, type: "trial", name: "Updated task", branches: [] },
    ] satisfies TimelineItem[];

    trials.loopTimelineCache = {
      parent: { status: "ready", items: updatedItems, revision: 2 },
    };
    view.rerender();

    await waitFor(() => {
      expect(view.result.current.actionScope).toMatchObject({
        kind: "loop",
        loopId: "parent",
        items: updatedItems,
      });
    });
  });

  it("keeps flow input stable when selected form data is replaced", () => {
    const trials = createTrialsMock();
    trials.selectedTrial = makeTrial(10, {
      parameters: { stimulus: "before" },
    });
    const view = renderHook(() => useCanvasWorkspace());
    const firstFlowOptions = mocks.flowOptions;

    trials.selectedTrial = makeTrial(10, {
      parameters: { stimulus: "after" },
    });
    view.rerender();

    expect(mocks.flowOptions).toBe(firstFlowOptions);
  });

  it("ignores an older trial selection response after a newer selection", async () => {
    const trials = createTrialsMock();
    let resolveOld!: (trial: Trial) => void;
    const oldTrial = new Promise<Trial>((resolve) => {
      resolveOld = resolve;
    });
    trials.getTrial
      .mockImplementationOnce(() => oldTrial)
      .mockResolvedValueOnce(makeTrial(11));
    renderHook(() => useCanvasWorkspace());
    const selectTrial = mocks.flowOptions?.onSelectTrial as (
      item: TimelineItem,
    ) => Promise<void>;

    let oldSelection!: Promise<void>;
    act(() => {
      oldSelection = selectTrial(loopItems[0]);
    });
    await act(async () => {
      await selectTrial(loopItems[1]);
    });
    resolveOld(makeTrial(10));
    await act(async () => {
      await oldSelection;
    });

    expect(trials.setSelectedTrial).toHaveBeenLastCalledWith(makeTrial(11));
  });
});
