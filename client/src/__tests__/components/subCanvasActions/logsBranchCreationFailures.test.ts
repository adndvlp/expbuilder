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
      getTrial: vi.fn(
        async () =>
          ({
            id: 10,
            name: "Loop Start",
            branches: undefined,
          }) as unknown as Trial,
      ),
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
});
