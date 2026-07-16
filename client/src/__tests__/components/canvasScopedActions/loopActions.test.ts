import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createScopedLoop,
  createScopedTrial,
} from "../../../pages/ExperimentBuilder/components/Canvas/actions";
import {
  createDependencies,
  createLoopScope,
  createRootScope,
} from "./testHarness";

describe("scoped Canvas loop actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates nested loops and replaces selected direct children in the parent", async () => {
    const dependencies = createDependencies();
    const refresh = vi.fn();
    const onSelectLoop = vi.fn();

    await createScopedLoop({
      scope: createLoopScope(refresh),
      itemIds: [10, 11],
      dependencies,
      onSelectLoop,
    });

    expect(dependencies.createLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Nested Loop 1",
        trials: [10, 11],
        parentLoopId: "parent-loop",
      }),
    );
    expect(dependencies.updateLoop).toHaveBeenCalledWith("parent-loop", {
      trials: ["nested-loop"],
    });
    expect(onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "nested-loop" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("adds a direct trial to a loop without updating the root timeline", async () => {
    const dependencies = createDependencies();
    const refresh = vi.fn();

    await createScopedTrial({
      scope: createLoopScope(refresh),
      trialType: "Trial",
      dependencies,
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
    expect(dependencies.updateLoop).toHaveBeenCalledWith("parent-loop", {
      trials: [10, 11, 99],
    });
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps root trial creation on updateTimeline", async () => {
    const dependencies = createDependencies();

    await createScopedTrial({
      scope: createRootScope(),
      trialType: "Trial",
      dependencies,
    });

    expect(dependencies.createTrial).toHaveBeenCalledWith(
      expect.not.objectContaining({ parentLoopId: expect.anything() }),
    );
    expect(dependencies.updateTimeline).toHaveBeenCalledWith([
      ...createRootScope().items,
      expect.objectContaining({ id: 99, type: "trial" }),
    ]);
  });
});
