import type {
  ExpandedCanvasEdge,
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
} from "./expandedLayoutTypes";

type FlowGraph = {
  nodeById: Map<string, ExpandedCanvasNode>;
  parents: Map<string, Set<string>>;
  children: Map<string, Set<string>>;
};

type BranchGroup = {
  nodeIds: Set<string>;
  rootX: number;
  minX: number;
  maxX: number;
};

const NODE_WIDTH = 180;
const SUBTREE_GAP = 80;

const addRelation = (
  relations: Map<string, Set<string>>,
  key: string,
  value: string,
) => {
  const related = relations.get(key) ?? new Set<string>();
  related.add(value);
  relations.set(key, related);
};

function buildFlowGraph(layout: ExpandedCanvasLayout): FlowGraph {
  const graph: FlowGraph = {
    nodeById: new Map(layout.nodes.map((node) => [node.id, node])),
    parents: new Map(),
    children: new Map(),
  };

  layout.edges
    .filter((edge) => edge.data.kind === "flow")
    .forEach((edge) => {
      addRelation(graph.parents, edge.target, edge.source);
      addRelation(graph.children, edge.source, edge.target);
    });

  return graph;
}

function getFlowDepth(
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
            getFlowDepth(parentId, parents, memo, visiting),
          ),
        ) + 1;
  visiting.delete(nodeId);
  memo.set(nodeId, depth);
  return depth;
}

function collectMovableSubtree(
  rootId: string,
  graph: FlowGraph,
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

function moveNodes(
  nodeIds: Set<string>,
  graph: FlowGraph,
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

function getBranchGroup(
  rootId: string,
  graph: FlowGraph,
  edges: ExpandedCanvasEdge[],
) {
  const nodeIds = collectMovableSubtree(rootId, graph, edges);
  const nodes = [...nodeIds]
    .map((nodeId) => graph.nodeById.get(nodeId))
    .filter((node): node is ExpandedCanvasNode => Boolean(node));
  const rootX = graph.nodeById.get(rootId)?.position.x ?? 0;
  return {
    nodeIds,
    rootX,
    minX: Math.min(...nodes.map((node) => node.position.x)),
    maxX: Math.max(...nodes.map((node) => node.position.x + NODE_WIDTH)),
  };
}

function moveBranchGroup(group: BranchGroup, graph: FlowGraph, dx: number) {
  moveNodes(group.nodeIds, graph, dx, 0);
  group.rootX += dx;
  group.minX += dx;
  group.maxX += dx;
}

function spreadBranchSubtrees(layout: ExpandedCanvasLayout, graph: FlowGraph) {
  const depthMemo = new Map<string, number>();
  const branchParents = [...graph.children.entries()]
    .filter(([, childIds]) => childIds.size > 1)
    .sort(
      ([leftId], [rightId]) =>
        getFlowDepth(rightId, graph.parents, depthMemo, new Set()) -
        getFlowDepth(leftId, graph.parents, depthMemo, new Set()),
    );

  branchParents.forEach(([parentId, childIds]) => {
    const parent = graph.nodeById.get(parentId);
    if (!parent) return;
    const groups = [...childIds]
      .map((childId) => getBranchGroup(childId, graph, layout.edges))
      .sort((left, right) => left.rootX - right.rootX);
    const pivotIndex =
      groups.length % 2 === 1
        ? groups.findIndex(
            (group) => Math.abs(group.rootX - parent.position.x) < 1,
          )
        : -1;

    if (pivotIndex < 0) {
      const rootOffsets = groups.map((group, index) => {
        if (index === 0) return 0;
        const previous = groups[index - 1];
        return (
          previous.maxX -
          previous.rootX -
          (group.minX - group.rootX) +
          SUBTREE_GAP
        );
      });
      for (let index = 1; index < rootOffsets.length; index += 1) {
        rootOffsets[index] += rootOffsets[index - 1];
      }
      const center =
        (rootOffsets[0] + rootOffsets[rootOffsets.length - 1]) / 2;
      groups.forEach((group, index) =>
        moveBranchGroup(
          group,
          graph,
          parent.position.x + rootOffsets[index] - center - group.rootX,
        ),
      );
      return;
    }

    const pivot = groups[pivotIndex];
    moveBranchGroup(pivot, graph, parent.position.x - pivot.rootX);
    let cursor = pivot.minX - SUBTREE_GAP;
    groups.slice(0, pivotIndex).reverse().forEach((group) => {
      moveBranchGroup(group, graph, cursor - group.maxX);
      cursor = group.minX - SUBTREE_GAP;
    });
    cursor = pivot.maxX + SUBTREE_GAP;
    groups.slice(pivotIndex + 1).forEach((group) => {
      moveBranchGroup(group, graph, cursor - group.minX);
      cursor = group.maxX + SUBTREE_GAP;
    });
  });
}

function alignMergeNodes(
  layout: ExpandedCanvasLayout,
  graph: FlowGraph,
  verticalGap: number,
) {
  const depthMemo = new Map<string, number>();
  const mergeIds = [...graph.parents.entries()]
    .filter(([, parentIds]) => parentIds.size > 1)
    .map(([nodeId]) => nodeId)
    .sort(
      (left, right) =>
        getFlowDepth(left, graph.parents, depthMemo, new Set()) -
        getFlowDepth(right, graph.parents, depthMemo, new Set()),
    );

  mergeIds.forEach((mergeId) => {
    const mergeNode = graph.nodeById.get(mergeId);
    const parentNodes = [...(graph.parents.get(mergeId) ?? [])]
      .map((parentId) => graph.nodeById.get(parentId))
      .filter((node): node is ExpandedCanvasNode => Boolean(node));
    if (!mergeNode || parentNodes.length < 2) return;

    const targetX =
      parentNodes.reduce((sum, node) => sum + node.position.x, 0) /
      parentNodes.length;
    const targetY =
      Math.max(...parentNodes.map((node) => node.position.y)) + verticalGap;
    const dx = targetX - mergeNode.position.x;
    const dy = targetY - mergeNode.position.y;
    if (dx === 0 && dy === 0) return;

    moveNodes(
      collectMovableSubtree(mergeId, graph, layout.edges),
      graph,
      dx,
      dy,
    );
  });
}

function sortEdgesByFlowPosition(layout: ExpandedCanvasLayout) {
  const positions = new Map(
    layout.nodes.map((node) => [node.id, node.position] as const),
  );
  const flowEdges = layout.edges.filter((edge) => edge.data.kind === "flow");
  const loopEdges = layout.edges.filter((edge) => edge.data.kind !== "flow");

  flowEdges.sort((left, right) => {
    const leftSource = positions.get(left.source);
    const rightSource = positions.get(right.source);
    const yDifference = (leftSource?.y ?? 0) - (rightSource?.y ?? 0);
    if (yDifference !== 0) return yDifference;
    const xDifference = (leftSource?.x ?? 0) - (rightSource?.x ?? 0);
    if (xDifference !== 0) return xDifference;
    return left.id.localeCompare(right.id);
  });

  layout.edges.splice(0, layout.edges.length, ...flowEdges, ...loopEdges);
}

export function finalizeExpandedLayout(
  layout: ExpandedCanvasLayout,
  verticalGap: number,
) {
  const graph = buildFlowGraph(layout);
  spreadBranchSubtrees(layout, graph);
  alignMergeNodes(layout, graph, verticalGap);
  sortEdgesByFlowPosition(layout);
  return layout;
}
