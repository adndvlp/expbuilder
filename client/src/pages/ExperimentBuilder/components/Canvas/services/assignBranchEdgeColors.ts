import type { ExpandedCanvasEdge } from "./expandedLayoutTypes";
import { BRANCH_EDGE_COLOR_COUNT } from "./branchEdgeTheme";
import type { GraphBranchEdge } from "../../../modules/experiment-graph/types";
import { getCanonicalBranchEdgeId } from "./canonicalBranchProjection";

type FlowGraph = {
  incoming: Map<string, ExpandedCanvasEdge[]>;
  outgoing: Map<string, ExpandedCanvasEdge[]>;
};

const addEdge = (
  map: Map<string, ExpandedCanvasEdge[]>,
  nodeId: string,
  edge: ExpandedCanvasEdge,
) => {
  const current = map.get(nodeId);
  if (current) current.push(edge);
  else map.set(nodeId, [edge]);
};

function buildFlowGraph(edges: ExpandedCanvasEdge[]): FlowGraph {
  const graph: FlowGraph = {
    incoming: new Map(),
    outgoing: new Map(),
  };
  edges.forEach((edge) => {
    addEdge(graph.incoming, edge.target, edge);
    addEdge(graph.outgoing, edge.source, edge);
  });
  return graph;
}

function assignSplitSlots(graph: FlowGraph) {
  const directSlots = new Map<string, number>();
  let nextSlot = 0;
  graph.outgoing.forEach((outgoing) => {
    if (outgoing.length < 2) return;
    [...outgoing]
      .sort((left, right) => left.id.localeCompare(right.id))
      .forEach((edge, index) => {
        directSlots.set(edge.id, (nextSlot + index) % BRANCH_EDGE_COLOR_COUNT);
      });
    nextSlot = (nextSlot + outgoing.length) % BRANCH_EDGE_COLOR_COUNT;
  });
  return directSlots;
}

function canonicalSourceKey(edge: GraphBranchEdge) {
  return JSON.stringify([
    edge.sourceOwnerId === null ? "root" : String(edge.sourceOwnerId),
    String(edge.sourceId),
  ]);
}

function assignCanonicalSlots(edges: readonly GraphBranchEdge[]) {
  const groups = new Map<string, GraphBranchEdge[]>();
  edges.forEach((edge) => {
    const key = canonicalSourceKey(edge);
    const outgoing = groups.get(key) ?? [];
    outgoing.push(edge);
    groups.set(key, outgoing);
  });
  const slots = new Map<string, number>();
  let nextSlot = 0;
  [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([, outgoing]) => {
      if (outgoing.length < 2) return;
      outgoing
        .map(getCanonicalBranchEdgeId)
        .sort()
        .forEach((edgeId, index) => {
          slots.set(edgeId, (nextSlot + index) % BRANCH_EDGE_COLOR_COUNT);
        });
      nextSlot = (nextSlot + outgoing.length) % BRANCH_EDGE_COLOR_COUNT;
    });
  return slots;
}

export function assignBranchColorSlots(
  edges: ExpandedCanvasEdge[],
  canonicalEdges: readonly GraphBranchEdge[] = [],
) {
  const flowEdges = edges.filter((edge) => edge.data.kind === "flow");
  const graph = buildFlowGraph(flowEdges);
  const directSlots = assignSplitSlots(graph);
  const resolved = new Map<string, number | undefined>();
  const resolving = new Set<string>();

  const resolve = (edge: ExpandedCanvasEdge): number | undefined => {
    const direct = directSlots.get(edge.id);
    if (direct !== undefined) return direct;
    if (resolved.has(edge.id)) return resolved.get(edge.id);
    if (resolving.has(edge.id)) return undefined;

    resolving.add(edge.id);
    const incoming = graph.incoming.get(edge.source) ?? [];
    const outgoing = graph.outgoing.get(edge.source) ?? [];
    const inherited =
      incoming.length === 1 && outgoing.length === 1
        ? resolve(incoming[0])
        : undefined;
    resolving.delete(edge.id);
    resolved.set(edge.id, inherited);
    return inherited;
  };

  const slots = new Map<string, number>();
  flowEdges.forEach((edge) => {
    const slot = resolve(edge);
    if (slot !== undefined) slots.set(edge.id, slot);
  });
  const canonicalSlots = assignCanonicalSlots(canonicalEdges);
  flowEdges.forEach((edge) => {
    const stableSlot = edge.data.semanticEdgeIds
      ?.map((semanticId) => canonicalSlots.get(semanticId))
      .find((slot): slot is number => slot !== undefined);
    if (stableSlot !== undefined) slots.set(edge.id, stableSlot);
  });
  return slots;
}
