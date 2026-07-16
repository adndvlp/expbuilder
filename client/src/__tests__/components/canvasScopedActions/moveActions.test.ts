import { beforeEach, describe, expect, it, vi } from "vitest";
import { moveScopedItem } from "../../../pages/ExperimentBuilder/components/Canvas/actions";
import {
  createDependencies,
  createLoopScope,
  createRootScope,
} from "./testHarness";

describe("scoped Canvas move actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reorders root items through updateTimeline", async () => {
    const dependencies = createDependencies();

    const result = await moveScopedItem({
      scope: createRootScope(),
      item: { id: 2, type: "trial", name: "End" },
      destinationId: 1,
      addAsBranch: true,
      dependencies,
    });

    expect(result).toEqual({ status: "moved" });
    expect(dependencies.updateTimeline).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 }),
      expect.objectContaining({ id: "parent-loop" }),
    ]);
  });

  it("moves loop items by updating parent loop direct children and refreshing", async () => {
    const dependencies = createDependencies();
    const refresh = vi.fn();

    const result = await moveScopedItem({
      scope: createLoopScope(refresh),
      item: { id: 11, type: "trial", name: "Loca" },
      destinationId: 10,
      addAsBranch: true,
      dependencies,
    });

    expect(result).toEqual({ status: "moved" });
    expect(dependencies.updateTrial).toHaveBeenCalledWith(10, {
      branches: [11],
    });
    expect(dependencies.updateLoop).toHaveBeenCalledWith("parent-loop", {
      trials: [10],
    });
    expect(dependencies.updateTrial).toHaveBeenCalledWith(11, {
      parentLoopId: "parent-loop",
    });
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("returns a discriminated failure when the destination is outside the scope", async () => {
    const dependencies = createDependencies();

    const result = await moveScopedItem({
      scope: createRootScope(),
      item: { id: 2, type: "trial", name: "End" },
      destinationId: "missing",
      addAsBranch: false,
      dependencies,
    });

    expect(result).toEqual({ status: "destination-not-found" });
    expect(dependencies.updateTimeline).not.toHaveBeenCalled();
  });
});
