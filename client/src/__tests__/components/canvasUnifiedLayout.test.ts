import { describe, expect, it, vi } from "vitest";
import {
  buildUnifiedFlowLayout,
  getLoopLayoutScopeId,
} from "../../pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import type { ExpandedLoopEntry } from "../../pages/ExperimentBuilder/components/Canvas/hooks/useExpandedLoopPath";
import { getCanvasLayoutSignature } from "../../pages/ExperimentBuilder/components/Canvas/services/getCanvasLayoutSignature";

const path: ExpandedLoopEntry[] = [
  {
    loop: { id: "parent", name: "Parent", parentLoopId: null },
    items: [
      { id: 1, type: "trial", name: "Parent first" },
      { id: "nested", type: "loop", name: "Nested" },
      { id: 2, type: "trial", name: "Parent last" },
    ],
  },
  {
    loop: { id: "nested", name: "Nested", parentLoopId: "parent" },
    items: [
      { id: 3, type: "trial", name: "Nested first" },
      { id: 4, type: "trial", name: "Nested last" },
    ],
  },
];

describe("buildUnifiedFlowLayout", () => {
  it("decorates parent and nested nodes with their editing scopes", () => {
    const onSelectTrial = vi.fn();
    const onSelectLoop = vi.fn();
    const onToggleLoop = vi.fn();
    const onAddBranch = vi.fn();
    const result = buildUnifiedFlowLayout({
      timeline: [
        { id: "before", type: "trial", name: "Before" },
        { id: "parent", type: "loop", name: "Parent" },
        { id: "after", type: "trial", name: "After" },
      ],
      expandedPath: path,
      selectedItemId: 3,
      selectedScopeId: "nested",
      onSelectTrial,
      onSelectLoop,
      onToggleLoop,
      onAddBranch,
    });

    const parentMarker = result.nodes.find(
      (node) => node.data.itemId === "parent",
    );
    const nestedMarker = result.nodes.find(
      (node) => node.data.itemId === "nested",
    );
    const nestedTrial = result.nodes.find((node) => node.data.itemId === 3);

    expect(parentMarker?.data.expanded).toBe(true);
    expect(nestedMarker?.data.expanded).toBe(true);
    expect(nestedTrial?.data.selected).toBe(true);
    nestedTrial?.data.onClick();
    nestedTrial?.data.onAddBranch?.();
    nestedMarker?.data.onOpenLoop?.();

    expect(onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3 }),
      "nested",
    );
    expect(onAddBranch).toHaveBeenCalledWith(3, "nested");
    expect(onToggleLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "nested" }),
      "parent",
    );
    const returns = result.edges.filter(
      (edge) => edge.data.kind === "loop-return",
    );
    const parentReturn = returns.find(
      (edge) => edge.data.scopeId === getLoopLayoutScopeId("parent"),
    );
    const nestedReturn = returns.find(
      (edge) => edge.data.scopeId === getLoopLayoutScopeId("nested"),
    );
    expect(parentReturn!.pathOptions.offset).toBeGreaterThan(
      nestedReturn!.pathOptions.offset,
    );
    expect(
      result.edges
        .filter((edge) => edge.data.kind !== "flow")
        .every((edge) => edge.type === "loop"),
    ).toBe(true);
    expect(
      result.edges
        .filter((edge) => edge.data.kind !== "flow")
        .every((edge) => edge.animated),
    ).toBe(true);
    expect(
      result.edges
        .filter((edge) => edge.data.kind === "flow")
        .every((edge) => !edge.animated),
    ).toBe(true);
    expect(parentReturn).toMatchObject({
      data: { routeX: expect.any(Number) },
    });
  });

  it("marks pending loops and styles return edges distinctly", () => {
    const result = buildUnifiedFlowLayout({
      timeline: [{ id: "parent", type: "loop", name: "Parent" }],
      expandedPath: path.slice(0, 1),
      selectedItemId: null,
      selectedScopeId: null,
      pendingLoopId: "parent",
      onSelectTrial: vi.fn(),
      onSelectLoop: vi.fn(),
      onToggleLoop: vi.fn(),
      onAddBranch: vi.fn(),
    });

    expect(result.nodes.find((node) => node.data.itemId === "parent")?.data)
      .toMatchObject({ loading: true });
    expect(result.edges.find((edge) => edge.data.kind === "loop-return"))
      .toMatchObject({ animated: true, style: { stroke: "#2f80ed" } });
  });
});

describe("getCanvasLayoutSignature", () => {
  it("changes when positions or topology change without changing node ids", () => {
    const nodes = [{ id: "trial-1", position: { x: 0, y: 0 } }];
    const edges = [{ id: "edge-1", source: "trial-1", target: "trial-2" }];
    const original = getCanvasLayoutSignature(nodes, edges);

    expect(
      getCanvasLayoutSignature(
        [{ id: "trial-1", position: { x: 25, y: 0 } }],
        edges,
      ),
    ).not.toBe(original);
    expect(
      getCanvasLayoutSignature(nodes, [
        { id: "edge-2", source: "trial-2", target: "trial-1" },
      ]),
    ).not.toBe(original);
  });
});
