import type {
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
} from "./expandedLayoutTypes";
import {
  collectExpandedMovableSubtree,
  getExpandedFlowDepth,
  moveExpandedNodes,
  type ExpandedFlowGraph,
} from "./expandedFlowGraph";

type ExitTargetGroup = {
  sourceId: string;
  targetIds: string[];
  exitTargetIds: Set<string>;
};

type MovableTarget = {
  node: ExpandedCanvasNode;
  nodeIds: Set<string>;
  minX: number;
  maxX: number;
};

const TARGET_GAP = 80;

function collectExitTargetGroups(
  layout: ExpandedCanvasLayout,
  graph: ExpandedFlowGraph,
) {
  const exitTargetsBySource = new Map<string, Set<string>>();
  layout.edges
    .filter(
      (edge) =>
        edge.data.kind === "flow" && edge.data.flowRole === "scope-exit",
    )
    .forEach((edge) => {
      const targets = exitTargetsBySource.get(edge.source) ?? new Set<string>();
      targets.add(edge.target);
      exitTargetsBySource.set(edge.source, targets);
    });
  return [...exitTargetsBySource.entries()].map(
    ([sourceId, exitTargetIds]): ExitTargetGroup => ({
      sourceId,
      targetIds: [...(graph.children.get(sourceId) ?? [])],
      exitTargetIds,
    }),
  );
}

function getMovableTarget(
  targetId: string,
  layout: ExpandedCanvasLayout,
  graph: ExpandedFlowGraph,
): MovableTarget | undefined {
  const node = graph.nodeById.get(targetId);
  if (!node) return undefined;
  const nodeIds = collectExpandedMovableSubtree(targetId, graph, layout.edges);
  const nodes = [...nodeIds]
    .map((nodeId) => graph.nodeById.get(nodeId))
    .filter((item): item is ExpandedCanvasNode => Boolean(item));
  return {
    node,
    nodeIds,
    minX: Math.min(...nodes.map((item) => item.position.x)),
    maxX: Math.max(
      ...nodes.map((item) => item.position.x + item.measured.width),
    ),
  };
}

function getRootOffsets(targets: MovableTarget[]) {
  const offsets = targets.map((target, index) => {
    if (index === 0) return 0;
    const previous = targets[index - 1]!;
    return (
      previous.maxX -
      previous.node.position.x -
      (target.minX - target.node.position.x) +
      TARGET_GAP
    );
  });
  for (let index = 1; index < offsets.length; index += 1) {
    offsets[index] += offsets[index - 1]!;
  }
  return offsets;
}

function orderTargetsAroundExitPivot(
  targets: MovableTarget[],
  exitTargetIds: Set<string>,
) {
  if (targets.length % 2 === 0) return targets;
  const exitIndex = targets.findIndex((target) =>
    exitTargetIds.has(target.node.id),
  );
  if (exitIndex < 0) return targets;
  const ordered = [...targets];
  const [pivot] = ordered.splice(exitIndex, 1);
  ordered.splice(Math.floor(targets.length / 2), 0, pivot!);
  return ordered;
}

function getPivotedRootPositions(sourceX: number, targets: MovableTarget[]) {
  const pivotIndex = Math.floor(targets.length / 2);
  const pivot = targets[pivotIndex]!;
  const positions = new Array<number>(targets.length);
  positions[pivotIndex] = sourceX;

  let cursor = sourceX + (pivot.minX - pivot.node.position.x) - TARGET_GAP;
  for (let index = pivotIndex - 1; index >= 0; index -= 1) {
    const target = targets[index]!;
    const rootX = cursor - (target.maxX - target.node.position.x);
    positions[index] = rootX;
    cursor = rootX + (target.minX - target.node.position.x) - TARGET_GAP;
  }

  cursor = sourceX + (pivot.maxX - pivot.node.position.x) + TARGET_GAP;
  for (let index = pivotIndex + 1; index < targets.length; index += 1) {
    const target = targets[index]!;
    const rootX = cursor - (target.minX - target.node.position.x);
    positions[index] = rootX;
    cursor = rootX + (target.maxX - target.node.position.x) + TARGET_GAP;
  }
  return positions;
}

function getCenteredRootPositions(sourceX: number, targets: MovableTarget[]) {
  const offsets = getRootOffsets(targets);
  const center = (offsets[0]! + offsets[offsets.length - 1]!) / 2;
  return offsets.map((offset) => sourceX + offset - center);
}

export function layoutScopeExitBranches(
  layout: ExpandedCanvasLayout,
  graph: ExpandedFlowGraph,
  verticalGap: number,
) {
  const depthMemo = new Map<string, number>();
  const groups = collectExitTargetGroups(layout, graph).sort(
    (left, right) =>
      getExpandedFlowDepth(
        right.sourceId,
        graph.parents,
        depthMemo,
        new Set(),
      ) -
      getExpandedFlowDepth(left.sourceId, graph.parents, depthMemo, new Set()),
  );

  groups.forEach((group) => {
    const source = graph.nodeById.get(group.sourceId);
    if (!source) return;
    const targetsByPosition = group.targetIds
      .filter((targetId) => (graph.parents.get(targetId)?.size ?? 0) === 1)
      .map((targetId) => getMovableTarget(targetId, layout, graph))
      .filter((target): target is MovableTarget => Boolean(target))
      .sort((left, right) => left.node.position.x - right.node.position.x);
    if (targetsByPosition.length === 0) return;

    const targets = orderTargetsAroundExitPivot(
      targetsByPosition,
      group.exitTargetIds,
    );
    const usesExitPivot =
      targets.length % 2 === 1 &&
      group.exitTargetIds.has(targets[Math.floor(targets.length / 2)]!.node.id);
    const rootPositions = usesExitPivot
      ? getPivotedRootPositions(source.position.x, targets)
      : getCenteredRootPositions(source.position.x, targets);
    targets.forEach((target, index) => {
      const targetY = group.exitTargetIds.has(target.node.id)
        ? source.position.y + verticalGap
        : target.node.position.y;
      moveExpandedNodes(
        target.nodeIds,
        graph,
        rootPositions[index]! - target.node.position.x,
        targetY - target.node.position.y,
      );
    });
  });
}
