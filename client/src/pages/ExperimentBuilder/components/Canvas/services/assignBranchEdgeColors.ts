import type { ExpandedCanvasEdge } from "./expandedLayoutTypes";
import { BRANCH_EDGE_COLOR_COUNT } from "./branchEdgeTheme";

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

export function assignBranchColorSlots(edges: ExpandedCanvasEdge[]) {
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
  return slots;
}
