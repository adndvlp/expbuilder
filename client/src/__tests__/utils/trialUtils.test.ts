import { afterEach, describe, it, expect, vi } from "vitest";
import {
  isTrial,
  findTrialById,
  findLoopById,
  findItemById,
  generateUniqueName,
  getTrialIdsInLoops,
  getAllExistingNames,
  isAncestor,
  validateConnection,
} from "../../pages/ExperimentBuilder/components/Canvas/utils/trialUtils";

const mockTimeline = [
  { id: 1, type: "trial", name: "Trial A", branches: [2, 3] },
  { id: 2, type: "trial", name: "Trial B", branches: [4] },
  { id: 3, type: "trial", name: "Trial C", branches: [] },
  { id: 4, type: "trial", name: "Trial D", branches: [] },
  { id: "loop_1", type: "loop", name: "Loop 1", trials: [5, 6] },
  { id: 5, type: "trial", name: "Nested Trial 1", branches: [] },
  { id: 6, type: "trial", name: "Nested Trial 2", branches: [] },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isTrial", () => {
  it("returns true for objects without trials array", () => {
    expect(isTrial({ id: 1, type: "trial", name: "Test" })).toBe(true);
    expect(isTrial({ id: 1, name: "Test", branches: [] })).toBe(true);
  });

  it("returns false for objects with trials array", () => {
    expect(
      isTrial({ id: "loop_1", type: "loop", name: "Loop", trials: [] }),
    ).toBe(false);
  });
});

describe("findTrialById", () => {
  it("finds trial by numeric id", () => {
    const result = findTrialById(mockTimeline, 1);
    expect(result).toEqual({
      id: 1,
      type: "trial",
      name: "Trial A",
      branches: [2, 3],
    });
  });

  it("finds trial by string id", () => {
    const result = findTrialById(mockTimeline, "2");
    expect(result).toEqual({
      id: 2,
      type: "trial",
      name: "Trial B",
      branches: [4],
    });
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

  it("finds a loop by its actual identity", () => {
    const result = findItemById(mockTimeline, "loop_1");
    expect(result?.type).toBe("loop");
  });

  it("finds trial with string numeric id", () => {
    const result = findItemById(mockTimeline, "3");
    expect(result).toBeDefined();
  });

  it("resolves string trials and numeric loops without inferring type from IDs", () => {
    const timeline = [
      { id: "loop_trial", type: "trial" },
      { id: 7, type: "loop" },
      { id: "trial-string", type: "trial" },
    ];
    expect(findItemById(timeline, "loop_trial")?.type).toBe("trial");
    expect(findTrialById(timeline, "loop_trial")?.type).toBe("trial");
    expect(findTrialById(timeline, "trial-string")?.id).toBe("trial-string");
    expect(findItemById(timeline, "7")?.type).toBe("loop");
    expect(findLoopById(timeline, "7")?.id).toBe(7);
    expect(findTrialById(timeline, "7")).toBeNull();
  });

  it("returns null for non-existent item", () => {
    expect(findItemById(mockTimeline, 999)).toBeNull();
  });
});

describe("generateUniqueName", () => {
  it("returns base name when not taken", () => {
    expect(generateUniqueName(["Trial A", "Trial B"], "New Trial")).toBe(
      "New Trial",
    );
  });

  it("appends counter when name is taken", () => {
    expect(generateUniqueName(["New Trial"], "New Trial")).toBe("New Trial 1");
  });

  it("increments counter for multiple duplicates", () => {
    expect(
      generateUniqueName(
        ["New Trial", "New Trial 1", "New Trial 2"],
        "New Trial",
      ),
    ).toBe("New Trial 3");
  });

  it("uses default base name when not provided", () => {
    expect(generateUniqueName([], "New Trial")).toBe("New Trial");
  });

  it("handles empty existing names array", () => {
    expect(generateUniqueName([], "Custom Name")).toBe("Custom Name");
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
      { id: "loop_1", type: "loop", name: "L1", trials: [1, 2] },
      { id: "loop_2", type: "loop", name: "L2", trials: [3, 4] },
    ];
    expect(getTrialIdsInLoops(timeline)).toEqual([1, 2, 3, 4]);
  });

  it("ignores loops without a trials array", () => {
    const timeline = [{ id: "loop_1", type: "loop", name: "L1" }];
    expect(getTrialIdsInLoops(timeline)).toEqual([]);
  });
});

describe("trialUtils API helpers", () => {
  it("loads timeline names with fallback to an empty list", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        json: async () => ({ names: ["Trial A", "Loop B"] }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({}),
      } as Response);

    await expect(getAllExistingNames("exp-1")).resolves.toEqual([
      "Trial A",
      "Loop B",
    ]);
    await expect(getAllExistingNames("exp-2")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/timeline-names/exp-1"),
    );
  });

  it("returns false and logs when timeline-name and ancestor requests fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await expect(getAllExistingNames("exp-1")).resolves.toEqual([]);
    await expect(isAncestor(1, "loop_1", "exp-1")).resolves.toBe(false);

    expect(console.error).toHaveBeenCalledWith(
      "Error fetching timeline names:",
      expect.any(Error),
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error validating ancestor:",
      expect.any(Error),
    );
  });

  it("validates ancestor and connection responses from the backend", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        json: async () => ({ isAncestor: true }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ isValid: false, errorMessage: "Circular" }),
      } as Response);

    await expect(isAncestor(1, 2, "exp-1")).resolves.toBe(true);
    await expect(validateConnection(1, 2, "exp-1")).resolves.toEqual({
      isValid: false,
      errorMessage: "Circular",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/validate-ancestor/exp-1?source=1&target=2"),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        "/api/validate-connection/exp-1?source=1&target=2",
      ),
    );
  });

  it("defaults missing ancestor response flags to false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({}),
    } as Response);

    await expect(isAncestor(1, 2, "exp-1")).resolves.toBe(false);
  });

  it("returns invalid connection fallback when validation request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await expect(validateConnection(1, 2, "exp-1")).resolves.toEqual({
      isValid: false,
      errorMessage: "Error validating connection",
    });

    expect(console.error).toHaveBeenCalledWith(
      "Error validating connection:",
      expect.any(Error),
    );
  });
});
