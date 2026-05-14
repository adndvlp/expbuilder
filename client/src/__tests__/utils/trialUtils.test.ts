import { describe, it, expect } from "vitest";
import {
  isTrial,
  findTrialById,
  findLoopById,
  findItemById,
  generateUniqueName,
  collectAllBranchIds,
  getTrialIdsInLoops,
} from "../../pages/ExperimentBuilder/components/Canvas/utils/trialUtils";

const mockTimeline = [
  { id: 1, type: "trial", name: "Trial A", branches: [2, 3] },
  { id: 2, type: "trial", name: "Trial B", branches: [4] },
  { id: 3, type: "trial", name: "Trial C", branches: [] },
  { id: 4, type: "trial", name: "Trial D", branches: [] },
  { id: "loop_1", type: "loop", name: "Loop 1", trials: [5, 6], branches: [] },
  { id: 5, type: "trial", name: "Nested Trial 1", branches: [] },
  { id: 6, type: "trial", name: "Nested Trial 2", branches: [] },
];

describe("isTrial", () => {
  it("returns true for objects without trials array", () => {
    expect(isTrial({ id: 1, type: "trial", name: "Test" })).toBe(true);
    expect(isTrial({ id: 1, name: "Test", branches: [] })).toBe(true);
  });

  it("returns false for objects with trials array", () => {
    expect(isTrial({ id: "loop_1", type: "loop", name: "Loop", trials: [] })).toBe(false);
  });
});

describe("findTrialById", () => {
  it("finds trial by numeric id", () => {
    const result = findTrialById(mockTimeline, 1);
    expect(result).toEqual({ id: 1, type: "trial", name: "Trial A", branches: [2, 3] });
  });

  it("finds trial by string id", () => {
    const result = findTrialById(mockTimeline, "2");
    expect(result).toEqual({ id: 2, type: "trial", name: "Trial B", branches: [4] });
  });

  it("returns null for non-existent trial", () => {
    expect(findTrialById(mockTimeline, 999)).toBeNull();
    expect(findTrialById(mockTimeline, "999")).toBeNull();
  });

  it("does not return loops", () => {
    expect(findTrialById(mockTimeline, "loop_1")).toBeNull();
  });
});

describe("findLoopById", () => {
  it("finds loop by id", () => {
    const result = findLoopById(mockTimeline, "loop_1");
    expect(result).toBeDefined();
    expect(result.type).toBe("loop");
  });

  it("returns null for non-existent loop", () => {
    expect(findLoopById(mockTimeline, "nonexistent")).toBeNull();
  });
});

describe("findItemById", () => {
  it("finds trial by numeric id", () => {
    const result = findItemById(mockTimeline, 1);
    expect(result?.type).toBe("trial");
  });

  it("finds loop by loop_ prefix", () => {
    const result = findItemById(mockTimeline, "loop_1");
    expect(result?.type).toBe("loop");
  });

  it("finds trial with string numeric id", () => {
    const result = findItemById(mockTimeline, "3");
    expect(result).toBeDefined();
  });

  it("returns null for non-existent item", () => {
    expect(findItemById(mockTimeline, 999)).toBeNull();
  });
});

describe("generateUniqueName", () => {
  it("returns base name when not taken", () => {
    expect(generateUniqueName(["Trial A", "Trial B"], "New Trial")).toBe("New Trial");
  });

  it("appends counter when name is taken", () => {
    expect(generateUniqueName(["New Trial"], "New Trial")).toBe("New Trial 1");
  });

  it("increments counter for multiple duplicates", () => {
    expect(generateUniqueName(["New Trial", "New Trial 1", "New Trial 2"], "New Trial")).toBe("New Trial 3");
  });

  it("uses default base name when not provided", () => {
    expect(generateUniqueName([], "New Trial")).toBe("New Trial");
  });

  it("handles empty existing names array", () => {
    expect(generateUniqueName([], "Custom Name")).toBe("Custom Name");
  });
});

describe("collectAllBranchIds", () => {
  it("collects all branch ids from the timeline", () => {
    const result = collectAllBranchIds(mockTimeline);
    expect(result.has(2)).toBe(true);
    expect(result.has(3)).toBe(true);
    expect(result.has(4)).toBe(true);
  });

  it("collects nested branch ids recursively", () => {
    // Trial A -> [2, 3], Trial B -> [4]
    const result = collectAllBranchIds(mockTimeline);
    expect(result.size).toBeGreaterThanOrEqual(3);
  });

  it("returns empty set for timeline without branches", () => {
    const simpleTimeline = [{ id: 1, type: "trial", name: "Solo", branches: [] }];
    const result = collectAllBranchIds(simpleTimeline);
    expect(result.size).toBe(0);
  });

  it("handles empty timeline", () => {
    const result = collectAllBranchIds([]);
    expect(result.size).toBe(0);
  });

  it("skips items without branches property", () => {
    const timeline = [{ id: 1, type: "trial", name: "No branches property" }];
    const result = collectAllBranchIds(timeline);
    expect(result.size).toBe(0);
  });
});

describe("getTrialIdsInLoops", () => {
  it("returns trial IDs from all loops", () => {
    const result = getTrialIdsInLoops(mockTimeline);
    expect(result).toContain(5);
    expect(result).toContain(6);
  });

  it("returns empty array for timeline without loops", () => {
    const simpleTimeline = [{ id: 1, type: "trial", name: "Only trial" }];
    expect(getTrialIdsInLoops(simpleTimeline)).toEqual([]);
  });

  it("handles empty timeline", () => {
    expect(getTrialIdsInLoops([])).toEqual([]);
  });

  it("flattens multiple loops", () => {
    const timeline = [
      { id: "loop_1", type: "loop", name: "L1", trials: [1, 2], branches: [] },
      { id: "loop_2", type: "loop", name: "L2", trials: [3, 4], branches: [] },
    ];
    expect(getTrialIdsInLoops(timeline)).toEqual([1, 2, 3, 4]);
  });
});
