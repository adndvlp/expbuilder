import { describe, expect, it } from "vitest";
import {
  appendUniqueId,
  collectBranchIds,
  findGraphItem,
  getIncomingParentMap,
  getMergePointIds,
  getNextSequentialItem,
  idsEqual,
  includesId,
  isForwardSameScopeTarget,
  isMergePoint,
  itemIdKey,
  reachesItem,
  removeId,
} from "../../pages/ExperimentBuilder/utils/branchGraphUtils";

const graph = [
  { id: 1, name: "Start", branches: [2, "merge"] },
  { id: "2", name: "Branch", branches: ["merge"] },
  { id: "merge", name: "Merge", branches: ["end"] },
  { id: "end", name: "End", branches: [] },
  { id: "loop", name: "Loop", branches: ["2"] },
];

describe("branchGraphUtils", () => {
  it("normalizes ids for equality and collection helpers", () => {
    expect(idsEqual(1, "1")).toBe(true);
    expect(idsEqual(null, "1")).toBe(false);
    expect(idsEqual(undefined, "1")).toBe(false);
    expect(itemIdKey(2)).toBe("2");
    expect(findGraphItem(graph, "1")?.name).toBe("Start");
    expect(includesId([1, "2"], 2)).toBe(true);
    expect(includesId(undefined, 2)).toBe(false);
  });

  it("appends and removes ids without duplicating normalized matches", () => {
    const existing = [1, 2];
    expect(appendUniqueId(existing, 2)).toBe(existing);
    expect(appendUniqueId(existing, 3)).toEqual([1, 2, 3]);
    expect(appendUniqueId(undefined, "first")).toEqual(["first"]);
    expect(removeId([1, "2", 3], 2)).toEqual([1, 3]);
    expect(removeId(undefined, 2)).toEqual([]);
  });

  it("builds parent maps and identifies merge points", () => {
    const parents = getIncomingParentMap(graph);
    expect(parents.get("merge")).toEqual([1, "2"]);
    expect(parents.get("2")).toEqual([1, "loop"]);

    const mergeIds = getMergePointIds(graph);
    expect(mergeIds).toEqual(new Set(["2", "merge"]));
    expect(isMergePoint(mergeIds, 2)).toBe(true);
    expect(isMergePoint(mergeIds, "end")).toBe(false);
    expect(collectBranchIds(graph)).toEqual(new Set(["2", "merge", "end"]));
  });

  it("ignores missing branch lists and duplicate normalized parent edges", () => {
    const sparseGraph = [
      { id: "parent", branches: [2, "2"] },
      { id: "without-branches" },
    ];

    expect(getIncomingParentMap(sparseGraph).get("2")).toEqual(["parent"]);
    expect(collectBranchIds(sparseGraph)).toEqual(new Set(["2"]));
  });

  it("finds the next sequential item while honoring exclusions", () => {
    expect(getNextSequentialItem(graph, 1)?.id).toBe("2");
    expect(getNextSequentialItem(graph, 1, new Set(["2"]))?.id).toBe("merge");
    expect(getNextSequentialItem(graph, "missing")).toBeUndefined();
    expect(getNextSequentialItem(graph, "loop")).toBeUndefined();
  });

  it("checks recursive reachability without looping forever", () => {
    expect(reachesItem(graph, 1, "merge")).toBe(true);
    expect(reachesItem(graph, 1, "end")).toBe(true);
    expect(reachesItem(graph, "end", 1)).toBe(false);
    expect(reachesItem(graph, "missing", "end")).toBe(false);

    const cyclicGraph = [
      { id: "a", branches: ["b"] },
      { id: "b", branches: ["a"] },
    ];
    expect(reachesItem(cyclicGraph, "a", "z")).toBe(false);
  });

  it("detects forward targets in the same ordered scope", () => {
    expect(isForwardSameScopeTarget(graph, 1, "merge")).toBe(true);
    expect(isForwardSameScopeTarget(graph, "merge", 1)).toBe(false);
    expect(isForwardSameScopeTarget(graph, "missing", 1)).toBe(false);
    expect(isForwardSameScopeTarget(graph, 1, "missing")).toBe(false);
  });
});
