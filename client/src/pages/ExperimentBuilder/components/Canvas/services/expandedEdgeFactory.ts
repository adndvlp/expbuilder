import { CANVAS_EDGE_HANDLES } from "./canvasHandleIds";
import type {
  ExpandedCanvasEdge,
  ExpandedCanvasEdgeKind,
  ExpandedCanvasFlowRole,
} from "./expandedLayoutTypes";

type EdgeCollector = {
  edges: ExpandedCanvasEdge[];
  edgeKeys: Set<string>;
};

type EdgeHandles = {
  sourceHandle: string;
  targetHandle: string;
};

export function addExpandedEdge(
  collector: EdgeCollector,
  source: string,
  target: string,
  kind: ExpandedCanvasEdgeKind,
  scopeId: string,
  handles: EdgeHandles,
  flowRole?: ExpandedCanvasFlowRole,
  semanticEdgeId?: string,
) {
  if (source === target && kind !== "loop-return") return;
  const key = [
    kind,
    source,
    target,
    handles.sourceHandle,
    handles.targetHandle,
  ].join("\u0000");
  if (collector.edgeKeys.has(key)) {
    const existing = collector.edges.find(
      (edge) =>
        edge.data.kind === kind &&
        edge.source === source &&
        edge.target === target &&
        edge.sourceHandle === handles.sourceHandle &&
        edge.targetHandle === handles.targetHandle,
    );
    if (existing && semanticEdgeId) {
      existing.data.semanticEdgeIds = [
        ...new Set([
          ...(existing.data.semanticEdgeIds ?? []),
          semanticEdgeId,
        ]),
      ].sort();
    }
    if (existing && flowRole) existing.data.flowRole = flowRole;
    return;
  }
  collector.edgeKeys.add(key);
  collector.edges.push({
    id: `edge::${encodeURIComponent(kind)}::${encodeURIComponent(source)}::${encodeURIComponent(target)}`,
    source,
    target,
    sourceHandle: handles.sourceHandle,
    targetHandle: handles.targetHandle,
    type: kind === "flow" ? "default" : "smoothstep",
    data: {
      kind,
      scopeId,
      flowRole,
      semanticEdgeIds: semanticEdgeId ? [semanticEdgeId] : undefined,
    },
  });
}

export function addExpandedFlowEdges(
  collector: EdgeCollector,
  sources: string[],
  target: string,
  scopeId: string,
  flowRole?: ExpandedCanvasFlowRole,
  semanticEdgeId?: string,
) {
  sources.forEach((source) =>
    addExpandedEdge(
      collector,
      source,
      target,
      "flow",
      scopeId,
      CANVAS_EDGE_HANDLES.flow,
      flowRole,
      semanticEdgeId,
    ),
  );
}
