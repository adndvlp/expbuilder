import type {
  ExpandedCanvasEdge,
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
} from "./expandedLayoutTypes";

export type ExpandedFlowGraph = {
  nodeById: Map<string, ExpandedCanvasNode>;
  parents: Map<string, Set<string>>;
  children: Map<string, Set<string>>;
};

const addRelation = (
  relations: Map<string, Set<string>>,
  key: string,
  value: string,
) => {
  const related = relations.get(key) ?? new Set<string>();
  related.add(value);
  relations.set(key, related);
};

export function buildExpandedFlowGraph(
  layout: ExpandedCanvasLayout,
  includeEdge: (edge: ExpandedCanvasEdge) => boolean = () => true,
): ExpandedFlowGraph {
  const graph: ExpandedFlowGraph = {
    nodeById: new Map(layout.nodes.map((node) => [node.id, node])),
    parents: new Map(),
    children: new Map(),
  };

  layout.edges
    .filter((edge) => edge.data.kind === "flow" && includeEdge(edge))
    .forEach((edge) => {
      addRelation(graph.parents, edge.target, edge.source);
      addRelation(graph.children, edge.source, edge.target);
    });

  return graph;
}

export function getExpandedFlowDepth(
  nodeId: string,
  parents: Map<string, Set<string>>,
  memo: Map<string, number>,
  visiting: Set<string>,
): number {
  const cached = memo.get(nodeId);
  if (cached !== undefined) return cached;
  if (visiting.has(nodeId)) return 0;

  visiting.add(nodeId);
  const parentIds = [...(parents.get(nodeId) ?? [])];
  const depth =
    parentIds.length === 0
      ? 0
      : Math.max(
          ...parentIds.map((parentId) =>
            getExpandedFlowDepth(parentId, parents, memo, visiting),
          ),
        ) + 1;
  visiting.delete(nodeId);
  memo.set(nodeId, depth);
  return depth;
}

export function collectExpandedMovableSubtree(
  rootId: string,
  graph: ExpandedFlowGraph,
  edges: ExpandedCanvasEdge[],
) {
  const movable = new Set<string>([rootId]);
  const queue = [rootId];

  while (queue.length > 0) {
    const sourceId = queue.shift()!;
    (graph.children.get(sourceId) ?? []).forEach((childId) => {
      if ((graph.parents.get(childId)?.size ?? 0) !== 1) return;
      if (movable.has(childId)) return;
      movable.add(childId);
      queue.push(childId);
    });
  }

  edges
    .filter(
      (edge) =>
        edge.data.kind === "loop-control" ||
        (edge.data.kind === "loop-return" && edge.source === edge.target),
    )
    .forEach((edge) => {
      const marker = graph.nodeById.get(edge.target);
      const ownsSingleItemScope =
        edge.source === edge.target &&
        [...movable].some(
          (nodeId) =>
            graph.nodeById.get(nodeId)?.data.scopeId === edge.data.scopeId,
        );
      if (
        marker?.data.role === "loop-marker" &&
        (movable.has(edge.source) || ownsSingleItemScope)
      ) {
        movable.add(marker.id);
      }
    });

  return movable;
}

export function moveExpandedNodes(
  nodeIds: Set<string>,
  graph: ExpandedFlowGraph,
  dx: number,
  dy: number,
) {
  nodeIds.forEach((nodeId) => {
    const node = graph.nodeById.get(nodeId);
    if (!node) return;
    node.position = {
      x: node.position.x + dx,
      y: node.position.y + dy,
    };
  });
}
