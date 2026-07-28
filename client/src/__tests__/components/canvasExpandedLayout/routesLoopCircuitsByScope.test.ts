import { describe, expect, it } from "vitest";
import { CANVAS_EDGE_HANDLES } from "../../../pages/ExperimentBuilder/components/Canvas/services/canvasHandleIds";
import {
  getLoopRouteData,
  layoutExpandedLoopMarkers,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/loopScopeGeometry";
import { getLoopCircuitPoints } from "../../../pages/ExperimentBuilder/components/Canvas/services/loopRoutingPath";
import type {
  ExpandedCanvasEdge,
  ExpandedCanvasNode,
  ExpandedLoopScope,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

const itemNode = (
  id: string,
  scopeId: string,
  x: number,
  y: number,
): ExpandedCanvasNode => ({
  id,
  type: "trial",
  data: {
    scopeId,
    itemId: id,
    name: id,
    role: "item",
    expanded: false,
  },
  position: { x, y },
  draggable: false,
});

const markerNode = (
  id: string,
  scopeId: string,
  itemId: string,
): ExpandedCanvasNode => ({
  id,
  type: "loop",
  data: {
    scopeId,
    itemId,
    name: itemId,
    role: "loop-marker",
    expanded: true,
  },
  position: { x: 0, y: 0 },
  draggable: false,
});

const scopes: ExpandedLoopScope[] = [
  {
    id: "outer-scope",
    parentScopeId: "root",
    loopId: "outer",
    timeline: [],
  },
  {
    id: "nested-scope",
    parentScopeId: "outer-scope",
    loopId: "nested",
    timeline: [],
  },
];

const loopEdge = (
  id: string,
  kind: "loop-control" | "loop-return",
  scopeId: string,
  handles: { sourceHandle: string; targetHandle: string },
): ExpandedCanvasEdge => ({
  id,
  source: `${id}-source`,
  target: `${id}-target`,
  sourceHandle: handles.sourceHandle,
  targetHandle: handles.targetHandle,
  type: "smoothstep",
  data: { kind, scopeId },
});

describe("expanded loop circuit geometry", () => {
  it("gives a parent loop an exterior lane and each nested loop a local lane", () => {
    const nodes = [
      markerNode("outer-marker", "root", "outer"),
      itemNode("outer-entry", "outer-scope", 500, 80),
      markerNode("nested-marker", "outer-scope", "nested"),
      itemNode("nested-entry", "nested-scope", 500, 260),
      itemNode("nested-exit", "nested-scope", 500, 380),
      itemNode("outer-exit", "outer-scope", 760, 620),
    ];

    const routes = layoutExpandedLoopMarkers(nodes, scopes, 260);
    const outer = routes.get("outer-scope")!;
    const nested = routes.get("nested-scope")!;
    const outerMarker = nodes.find((node) => node.id === "outer-marker")!;
    const nestedMarker = nodes.find((node) => node.id === "nested-marker")!;

    expect(outerMarker.position.x).toBeLessThan(nestedMarker.position.x);
    expect(nestedMarker.position.x).toBeLessThan(
      nodes.find((node) => node.id === "nested-entry")!.position.x,
    );
    expect(outer.topY).toBeLessThan(nested.topY);
    expect(outer.bottomY).toBeGreaterThan(nested.bottomY);
    expect(outer.rightX).toBeGreaterThan(nested.rightX);
    expect(outer).toEqual({
      topY: 36,
      bottomY: 738,
      rightX: 1008,
    });
    expect(nested).toEqual({
      topY: 216,
      bottomY: 474,
      rightX: 724,
    });
  });

  it("routes one circuit through every exterior lane for each scope", () => {
    const nodes = [
      markerNode("outer-marker", "root", "outer"),
      itemNode("entry", "outer-scope", 500, 100),
      itemNode("exit", "outer-scope", 760, 500),
      markerNode("nested-marker", "outer-scope", "nested"),
      itemNode("nested-entry", "nested-scope", 500, 260),
      itemNode("nested-exit", "nested-scope", 500, 380),
    ];
    const routes = layoutExpandedLoopMarkers(nodes, scopes, 260);

    scopes.forEach((scope) => {
      const lanes = routes.get(scope.id)!;
      const circuit = loopEdge(
        `${scope.id}-return`,
        "loop-return",
        scope.id,
        CANVAS_EDGE_HANDLES.singleItemLoop,
      );

      expect(getLoopRouteData(circuit, routes)).toEqual({
        routeX: lanes.rightX,
        routeTopY: lanes.topY,
        routeBottomY: lanes.bottomY,
      });
    });
  });

  it("draws one path around the complete scope", () => {
    const points = getLoopCircuitPoints({
      sourceX: 200,
      sourceY: 250,
      targetX: 200,
      targetY: 200,
      routeX: 700,
      routeTopY: 100,
      routeBottomY: 560,
    });

    expect(points).toContainEqual({ x: 200, y: 100 });
    expect(points).toContainEqual({ x: 700, y: 100 });
    expect(points).toContainEqual({ x: 700, y: 560 });
    expect(points).toContainEqual({ x: 200, y: 560 });
  });
});
