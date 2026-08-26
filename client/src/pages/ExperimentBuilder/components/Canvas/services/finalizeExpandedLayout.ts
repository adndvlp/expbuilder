import type {
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
  ExpandedLoopScope,
} from "./expandedLayoutTypes";
import {
  buildExpandedFlowGraph,
  collectExpandedMovableSubtree,
  getExpandedFlowDepth,
  moveExpandedNodes,
  type ExpandedFlowGraph,
} from "./expandedFlowGraph";
import { getLoopAwareBranchBounds } from "./getLoopAwareBranchBounds";
import { layoutScopeExitBranches } from "./layoutScopeExitBranches";
import { getLoopCircuitHorizontalBounds } from "./loopScopeGeometry";
type BranchGroup = {
  nodeIds: Set<string>;
  rootX: number;
  minX: number;
  maxX: number;
};
const SUBTREE_GAP = 80;

function getBranchGroup(
  rootId: string,
  graph: ExpandedFlowGraph,
  layout: ExpandedCanvasLayout,
  circuitBounds: ReturnType<typeof getLoopCircuitHorizontalBounds>,
) {
  const nodeIds = collectExpandedMovableSubtree(rootId, graph, layout.edges);
  const nodes = [...nodeIds]
    .map((nodeId) => graph.nodeById.get(nodeId))
    .filter((node): node is ExpandedCanvasNode => Boolean(node));
  const rootX = graph.nodeById.get(rootId)?.position.x ?? 0;
  const bounds = getLoopAwareBranchBounds({ nodes, nodeIds, circuitBounds });
  return {
    nodeIds,
    rootX,
    ...bounds,
  };
}

function moveBranchGroup(
  group: BranchGroup,
  graph: ExpandedFlowGraph,
  dx: number,
) {
  moveExpandedNodes(group.nodeIds, graph, dx, 0);
  group.rootX += dx;
  group.minX += dx;
  group.maxX += dx;
}

function spreadBranchSubtrees(
  layout: ExpandedCanvasLayout,
  branchGraph: ExpandedFlowGraph,
  ownershipGraph: ExpandedFlowGraph,
  scopes: readonly ExpandedLoopScope[],
  excludedParentIds: ReadonlySet<string> = new Set(),
) {
  const depthMemo = new Map<string, number>();
  const branchParents = [...branchGraph.children.entries()]
    .filter(
      ([parentId, childIds]) =>
        childIds.size > 1 && !excludedParentIds.has(parentId),
    )
    .sort(
      ([leftId], [rightId]) =>
        getExpandedFlowDepth(
          rightId,
          branchGraph.parents,
          depthMemo,
          new Set(),
        ) -
        getExpandedFlowDepth(leftId, branchGraph.parents, depthMemo, new Set()),
    );

  branchParents.forEach(([parentId, childIds]) => {
    const parent = branchGraph.nodeById.get(parentId);
    if (!parent) return;
    const circuitBounds = getLoopCircuitHorizontalBounds(layout.nodes, scopes);
    const groups = [...childIds]
      .map((childId) =>
        getBranchGroup(childId, ownershipGraph, layout, circuitBounds),
      )
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
      const center = (rootOffsets[0] + rootOffsets[rootOffsets.length - 1]) / 2;
      groups.forEach((group, index) =>
        moveBranchGroup(
          group,
          ownershipGraph,
          parent.position.x + rootOffsets[index] - center - group.rootX,
        ),
      );
      return;
    }

    const pivot = groups[pivotIndex];
    moveBranchGroup(pivot, ownershipGraph, parent.position.x - pivot.rootX);
    let cursor = pivot.minX - SUBTREE_GAP;
    groups
      .slice(0, pivotIndex)
      .reverse()
      .forEach((group) => {
        moveBranchGroup(group, ownershipGraph, cursor - group.maxX);
        cursor = group.minX - SUBTREE_GAP;
      });
    cursor = pivot.maxX + SUBTREE_GAP;
    groups.slice(pivotIndex + 1).forEach((group) => {
      moveBranchGroup(group, ownershipGraph, cursor - group.minX);
      cursor = group.maxX + SUBTREE_GAP;
    });
  });
}

function getScopeExitSourceIds(layout: ExpandedCanvasLayout) {
  return new Set(
    layout.edges
      .filter(
        (edge) =>
          edge.data.kind === "flow" && edge.data.flowRole === "scope-exit",
      )
      .map((edge) => edge.source),
  );
}

function alignMergeNodes(
  layout: ExpandedCanvasLayout,
  graph: ExpandedFlowGraph,
  verticalGap: number,
) {
  const depthMemo = new Map<string, number>();
  const mergeIds = [...graph.parents.entries()]
    .filter(([, parentIds]) => parentIds.size > 1)
    .map(([nodeId]) => nodeId)
    .sort(
      (left, right) =>
        getExpandedFlowDepth(left, graph.parents, depthMemo, new Set()) -
        getExpandedFlowDepth(right, graph.parents, depthMemo, new Set()),
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

    moveExpandedNodes(
      collectExpandedMovableSubtree(mergeId, graph, layout.edges),
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
  scopes: readonly ExpandedLoopScope[] = [],
) {
  const localGraph = buildExpandedFlowGraph(
    layout,
    (edge) => edge.data.flowRole !== "scope-exit",
  );
  const completeGraph = buildExpandedFlowGraph(layout);
  // Local edges define each fan-out; the complete graph keeps uniquely owned
  // loop exits attached while their ancestor subtrees move.
  spreadBranchSubtrees(layout, localGraph, completeGraph, scopes);
  layoutScopeExitBranches(layout, completeGraph, verticalGap);
  // Exit sources now have their authoritative fan geometry. Repack only their
  // ancestors so the widened envelope cannot invade a lateral sibling.
  spreadBranchSubtrees(
    layout,
    localGraph,
    completeGraph,
    scopes,
    getScopeExitSourceIds(layout),
  );
  alignMergeNodes(layout, completeGraph, verticalGap);
  sortEdgesByFlowPosition(layout);
  return layout;
}
