import { beforeEach, describe, expect, it, vi } from "vitest";
import { moveScopedItem } from "../../../pages/ExperimentBuilder/components/Canvas/actions";
import {
  createDependencies,
  createLoopScope,
  createRootScope,
  makeTrial,
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

  it("moves loop items through canonical mutation responses", async () => {
    const dependencies = createDependencies();

    const result = await moveScopedItem({
      scope: createLoopScope(),
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
  });

  it("keeps a branchless root move in implicit sequential order", async () => {
    const dependencies = createDependencies();
    dependencies.getTrial.mockImplementation(async (id) =>
      typeof id === "number" ? makeTrial(id) : null,
    );
    const scope = createRootScope();
    scope.items = scope.items.map((item) => ({ ...item, branches: [] }));

    const result = await moveScopedItem({
      scope,
      item: { id: 2, type: "trial", name: "End" },
      destinationId: 1,
      addAsBranch: false,
      dependencies,
    });

    expect(result).toEqual({ status: "moved" });
    expect(dependencies.updateTrial).toHaveBeenCalledWith(2, { branches: [] });
    expect(dependencies.updateTrial).not.toHaveBeenCalledWith(1, {
      branches: [2],
    });
    expect(dependencies.updateTimeline).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 }),
      expect.objectContaining({ id: "parent-loop" }),
    ]);
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
