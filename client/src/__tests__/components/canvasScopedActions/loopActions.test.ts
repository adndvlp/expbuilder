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
    const onSelectLoop = vi.fn();

    await createScopedLoop({
      scope: createLoopScope(),
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
    expect(dependencies.updateLoop).not.toHaveBeenCalled();
    expect(onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "nested-loop" }),
    );
  });

  it("adds a direct trial to a loop without updating the root timeline", async () => {
    const dependencies = createDependencies();

    await createScopedTrial({
      scope: createLoopScope(),
      trialType: "Trial",
      dependencies,
    });

    expect(dependencies.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ parentLoopId: "parent-loop" }),
    );
    expect(dependencies.updateTrialField).not.toHaveBeenCalled();
    expect(dependencies.updateLoop).not.toHaveBeenCalled();
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
  });

  it("lets the create endpoint own root trial insertion", async () => {
    const dependencies = createDependencies();

    await createScopedTrial({
      scope: createRootScope(),
      trialType: "Trial",
      dependencies,
    });

    expect(dependencies.createTrial).toHaveBeenCalledWith(
      expect.not.objectContaining({ parentLoopId: expect.anything() }),
    );
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
  });
});
