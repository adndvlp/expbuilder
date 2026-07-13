import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createActions,
  setupActionsTest,
  type Loop,
  type Trial,
} from "./testHarness";

describe("SubCanvas Actions", () => {
  beforeEach(setupActionsTest);

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
      getLoop: vi.fn(
        async () =>
          ({
            id: "loop_parent",
            name: "Parent Loop",
            trials: [10, 11],
            csvJson: [],
          }) as Loop,
      ),
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
      getTrial: vi.fn(
        async () =>
          ({
            id: 10,
            name: "Loop Start",
            branches: undefined,
          }) as unknown as Trial,
      ),
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
});
