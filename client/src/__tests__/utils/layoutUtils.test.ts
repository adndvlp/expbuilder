import { describe, it, expect } from "vitest";
import {
  LAYOUT_CONSTANTS,
  alignMergePointNodes,
  calculateBranchWidth,
  createTrialNode,
  createLoopNode,
  createEdge,
} from "../../pages/ExperimentBuilder/components/Canvas/utils/layoutUtils";
import type { LayoutNode } from "../../pages/ExperimentBuilder/components/Canvas/utils/layoutUtils";

const mockTrials = [
  { id: 1, type: "trial", name: "A", branches: [2, 3] },
  { id: 2, type: "trial", name: "B", branches: [4] },
  { id: 3, type: "trial", name: "C", branches: [] },
  { id: 4, type: "trial", name: "D", branches: [] },
];

describe("LAYOUT_CONSTANTS", () => {
  it("has expected default values", () => {
    expect(LAYOUT_CONSTANTS.xTrial).toBe(250);
    expect(LAYOUT_CONSTANTS.yStep).toBe(100);
    expect(LAYOUT_CONSTANTS.branchHorizontalSpacing).toBe(200);
    expect(LAYOUT_CONSTANTS.branchVerticalOffset).toBe(100);
  });
});

describe("calculateBranchWidth", () => {
  it("returns spacing for item without branches", () => {
    const result = calculateBranchWidth(3, mockTrials, 200);
    expect(result).toBe(200);
  });

  it("returns spacing when the item omits its branches collection", () => {
    const result = calculateBranchWidth(5, [{ id: 5, type: "trial" }], 200);
    expect(result).toBe(200);
  });

  it("returns spacing for non-existent item", () => {
    const result = calculateBranchWidth(999, mockTrials, 200);
    expect(result).toBe(200);
  });

  it("calculates width for item with branches", () => {
    // Trial A has branches [2, 3]. Trial B has branch [4].
    // Total: max(branchHorizontalSpacing, sum of sub-branches)
    const result = calculateBranchWidth(1, mockTrials, 200);
    expect(result).toBeGreaterThanOrEqual(200);
  });
});

describe("createTrialNode", () => {
  it("creates a trial node with correct structure", () => {
    const onClick = () => {};
    const node = createTrialNode("t1", "Test Trial", 100, 200, true, onClick);

    expect(node.id).toBe("t1");
    expect(node.type).toBe("trial");
    expect(node.position).toEqual({ x: 100, y: 200 });
    expect(node.draggable).toBe(false);
    expect(node.data.name).toBe("Test Trial");
    expect(node.data.selected).toBe(true);
    expect(node.data.onClick).toBe(onClick);
  });

  it("creates unselected node without onAddBranch", () => {
    const onClick = () => {};
    const node = createTrialNode("t2", "Unselected", 0, 0, false, onClick);

    expect(node.data.selected).toBe(false);
    expect(node.data.onAddBranch).toBeUndefined();
  });

  it("assigns onAddBranch when selected", () => {
    const onClick = () => {};
    const onAddBranch = () => {};
    const node = createTrialNode("t3", "Selected", 0, 0, true, onClick, onAddBranch);

    expect(node.data.selected).toBe(true);
    expect(node.data.onAddBranch).toBe(onAddBranch);
  });
});

describe("createLoopNode", () => {
  it("creates a loop node with correct structure", () => {
    const onClick = () => {};
    const node = createLoopNode("l1", "Test Loop", 50, 100, true, onClick);

    expect(node.id).toBe("l1");
    expect(node.type).toBe("loop");
    expect(node.position).toEqual({ x: 50, y: 100 });
    expect(node.draggable).toBe(false);
    expect(node.data.name).toBe("Test Loop");
    expect(node.data.selected).toBe(true);
  });

  it("includes onOpenLoop when provided", () => {
    const onClick = () => {};
    const onOpenLoop = () => {};
    const node = createLoopNode("l2", "Loop", 0, 0, false, onClick, undefined, onOpenLoop);

    expect(node.data.onOpenLoop).toBe(onOpenLoop);
    expect(node.data.onAddBranch).toBeUndefined();
  });
});

describe("createEdge", () => {
  it("creates an edge with correct structure", () => {
    const edge = createEdge("source1", "target1");

    expect(edge.id).toBe("esource1-target1");
    expect(edge.source).toBe("source1");
    expect(edge.target).toBe("target1");
    expect(edge.type).toBe("default");
  });

  it("respects custom edge type", () => {
    const edge = createEdge("a", "b", "smoothstep");
    expect(edge.type).toBe("smoothstep");
  });

  it("generates unique ids for different edges", () => {
    const edge1 = createEdge("a", "b");
    const edge2 = createEdge("c", "d");
    expect(edge1.id).not.toBe(edge2.id);
    expect(edge1.id).toBe("ea-b");
    expect(edge2.id).toBe("ec-d");
  });
});

describe("alignMergePointNodes", () => {
  function node(id: string, x: number, y: number): LayoutNode {
    return {
      id,
      type: "trial",
      data: {},
      position: { x, y },
      draggable: false,
    };
  }

  it("centers merge points and moves their private branch subtree", () => {
    const items = [
      { id: "a", branches: ["merge"] },
      { id: "b", branches: ["merge", "shared"] },
      {
        id: "merge",
        branches: ["child", "shared", "missing-item", "no-node"],
      },
      { id: "child", branches: ["merge", "grandchild"] },
      { id: "grandchild" },
      { id: "shared", branches: [] },
      { id: "no-node", branches: [] },
    ];
    const nodes = [
      node("a", 100, 100),
      node("b", 300, 120),
      node("merge", 10, 10),
      node("child", 20, 20),
      node("grandchild", 30, 30),
      node("shared", 40, 40),
    ];

    alignMergePointNodes({
      nodes,
      items,
      mergePointIds: new Set(["missing-merge", "merge"]),
      branchVerticalOffset: 100,
      getNodeId: (item) => String(item.id),
    });

    expect(nodes.find((item) => item.id === "merge")?.position).toEqual({
      x: 140,
      y: 220,
    });
    expect(nodes.find((item) => item.id === "child")?.position).toEqual({
      x: 150,
      y: 230,
    });
    expect(nodes.find((item) => item.id === "grandchild")?.position).toEqual({
      x: 160,
      y: 240,
    });
    expect(nodes.find((item) => item.id === "shared")?.position).toEqual({
      x: 40,
      y: 40,
    });
  });

  it("skips merge points with missing nodes, one parent, or no movement", () => {
    const items = [
      { id: "a", branches: ["merge", "solo"] },
      { id: "b", branches: ["merge"] },
      { id: "merge", branches: [] },
      { id: "solo", branches: [] },
      { id: "missing-node", branches: [] },
      { id: "orphan", branches: [] },
    ];
    const nodes = [
      node("a", 100, 100),
      node("b", 300, 100),
      node("merge", 200, 150),
      node("solo", 0, 0),
      node("orphan", 50, 50),
    ];

    alignMergePointNodes({
      nodes,
      items,
      mergePointIds: new Set(["missing-node", "orphan", "solo", "merge"]),
      branchVerticalOffset: 50,
      getNodeId: (item) => String(item.id),
    });

    expect(nodes.find((item) => item.id === "merge")?.position).toEqual({
      x: 200,
      y: 150,
    });
    expect(nodes.find((item) => item.id === "solo")?.position).toEqual({
      x: 0,
      y: 0,
    });
  });
});
