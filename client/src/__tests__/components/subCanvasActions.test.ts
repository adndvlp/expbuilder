import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Actions from "../../pages/ExperimentBuilder/components/Canvas/SubCanvas/Actions";
import type { Loop, Trial } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { TimelineItem } from "../../pages/ExperimentBuilder/contexts/TrialsContext";

const timeline: TimelineItem[] = [
  { id: 1, type: "trial", name: "New Trial", branches: [] },
  { id: "loop_parent", type: "loop", name: "Parent Loop", branches: [], trials: [10, 11] },
];

const loopTimeline: TimelineItem[] = [
  { id: 10, type: "trial", name: "Loop Start", branches: [11] },
  { id: 11, type: "trial", name: "Loop Branch", branches: [] },
  { id: "loop_child", type: "loop", name: "Child Loop", branches: [], trials: [12] },
];

function createActions(overrides: Partial<Parameters<typeof Actions>[0]> = {}) {
  const newTrial = {
    id: 99,
    type: "Trial",
    name: "New Trial 1",
    plugin: "plugin-dynamic",
    parameters: {},
    trialCode: "",
    parentLoopId: "loop_parent",
    branches: [],
  } as Trial;
  const newLoop = {
    id: "loop_nested",
    name: "Nested Loop 1",
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    orderColumns: [],
    categories: false,
    categoryColumn: "",
    categoryData: [],
    trials: [10, 11],
    code: "",
    parentLoopId: "loop_parent",
  } as Loop;
  const parentTrial = {
    id: 10,
    type: "Trial",
    name: "Loop Start",
    plugin: "plugin-dynamic",
    parameters: {},
    trialCode: "",
    branches: [11],
  } as Trial;
  const parentLoop = {
    id: "loop_parent",
    name: "Parent Loop",
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    orderColumns: [],
    categories: false,
    categoryColumn: "",
    categoryData: [],
    trials: [10, 11, "loop_child"],
    code: "",
    csvJson: [{ stimulus: "a.png" }],
  } as Loop;

  const props = {
    onSelectTrial: vi.fn(),
    onSelectLoop: vi.fn(),
    onRefreshMetadata: vi.fn(),
    loopTimeline,
    getTrial: vi.fn(async (id: string | number) =>
      id === 10 ? parentTrial : null,
    ),
    getLoop: vi.fn(async (id: string | number) =>
      id === "loop_parent" ? parentLoop : null,
    ),
    timeline,
    createTrial: vi.fn(async (trial: Omit<Trial, "id">) => ({
      ...newTrial,
      ...trial,
      id: newTrial.id,
    })),
    updateLoop: vi.fn(async (id: string | number, loop: Partial<Loop>) => ({
      ...parentLoop,
      id,
      ...loop,
    })),
    updateTrial: vi.fn(async (id: string | number, trial: Partial<Trial>) => ({
      ...parentTrial,
      id: Number(id),
      ...trial,
    })),
    updateTrialField: vi.fn(async () => true),
    loopId: "loop_parent",
    setShowLoopModal: vi.fn(),
    createLoop: vi.fn(async (loop: Omit<Loop, "id">) => ({
      ...newLoop,
      ...loop,
      id: newLoop.id,
    })),
    updateTimeline: vi.fn(async () => true),
    ...overrides,
  };

  return { props, api: Actions(props) };
}

describe("SubCanvas Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a branch trial inside the active loop and propagates CSV-from-loop state", async () => {
    const { props, api } = createActions();

    await api.addTrialAsBranch(10);

    expect(props.createTrial).toHaveBeenCalledWith({
      type: "Trial",
      name: "New Trial 1",
      plugin: "plugin-dynamic",
      parameters: {},
      trialCode: "",
      parentLoopId: "loop_parent",
    });
    expect(props.updateTrialField).toHaveBeenCalledWith(
      99,
      "csvFromLoop",
      true,
      false,
    );
    expect(props.updateTrial).toHaveBeenCalledWith(
      10,
      { branches: [11, 99] },
      expect.objectContaining({ id: 99, name: "New Trial 1" }),
    );
    expect(props.onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, parentLoopId: "loop_parent" }),
    );
  });

  it("returns the requested parent id for branch handling decisions", async () => {
    const { api } = createActions();

    await expect(api.onAddBranch(10)).resolves.toBe(10);
    await expect(api.onAddBranch("missing-parent")).resolves.toBe(
      "missing-parent",
    );
  });

  it("adds a branch trial to a loop parent inside the active loop", async () => {
    const childLoop = {
      id: "loop_child",
      name: "Child Loop",
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      orderColumns: [],
      categories: false,
      categoryColumn: "",
      categoryData: [],
      trials: [12],
      branches: [10],
      code: "",
      parentLoopId: "loop_parent",
    } as Loop;
    const { props, api } = createActions({
      getLoop: vi.fn(async (id: string | number) => {
        if (id === "loop_parent") {
          return {
            id: "loop_parent",
            name: "Parent Loop",
            trials: [10, 11, "loop_child"],
            csvJson: [{ stimulus: "a.png" }],
          } as Loop;
        }
        if (id === "loop_child") return childLoop;
        return null;
      }),
    });

    await api.addTrialAsBranch("loop_child");

    expect(props.updateLoop).toHaveBeenCalledWith(
      "loop_child",
      { branches: [10, 99] },
      expect.objectContaining({ id: 99 }),
    );
    expect(props.onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, parentLoopId: "loop_parent" }),
    );
  });

  it("does not select a branch trial when the requested parent is missing", async () => {
    const { props, api } = createActions();

    await api.addTrialAsBranch("missing-parent");

    expect(props.createTrial).toHaveBeenCalled();
    expect(props.updateTrial).not.toHaveBeenCalled();
    expect(props.updateLoop).not.toHaveBeenCalled();
    expect(props.onSelectTrial).not.toHaveBeenCalled();
  });

  it("creates a branch without CSV propagation when trial metadata is missing", async () => {
    const { props, api } = createActions({
      getTrial: vi.fn(async () => null),
      getLoop: vi.fn(async () => ({
        id: "loop_parent",
        name: "Parent Loop",
        trials: [10, 11],
        csvJson: [],
      }) as Loop),
    });

    await api.addTrialAsBranch(10);

    expect(props.updateTrialField).not.toHaveBeenCalled();
    expect(props.updateTrial).not.toHaveBeenCalled();
    expect(props.onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99 }),
    );
  });

  it("uses an empty branch list when adding to a trial without branches", async () => {
    const { props, api } = createActions({
      getTrial: vi.fn(async () => ({
        id: 10,
        name: "Loop Start",
        branches: undefined,
      }) as unknown as Trial),
    });

    await api.addTrialAsBranch(10);

    expect(props.updateTrial).toHaveBeenCalledWith(
      10,
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
  });

  it("handles loop branch parents with absent metadata or branches", async () => {
    const childWithoutBranches = {
      id: "loop_child",
      name: "Child Loop",
      trials: [12],
      branches: undefined,
      parentLoopId: "loop_parent",
    } as unknown as Loop;
    const parentLoop = {
      id: "loop_parent",
      name: "Parent Loop",
      trials: [10, 11, "loop_child"],
      csvJson: [],
    } as Loop;
    const withBranchesFallback = createActions({
      getLoop: vi.fn(async (id: string | number) =>
        id === "loop_parent" ? parentLoop : childWithoutBranches,
      ),
    });

    await withBranchesFallback.api.addTrialAsBranch("loop_child");
    expect(withBranchesFallback.props.updateLoop).toHaveBeenCalledWith(
      "loop_child",
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );

    const missingChild = createActions({
      getLoop: vi.fn(async (id: string | number) =>
        id === "loop_parent" ? parentLoop : null,
      ),
    });
    await missingChild.api.addTrialAsBranch("loop_child");

    expect(missingChild.props.updateLoop).not.toHaveBeenCalled();
    expect(missingChild.props.onSelectTrial).toHaveBeenCalled();
  });

  it("logs branch creation failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { props, api } = createActions({
      createTrial: vi.fn(async () => {
        throw new Error("trial create failed");
      }),
    });

    await api.addTrialAsBranch(10);

    expect(console.error).toHaveBeenCalledWith(
      "Error adding branch:",
      expect.any(Error),
    );
    expect(props.onSelectTrial).not.toHaveBeenCalled();
  });

  it("inserts a new trial as parent of existing branches without touching the root timeline", async () => {
    const { props, api } = createActions();

    await api.addTrialAsParent(10);

    expect(props.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Trial 1",
        parentLoopId: "loop_parent",
        branches: [11],
      }),
    );
    expect(props.updateTrial).toHaveBeenCalledWith(
      10,
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
    expect(props.updateTimeline).not.toHaveBeenCalled();
    expect(props.onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, branches: [11] }),
    );
  });

  it("inserts a new trial as parent of existing loop branches without csv propagation", async () => {
    const childLoop = {
      id: "loop_child",
      name: "Child Loop",
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      orderColumns: [],
      categories: false,
      categoryColumn: "",
      categoryData: [],
      trials: [12],
      branches: [10],
      code: "",
      parentLoopId: "loop_parent",
    } as Loop;
    const { props, api } = createActions({
      getLoop: vi.fn(async (id: string | number) => {
        if (id === "loop_parent") {
          return {
            id: "loop_parent",
            name: "Parent Loop",
            trials: [10, 11, "loop_child"],
            csvJson: [],
          } as Loop;
        }
        if (id === "loop_child") return childLoop;
        return null;
      }),
    });

    await api.addTrialAsParent("loop_child");

    expect(props.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({
        branches: [10],
        parentLoopId: "loop_parent",
      }),
    );
    expect(props.updateLoop).toHaveBeenCalledWith(
      "loop_child",
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
    expect(props.updateTrialField).not.toHaveBeenCalled();
    expect(props.updateTimeline).not.toHaveBeenCalled();
  });

  it("does not create a parent trial when the requested parent is missing", async () => {
    const { props, api } = createActions();

    await api.addTrialAsParent("missing-parent");

    expect(props.createTrial).not.toHaveBeenCalled();
    expect(props.onSelectTrial).not.toHaveBeenCalled();
  });

  it("uses empty branches for parent trials with missing metadata or branch arrays", async () => {
    const withoutBranches = createActions({
      getTrial: vi.fn(async () => ({
        id: 10,
        name: "Loop Start",
        branches: undefined,
      }) as unknown as Trial),
    });
    await withoutBranches.api.addTrialAsParent(10);
    expect(withoutBranches.props.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ branches: [] }),
    );

    const missingTrial = createActions({ getTrial: vi.fn(async () => null) });
    await missingTrial.api.addTrialAsParent(10);
    expect(missingTrial.props.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ branches: [] }),
    );
    expect(missingTrial.props.updateTrial).toHaveBeenCalledWith(
      10,
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
  });

  it("uses empty branches for loop parents with missing metadata or branch arrays", async () => {
    const parentLoop = {
      id: "loop_parent",
      name: "Parent Loop",
      trials: [10, 11, "loop_child"],
      csvJson: [],
    } as Loop;
    const childWithoutBranches = {
      id: "loop_child",
      name: "Child Loop",
      trials: [12],
      branches: undefined,
    } as unknown as Loop;
    const withoutBranches = createActions({
      getLoop: vi.fn(async (id: string | number) =>
        id === "loop_parent" ? parentLoop : childWithoutBranches,
      ),
    });
    await withoutBranches.api.addTrialAsParent("loop_child");
    expect(withoutBranches.props.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ branches: [] }),
    );

    const missingChild = createActions({
      getLoop: vi.fn(async (id: string | number) =>
        id === "loop_parent" ? parentLoop : null,
      ),
    });
    await missingChild.api.addTrialAsParent("loop_child");
    expect(missingChild.props.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ branches: [] }),
    );
    expect(missingChild.props.updateLoop).toHaveBeenCalledWith(
      "loop_child",
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
  });

  it("logs add-parent failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { props, api } = createActions({
      createTrial: vi.fn(async () => {
        throw new Error("parent create failed");
      }),
    });

    await api.addTrialAsParent(10);

    expect(console.error).toHaveBeenCalledWith(
      "Error adding trial as parent:",
      expect.any(Error),
    );
    expect(props.onSelectTrial).not.toHaveBeenCalled();
  });

  it("creates a nested loop from selected loop timeline items", async () => {
    const { props, api } = createActions();

    await api.handleAddLoop([10, 11]);

    expect(props.createLoop).toHaveBeenCalledWith({
      name: "Nested Loop 1",
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      orderColumns: [],
      categoryColumn: "",
      categories: false,
      categoryData: [],
      trials: [10, 11],
      code: "",
      parentLoopId: "loop_parent",
    });
    expect(props.updateLoop).toHaveBeenCalledWith("loop_parent", {
      trials: ["loop_child", "loop_nested"],
    });
    expect(props.onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop_nested", parentLoopId: "loop_parent" }),
    );
    expect(props.setShowLoopModal).toHaveBeenCalledWith(false);
    expect(props.onRefreshMetadata).toHaveBeenCalled();
  });

  it("creates nested loops without requiring a refresh callback", async () => {
    const { props, api } = createActions({ onRefreshMetadata: undefined });

    await api.handleAddLoop([10]);

    expect(props.createLoop).toHaveBeenCalledWith(
      expect.objectContaining({ trials: [10], parentLoopId: "loop_parent" }),
    );
    expect(props.onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop_nested" }),
    );
    expect(props.setShowLoopModal).toHaveBeenCalledWith(false);
  });

  it("adds a nested loop when the parent has no trials array", async () => {
    const { props, api } = createActions({
      getLoop: vi.fn(async () => ({
        id: "loop_parent",
        name: "Parent Loop",
        trials: undefined,
      }) as unknown as Loop),
    });

    await api.handleAddLoop([10]);

    expect(props.updateLoop).toHaveBeenCalledWith("loop_parent", {
      trials: ["loop_nested"],
    });
  });

  it("logs and closes the modal when nested loop creation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { props, api } = createActions({
      createLoop: vi.fn(async () => {
        throw new Error("create failed");
      }),
    });

    await api.handleAddLoop([10]);

    expect(console.error).toHaveBeenCalledWith(
      "Error creating nested loop:",
      expect.any(Error),
    );
    expect(props.setShowLoopModal).toHaveBeenCalledWith(false);
    expect(props.onSelectLoop).not.toHaveBeenCalled();
  });

  it("does not create a nested loop when the parent loop cannot be loaded", async () => {
    const { props, api } = createActions({
      getLoop: vi.fn(async () => null),
    });

    await api.handleAddLoop([10]);

    expect(props.createLoop).not.toHaveBeenCalled();
    expect(props.onSelectLoop).not.toHaveBeenCalled();
  });

  it("guards nested loop creation when no items are selected or confirmation is cancelled", async () => {
    const { props, api } = createActions();

    await api.handleAddLoop([]);

    expect(window.alert).toHaveBeenCalledWith(
      "You must select at least 1 trial/loop to create a loop.",
    );
    expect(props.setShowLoopModal).toHaveBeenCalledWith(false);
    expect(props.createLoop).not.toHaveBeenCalled();

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    api.handleCreateNestedLoop();

    expect(props.setShowLoopModal).toHaveBeenCalledTimes(1);

    vi.mocked(window.confirm).mockReturnValueOnce(true);
    api.handleCreateNestedLoop();

    expect(props.setShowLoopModal).toHaveBeenLastCalledWith(true);
  });
});
