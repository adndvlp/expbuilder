import type {
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
  ExpandedLoopScope,
} from "./expandedLayoutTypes";
import {
  getLoopScopeLanes,
  LOOP_NODE_ROUTE_GAP,
} from "./loopScopeGeometry";

const addChild = (
  children: Map<string, Set<string>>,
  source: string,
  target: string,
) => {
  const targets = children.get(source) ?? new Set<string>();
  targets.add(target);
  children.set(source, targets);
};

function isScopeWithin(
  candidateId: string,
  ownerId: string,
  parentByScope: ReadonlyMap<string, string>,
) {
  let currentId: string | undefined = candidateId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    if (currentId === ownerId) return true;
    visited.add(currentId);
    currentId = parentByScope.get(currentId);
  }
  return false;
}

function getScopeDepth(
  scopeId: string,
  parentByScope: ReadonlyMap<string, string>,
) {
  let depth = 0;
  let currentId: string | undefined = scopeId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const parentId = parentByScope.get(currentId);
    if (!parentId || !parentByScope.has(parentId)) break;
    depth += 1;
    currentId = parentId;
  }
  return depth;
}

function collectDownstream(
  targetIds: readonly string[],
  children: ReadonlyMap<string, Set<string>>,
) {
  const downstream = new Set(targetIds);
  const queue = [...targetIds];
  while (queue.length > 0) {
    const sourceId = queue.shift()!;
    (children.get(sourceId) ?? []).forEach((targetId) => {
      if (downstream.has(targetId)) return;
      downstream.add(targetId);
      queue.push(targetId);
    });
  }
  return downstream;
}

function moveNodesDown(
  nodeById: ReadonlyMap<string, ExpandedCanvasNode>,
  nodeIds: ReadonlySet<string>,
  distance: number,
) {
  nodeIds.forEach((nodeId) => {
    const node = nodeById.get(nodeId);
    if (!node) return;
    node.position = {
      x: node.position.x,
      y: node.position.y + distance,
    };
  });
}

export function reserveLoopRouteClearance(
  layout: ExpandedCanvasLayout,
  scopes: readonly ExpandedLoopScope[],
) {
  const parentByScope = new Map(
    scopes.map((scope) => [scope.id, scope.parentScopeId]),
  );
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const flowEdges = layout.edges.filter((edge) => edge.data.kind === "flow");
  const children = new Map<string, Set<string>>();
  flowEdges.forEach((edge) => addChild(children, edge.source, edge.target));

  [...scopes]
    .sort(
      (left, right) =>
        getScopeDepth(right.id, parentByScope) -
        getScopeDepth(left.id, parentByScope),
    )
    .forEach((scope) => {
      const lane = getLoopScopeLanes(layout.nodes, scopes).get(scope.id);
      if (!lane) return;
      const targetIds = flowEdges.flatMap((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) return [];
        const exitsScope =
          isScopeWithin(source.data.scopeId, scope.id, parentByScope) &&
          !isScopeWithin(target.data.scopeId, scope.id, parentByScope);
        return exitsScope ? [target.id] : [];
      });
      if (targetIds.length === 0) return;
      const requiredTop = lane.bottomY + LOOP_NODE_ROUTE_GAP;
      const distance = Math.max(
        0,
        ...targetIds.map(
          (targetId) =>
            requiredTop - (nodeById.get(targetId)?.position.y ?? requiredTop),
        ),
      );
      if (distance === 0) return;
      moveNodesDown(
        nodeById,
        collectDownstream(targetIds, children),
        distance,
      );
    });

  return layout;
}
