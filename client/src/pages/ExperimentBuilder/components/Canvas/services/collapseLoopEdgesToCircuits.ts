import { CANVAS_EDGE_HANDLES } from "./canvasHandleIds";
import type {
  ExpandedCanvasEdge,
  ExpandedCanvasNode,
} from "./expandedLayoutTypes";

const circuitEdgeId = (markerId: string) =>
  ["edge", "loop-return", markerId, markerId]
    .map(encodeURIComponent)
    .join("::");

function createCircuitEdge(
  markerId: string,
  scopeId: string,
): ExpandedCanvasEdge {
  return {
    id: circuitEdgeId(markerId),
    source: markerId,
    target: markerId,
    ...CANVAS_EDGE_HANDLES.singleItemLoop,
    type: "smoothstep",
    data: { kind: "loop-return", scopeId },
  };
}

export function collapseLoopEdgesToCircuits(
  nodes: readonly ExpandedCanvasNode[],
  edges: readonly ExpandedCanvasEdge[],
) {
  const flowEdges = edges.filter((edge) => edge.data.kind === "flow");
  const grouped = new Map<string, ExpandedCanvasEdge[]>();
  edges
    .filter((edge) => edge.data.kind !== "flow")
    .forEach((edge) => {
      const scopeEdges = grouped.get(edge.data.scopeId) ?? [];
      scopeEdges.push(edge);
      grouped.set(edge.data.scopeId, scopeEdges);
    });

  const circuits = [...grouped.entries()].flatMap(
    ([scopeId, scopeEdges]) => {
      const existing = scopeEdges.find(
        (edge) =>
          edge.data.kind === "loop-return" &&
          edge.source === edge.target,
      );
      if (existing) return [existing];
      const connectedIds = new Set(
        scopeEdges.flatMap((edge) => [edge.source, edge.target]),
      );
      const marker = nodes.find(
        (node) =>
          node.data.role === "loop-marker" &&
          node.data.expanded &&
          connectedIds.has(node.id),
      );
      return marker ? [createCircuitEdge(marker.id, scopeId)] : [];
    },
  );

  return [...flowEdges, ...circuits];
}
