import type {
  ModelState,
  Point,
} from "../../../../../../../shared/experiment-workspace/dist/types.js";
import { required } from "../../../../../../../shared/experiment-workspace/dist/valueUtils.js";
import type {
  WorkspaceLayout,
  WorkspaceNode,
  WorkspaceEdge,
  WorkspaceEdgeData,
} from "./types";
import type { ExpandedCanvasEdge } from "../services/expandedLayoutTypes";
import { translateCurve } from "./types";
// Project each disconnected structure through the app's canonical canvas layout.
import { buildUnifiedFlowLayout } from "../services/buildUnifiedFlowLayout";
import { getCanvasLayoutBounds } from "../services/canvasLayoutBounds";
import {
  getCanonicalBranchEdgeId,
  addCanonicalBranchEdges,
} from "../services/canonicalBranchProjection";
import { routeBoundaryEdges } from "./boundaryRouting.js";
import { assignBranchColorSlots } from "../services/assignBranchEdgeColors";
import { getBranchEdgeStroke } from "../services/branchEdgeTheme";
import { MarkerType } from "@xyflow/react";
import { getModel as M } from "./model.js";
import { inputFor } from "./input.js";
function withConnectionSemantics(
  edge: WorkspaceEdge,
  semantic: ReadonlyMap<string, string>,
): WorkspaceEdge {
  const semantics = [
    ...new Set(
      (edge.data.semanticEdgeIds ?? [])
        .map((id) => semantic.get(id))
        .filter((id): id is string => !!id),
    ),
  ];
  const single = semantics.length === 1 ? semantics[0] : null;
  const control = edge.data.kind !== "flow";
  return {
    ...edge,
    data: {
      ...edge.data,
      semantics,
      semantic: single,
      selectionId: single ?? edge.id,
      control,
      editable: !control && single !== null,
    },
  };
}
export function layout(s: ModelState): WorkspaceLayout {
  const model = M(),
    groups = model.components(s),
    positions: Record<string, Point> = {},
    sizes: WorkspaceLayout["sizes"] = {},
    componentIds: Record<string, string> = {};
  const nodes: WorkspaceNode[] = [],
    edges: WorkspaceEdge[] = [];
  const occupied: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    locked: boolean;
  }[] = [];
  const semantic = new Map(
    inputFor(s).branchEdges.map((e) => [
      getCanonicalBranchEdgeId(e),
      JSON.stringify([e.sourceId, e.targetId]),
    ]),
  );
  groups.sort(
    (a, b) =>
      Number(b.locked) - Number(a.locked) ||
      Number([...b.ids].some((id) => s.anchors[id])) -
        Number([...a.ids].some((id) => s.anchors[id])),
  );
  for (const component of groups) {
    const input = inputFor(s, component.ids);
    for (const e of input.branchEdges)
      semantic.set(
        getCanonicalBranchEdgeId(e),
        JSON.stringify([e.sourceId, e.targetId]),
      );
    const flow = buildUnifiedFlowLayout(input);
    const bounds = getCanvasLayoutBounds(flow.nodes, flow.edges);
    if (!bounds) continue;
    const reference =
      flow.nodes.find(
        (n) =>
          String(n.data.itemId) === String(input.entryItemIds.root) &&
          s.anchors[n.data.itemId],
      ) ?? flow.nodes.find((n) => s.anchors[n.data.itemId]);
    let anchor = reference ? s.anchors[reference.data.itemId] : null;
    if (!component.locked && !anchor) {
      const candidate: Point = {
        x: Math.max(
          850,
          ...occupied.filter((b) => b.locked).map((b) => b.right + 180),
        ),
        y: 80,
      };
      while (
        occupied.some(
          (b) =>
            candidate.x < b.right + 90 &&
            candidate.x + bounds.width > b.left - 90 &&
            candidate.y < b.bottom + 90 &&
            candidate.y + bounds.height > b.top - 90,
        )
      ) {
        candidate.x = Math.max(...occupied.map((b) => b.right + 180));
      }
      anchor = candidate;
    }
    const origin = anchor ?? { x: bounds.x, y: bounds.y };
    const dx = component.locked
      ? 0
      : origin.x - (reference?.position.x ?? bounds.x);
    const dy = component.locked
      ? 0
      : origin.y - (reference?.position.y ?? bounds.y);
    occupied.push({
      left: bounds.x + dx,
      right: bounds.x + dx + bounds.width,
      top: bounds.y + dy,
      bottom: bounds.y + dy + bounds.height,
      locked: component.locked,
    });
    const byId = new Map(flow.nodes.map((n) => [n.id, String(n.data.itemId)]));
    for (const node of flow.nodes) {
      const id = String(node.data.itemId),
        position = { x: node.position.x + dx, y: node.position.y + dy };
      positions[id] = position;
      sizes[id] = node.measured;
      componentIds[id] = component.key;
      nodes.push({
        ...node,
        id,
        position,
        draggable: !component.locked,
        data: {
          ...node.data,
          free: !component.locked,
          partial: component.attached,
          pendingRoot:
            component.attached && id === String(input.entryItemIds.root),
        },
      });
    }
    for (const edge of flow.edges) {
      const data: WorkspaceEdgeData = { ...edge.data };
      if (data.curve) data.curve = translateCurve(data.curve, dx, dy);
      if (data.routeX !== undefined) data.routeX += dx;
      if (data.routeTopY !== undefined) data.routeTopY += dy;
      if (data.routeBottomY !== undefined) data.routeBottomY += dy;
      edges.push(
        withConnectionSemantics(
          {
            ...edge,
            source: required(byId.get(edge.source)),
            target: required(byId.get(edge.target)),
            data,
          },
          semantic,
        ),
      );
    }
  }
  // Boundary connections never participate in positioning the reachable graph.
  // They use the same canonical projection and curve router as the app.
  const groupByItem = new Map(
    groups.flatMap((c) => [...c.ids].map((id) => [id, c.key])),
  );
  const full = inputFor(s);
  const boundaries = full.branchEdges.filter(
    (e) =>
      groupByItem.get(String(e.sourceId)) !==
      groupByItem.get(String(e.targetId)),
  );
  const projected: {
    nodes: WorkspaceNode[];
    edges: ExpandedCanvasEdge[];
    exitIds: string[];
  } = { nodes, edges: [], exitIds: [] };
  addCanonicalBranchEdges(projected, boundaries, full.scopeParents);
  routeBoundaryEdges(nodes, projected.edges);
  const slots = assignBranchColorSlots(
    [...edges, ...projected.edges],
    full.branchEdges,
  );
  for (const edge of projected.edges) {
    const stroke = getBranchEdgeStroke(slots.get(edge.id));
    edges.push(
      withConnectionSemantics(
        {
          ...edge,
          type: "navigation",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: stroke,
            width: 20,
            height: 20,
          },
          style: { stroke, strokeWidth: 1.5 },
          data: { ...edge.data, boundary: true },
        },
        semantic,
      ),
    );
  }
  return {
    positions,
    sizes,
    componentIds,
    groups,
    boxes: [],
    flowNodes: nodes,
    flowEdges: edges,
  };
}

export { insertionEndpoints } from "./insertion.js";
