import { updateItemBranches } from "../../../pages/ExperimentBuilder/components/Canvas/actions/itemMutations";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addScopedBranchTrial,
  addScopedParentTrial,
} from "../../../pages/ExperimentBuilder/components/Canvas/actions";
import {
  createDependencies,
  createLoopScope,
  createRootScope,
} from "./testHarness";

describe("scoped Canvas branch actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates root parent trials and persists the reordered root timeline", async () => {
    const dependencies = createDependencies();
    const onSelectTrial = vi.fn();

    await addScopedParentTrial({
      scope: createRootScope(),
      parentId: 1,
      dependencies,
      onSelectTrial,
    });

    expect(dependencies.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ branches: [2] }),
    );
    expect(dependencies.updateTrial).toHaveBeenCalledWith(1, expect.objectContaining({
      branches: [99],
    }));
    expect(dependencies.updateTimeline).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, branches: [99], defaultNextTrialId: 99 }),
      expect.objectContaining({ id: 99, branches: [2] }),
      expect.objectContaining({ id: 2 }),
      expect.objectContaining({ id: "parent-loop" }),
    ]);
    expect(onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99 }),
    );
  });

  it("creates loop branches in their owner scope without client-side resync", async () => {
    const dependencies = createDependencies();
    const onSelectTrial = vi.fn();

    await addScopedBranchTrial({
      scope: createLoopScope(),
      parentId: 10,
      dependencies,
      onSelectTrial,
    });

    expect(dependencies.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ parentLoopId: "parent-loop" }),
    );
    expect(dependencies.updateTrialField).not.toHaveBeenCalled();
    expect(dependencies.updateTrial).toHaveBeenCalledWith(10, expect.objectContaining({
      branches: [11, 99],
    }));
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
    expect(onSelectTrial).toHaveBeenCalled();
  });

  it("inserts a sequential parent inside the active loop without touching root", async () => {
    const dependencies = createDependencies();

    await addScopedParentTrial({
      scope: createLoopScope(),
      parentId: 10,
      dependencies,
    });

    expect(dependencies.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({
        parentLoopId: "parent-loop",
        branches: [11],
      }),
    );
    expect(dependencies.updateTrial).toHaveBeenCalledWith(10, expect.objectContaining({
      branches: [99],
    }));
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
  });

  it("rejects a loop branch source before creating a trial", async () => {
    const dependencies = createDependencies();
    const scope = createLoopScope();
    scope.items = [
      ...scope.items,
      { id: "child-loop", type: "loop", name: "Child loop" },
    ];

    await addScopedBranchTrial({
      scope,
      parentId: "child-loop",
      dependencies,
    });

    expect(dependencies.createTrial).not.toHaveBeenCalled();
    expect(dependencies.updateLoop).not.toHaveBeenCalled();
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
  });

  it("resolves parents across string/number id types", async () => {
    const dependencies = createDependencies();
    const onSelectTrial = vi.fn();

    await addScopedParentTrial({
      scope: createRootScope(),
      parentId: "1",
      dependencies,
      onSelectTrial,
    });

    expect(dependencies.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ branches: [2] }),
    );
    expect(dependencies.updateTrial).toHaveBeenCalledWith(1, expect.objectContaining({
      branches: [99],
    }));
    expect(dependencies.updateTimeline).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, branches: [99], defaultNextTrialId: 99 }),
      expect.objectContaining({ id: 99, branches: [2] }),
      expect.objectContaining({ id: 2 }),
      expect.objectContaining({ id: "parent-loop" }),
    ]);
    expect(onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99 }),
    );
  });
});

it("saves edited edges with only their still-connected conditions", async () => {
  const dependencies = createDependencies();
  const retained = { id: 1, rules: [], nextTrialId: 2, customParameters: { stimulus: { source: "typed" as const, value: "kept" } } };
  dependencies.getTrial.mockResolvedValue({ id: 1, branches: [2, 3], defaultNextTrialId: 3,
    branchConditions: [retained, { id: 2, rules: [], nextTrialId: 3 }] } as never);
  await updateItemBranches({ id: 1, type: "trial", name: "Source" }, [2], dependencies);
  expect(dependencies.updateTrial).toHaveBeenCalledWith(1, {
    branches: [2], defaultNextTrialId: 2, branchConditions: [retained],
  });
});
