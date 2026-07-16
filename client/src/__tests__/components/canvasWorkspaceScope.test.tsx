import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Loop,
  Trial,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import { useCanvasWorkspace } from "../../pages/ExperimentBuilder/components/Canvas/hooks/useCanvasWorkspace";
import type { TimelineItem } from "../../pages/ExperimentBuilder/contexts/TrialsContext";

const mocks = vi.hoisted(() => ({
  trials: {} as Record<string, unknown>,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trials,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/hooks/useFlowLayout",
  () => ({ useFlowLayout: () => ({ nodes: [], edges: [] }) }),
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
  beforeEach(() => vi.clearAllMocks());

  it("routes branch creation to the expanded loop", async () => {
    const trials = createTrialsMock();
    const { result } = renderHook(() => useCanvasWorkspace());
    await activateParentScope(result);

    await act(async () => {
      await result.current.branchActions.onAddBranch(10);
    });

    expect(trials.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ parentLoopId: "parent" }),
    );
    expect(trials.updateTrial).toHaveBeenCalledWith(
      10,
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
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
    expect(trials.updateLoop).toHaveBeenCalledWith("parent", {
      trials: ["nested-created"],
    });
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
});
