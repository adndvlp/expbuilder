import { describe, expect, it } from "vitest";
import {
  composeExpandedLoopLayout,
  getScopedNodeId,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import type {
  ExpandedCanvasLayout,
  ExpandedLoopScope,
  LayoutItemId,
  LayoutTimelineItem,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";
import type { GraphBranchEdge } from "../../../pages/ExperimentBuilder/modules/experiment-graph/types";
import {
  getLoopScopeLanes,
  LOOP_NODE_ROUTE_GAP,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/loopScopeGeometry";

const trial = (
  id: LayoutItemId,
  branches: LayoutItemId[] = [],
): LayoutTimelineItem => ({ id, type: "trial", name: String(id), branches });

const loop = (
  id: LayoutItemId,
  branches: LayoutItemId[] = [],
): LayoutTimelineItem => ({
  id,
  type: "loop",
  name: String(id),
  branches,
});

const scope = (
  id: string,
  parentScopeId: string,
  loopId: string,
  timeline: LayoutTimelineItem[],
): ExpandedLoopScope => ({ id, parentScopeId, loopId, timeline });

const edge = (
  sourceId: LayoutItemId,
  targetId: LayoutItemId,
  sourceOwnerId: string | null,
  targetOwnerId: string | null,
  exitedLoopIds: string[] = [],
): GraphBranchEdge => ({
  sourceId,
  targetId,
  sourceOwnerId,
  targetOwnerId,
  exitedLoopIds,
});

const position = (layout: ExpandedCanvasLayout, nodeId: string) => {
  const node = layout.nodes.find((item) => item.id === nodeId);
  expect(node, `missing layout node ${nodeId}`).toBeDefined();
  return node!.position;
};

describe("loop branch layout", () => {
  it("preserves the established layout for branches that stay in one scope", () => {
    const rootTimeline = [
      trial("split", ["left", "right"]),
      trial("left"),
      trial("right"),
    ];
    const canonicalEdges = [
      edge("split", "left", null, null),
      edge("split", "right", null, null),
    ];
    const previousLayout = composeExpandedLoopLayout({
      rootTimeline,
      expandedScopes: [],
    });
    const canonicalLayout = composeExpandedLoopLayout({
      rootTimeline,
      expandedScopes: [],
      branchEdges: canonicalEdges,
    });

    expect(canonicalLayout.nodes).toEqual(previousLayout.nodes);
    const visualEdge = ({
      data: { semanticEdgeIds: _semanticEdgeIds, ...data },
      ...candidate
    }: ExpandedCanvasLayout["edges"][number]) => ({ ...candidate, data });
    expect(canonicalLayout.edges.map(visualEdge)).toEqual(
      previousLayout.edges.map(visualEdge),
    );
  });

  it("[TL-12] anchors one exit outside its loop boundary at every collapse level", () => {
    const rootTimeline = [
      trial("split", ["left", "right"]),
      trial("left", ["outer"]),
      trial("right"),
      loop("outer"),
      trial("root-exit"),
    ];
    const outerScope = scope("outer-scope", "root", "outer", [
      trial("question", ["outer-leaf", "inner"]),
      trial("outer-leaf"),
      loop("inner"),
    ]);
    const innerScope = scope("inner-scope", "outer-scope", "inner", [
      trial("source", ["inner-leaf", "root-exit"]),
      trial("inner-leaf"),
    ]);
    const branchEdges = [
      edge("split", "left", null, null),
      edge("split", "right", null, null),
      edge("left", "outer", null, null),
      edge("question", "outer-leaf", "outer", "outer"),
      edge("question", "inner", "outer", "outer"),
      edge("source", "inner-leaf", "inner", "inner"),
      edge("source", "root-exit", "inner", null, ["inner", "outer"]),
    ];
    const render = (expandedScopes: ExpandedLoopScope[]) =>
      composeExpandedLoopLayout({
        rootTimeline,
        expandedScopes,
        branchEdges,
        scopeParents: { inner: "outer", outer: null },
      });
    const rootExit = getScopedNodeId("root", "trial", "root-exit");

    const expanded = render([outerScope, innerScope]);
    const expandedSource = getScopedNodeId("inner-scope", "trial", "source");
    const innerLeaf = getScopedNodeId("inner-scope", "trial", "inner-leaf");
    const sourceX = position(expanded, expandedSource).x;
    const childXs = [
      position(expanded, innerLeaf).x,
      position(expanded, rootExit).x,
    ];
    expect(Math.min(...childXs)).toBeLessThan(sourceX);
    expect(Math.max(...childXs)).toBeGreaterThan(sourceX);
    expect((childXs[0]! + childXs[1]!) / 2).toBe(sourceX);
    expect(position(expanded, rootExit).y).toBeGreaterThan(
      position(expanded, expandedSource).y,
    );
    const outerLane = getLoopScopeLanes(
      expanded.nodes,
      [outerScope, innerScope],
    ).get("outer-scope");
    expect(outerLane).toBeDefined();
    expect(position(expanded, rootExit).y).toBeGreaterThanOrEqual(
      outerLane!.bottomY + LOOP_NODE_ROUTE_GAP,
    );

    const nestedCollapsed = render([outerScope]);
    const innerMarker = getScopedNodeId("outer-scope", "loop", "inner");
    expect(position(nestedCollapsed, rootExit).x).toBe(
      position(nestedCollapsed, innerMarker).x,
    );
    expect(position(nestedCollapsed, rootExit).y).toBeGreaterThan(
      position(nestedCollapsed, innerMarker).y,
    );

    const allCollapsed = render([]);
    const outerMarker = getScopedNodeId("root", "loop", "outer");
    expect(position(allCollapsed, rootExit)).toEqual({
      x: position(allCollapsed, outerMarker).x,
      y: position(allCollapsed, outerMarker).y + 120,
    });
  });

  it("fans multiple exits to the same level beneath the projected source", () => {
    const rootTimeline = [loop("outer"), trial("exit-a"), trial("exit-b")];
    const result = composeExpandedLoopLayout({
      rootTimeline,
      expandedScopes: [],
      branchEdges: [
        edge("source", "exit-a", "outer", null, ["outer"]),
        edge("source", "exit-b", "outer", null, ["outer"]),
      ],
      scopeParents: { outer: null },
    });
    const marker = position(result, getScopedNodeId("root", "loop", "outer"));
    const exitA = position(result, getScopedNodeId("root", "trial", "exit-a"));
    const exitB = position(result, getScopedNodeId("root", "trial", "exit-b"));

    expect(exitA.x).toBeLessThan(marker.x);
    expect(exitB.x).toBeGreaterThan(marker.x);
    expect((exitA.x + exitB.x) / 2).toBe(marker.x);
    expect(exitA.y).toBe(marker.y + 120);
    expect(exitB.y).toBe(exitA.y);
  });

  it("uses an odd scope exit as the center lane between local branches", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [loop("outer"), trial("root-exit")],
      expandedScopes: [
        scope("outer-scope", "root", "outer", [
          trial("source", ["local-a", "local-b", "root-exit"]),
          trial("local-a"),
          trial("local-b"),
        ]),
      ],
      branchEdges: [
        edge("source", "local-a", "outer", "outer"),
        edge("source", "local-b", "outer", "outer"),
        edge("source", "root-exit", "outer", null, ["outer"]),
      ],
      scopeParents: { outer: null },
    });
    const source = position(
      result,
      getScopedNodeId("outer-scope", "trial", "source"),
    );
    const localXs = ["local-a", "local-b"].map(
      (id) => position(result, getScopedNodeId("outer-scope", "trial", id)).x,
    );
    const rootExit = position(
      result,
      getScopedNodeId("root", "trial", "root-exit"),
    );

    expect(rootExit.x).toBe(source.x);
    expect(Math.min(...localXs)).toBeLessThan(source.x);
    expect(Math.max(...localXs)).toBeGreaterThan(source.x);
    expect(rootExit.y).toBeGreaterThan(source.y);
  });
});
