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
    expect(dependencies.updateTrial).toHaveBeenCalledWith(
      1,
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
    expect(dependencies.updateTimeline).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, branches: [99] }),
      expect.objectContaining({ id: 99, branches: [2] }),
      expect.objectContaining({ id: 2 }),
      expect.objectContaining({ id: "parent-loop" }),
    ]);
    expect(onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99 }),
    );
  });

  it("creates loop branches with parentLoopId, inherited CSV, and refresh", async () => {
    const dependencies = createDependencies();
    const refresh = vi.fn();
    const onSelectTrial = vi.fn();

    await addScopedBranchTrial({
      scope: createLoopScope(refresh),
      parentId: 10,
      dependencies,
      onSelectTrial,
    });

    expect(dependencies.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ parentLoopId: "parent-loop" }),
    );
    expect(dependencies.updateTrialField).toHaveBeenCalledWith(
      99,
      "csvFromLoop",
      true,
      false,
    );
    expect(dependencies.updateTrial).toHaveBeenCalledWith(
      10,
      { branches: [11, 99] },
      expect.objectContaining({ id: 99 }),
    );
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
    expect(onSelectTrial).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("inserts a sequential parent inside the active loop without touching root", async () => {
    const dependencies = createDependencies();
    const refresh = vi.fn();

    await addScopedParentTrial({
      scope: createLoopScope(refresh),
      parentId: 10,
      dependencies,
    });

    expect(dependencies.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({
        parentLoopId: "parent-loop",
        branches: [11],
      }),
    );
    expect(dependencies.updateTrial).toHaveBeenCalledWith(
      10,
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("adds a branch to a child loop within the active scope", async () => {
    const dependencies = createDependencies();
    const refresh = vi.fn();
    const scope = createLoopScope(refresh);
    scope.items = [
      ...scope.items,
      { id: "child-loop", type: "loop", name: "Child loop", branches: [11] },
    ];

    await addScopedBranchTrial({
      scope,
      parentId: "child-loop",
      dependencies,
    });

    expect(dependencies.updateLoop).toHaveBeenCalledWith(
      "child-loop",
      { branches: [11, 99] },
      expect.objectContaining({ id: 99 }),
    );
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
