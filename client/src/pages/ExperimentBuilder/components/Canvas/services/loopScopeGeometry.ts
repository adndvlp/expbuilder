import type {
  ExpandedCanvasEdge,
  ExpandedCanvasNode,
  ExpandedLoopScope,
} from "./expandedLayoutTypes";

export type LoopRouteData = {
  routeX?: number;
  routeTopY?: number;
  routeBottomY?: number;
};

export type LoopScopeLanes = {
  topY: number;
  bottomY: number;
  rightX: number;
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;
export const LOOP_ROUTE_PADDING = 44;
const NESTING_LANE_GAP = 24;
export const LOOP_NODE_ROUTE_GAP = 20;

type ScopeBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const itemKey = (value: string | number) => String(value);

function getScopeDepth(
  scopeId: string,
  parentByScope: Map<string, string>,
  memo: Map<string, number>,
): number {
  const cached = memo.get(scopeId);
  if (cached !== undefined) return cached;
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
  memo.set(scopeId, depth);
  return depth;
}

function isScopeWithin(
  candidateId: string,
  ownerId: string,
  parentByScope: Map<string, string>,
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

function getScopeBounds(
  nodes: ExpandedCanvasNode[],
  scopeId: string,
  parentByScope: Map<string, string>,
): ScopeBounds | undefined {
  const scopedNodes = nodes.filter((node) =>
    isScopeWithin(node.data.scopeId, scopeId, parentByScope),
  );
  if (scopedNodes.length === 0) return undefined;
  return {
    left: Math.min(...scopedNodes.map((node) => node.position.x)),
    top: Math.min(...scopedNodes.map((node) => node.position.y)),
    right: Math.max(
      ...scopedNodes.map((node) => node.position.x + NODE_WIDTH),
    ),
    bottom: Math.max(
      ...scopedNodes.map((node) => node.position.y + NODE_HEIGHT),
    ),
  };
}

function findScopeMarker(
  nodes: ExpandedCanvasNode[],
  scope: ExpandedLoopScope,
) {
  return nodes.find(
    (node) =>
      node.data.role === "loop-marker" &&
      node.data.scopeId === scope.parentScopeId &&
      itemKey(node.data.itemId) === itemKey(scope.loopId),
  );
}

function getNestedDepth(
  ownerId: string,
  scopes: readonly ExpandedLoopScope[],
  parentByScope: Map<string, string>,
  depthByScope: Map<string, number>,
) {
  const ownerDepth = depthByScope.get(ownerId) ?? 0;
  return Math.max(
    0,
    ...scopes
      .filter((scope) => isScopeWithin(scope.id, ownerId, parentByScope))
      .map((scope) => (depthByScope.get(scope.id) ?? 0) - ownerDepth),
  );
}

export function layoutExpandedLoopMarkers(
  nodes: ExpandedCanvasNode[],
  scopes: readonly ExpandedLoopScope[],
  markerOffset: number,
) {
  const parentByScope = new Map(
    scopes.map((scope) => [scope.id, scope.parentScopeId]),
  );
  const depthMemo = new Map<string, number>();
  const depthByScope = new Map(
    scopes.map((scope) => [
      scope.id,
      getScopeDepth(scope.id, parentByScope, depthMemo),
    ]),
  );

  [...scopes]
    .sort(
      (left, right) =>
        (depthByScope.get(right.id) ?? 0) -
        (depthByScope.get(left.id) ?? 0),
    )
    .forEach((scope) => {
      const marker = findScopeMarker(nodes, scope);
      const bounds = getScopeBounds(nodes, scope.id, parentByScope);
      if (!marker || !bounds) return;
      marker.position = {
        x: bounds.left - markerOffset,
        y: (bounds.top + bounds.bottom - NODE_HEIGHT) / 2,
      };
    });

  return getLoopScopeLanes(nodes, scopes);
}

export function getLoopScopeLanes(
  nodes: ExpandedCanvasNode[],
  scopes: readonly ExpandedLoopScope[],
) {
  const parentByScope = new Map(
    scopes.map((scope) => [scope.id, scope.parentScopeId]),
  );
  const depthMemo = new Map<string, number>();
  const depthByScope = new Map(
    scopes.map((scope) => [
      scope.id,
      getScopeDepth(scope.id, parentByScope, depthMemo),
    ]),
  );
  return new Map(
    scopes.flatMap((scope) => {
      const bounds = getScopeBounds(nodes, scope.id, parentByScope);
      if (!bounds) return [];
      const nestedDepth = getNestedDepth(
        scope.id,
        scopes,
        parentByScope,
        depthByScope,
      );
      const outerClearance =
        LOOP_ROUTE_PADDING + nestedDepth * NESTING_LANE_GAP;
      const lanes: LoopScopeLanes = {
        topY: bounds.top - LOOP_ROUTE_PADDING,
        bottomY: bounds.bottom + outerClearance,
        rightX: bounds.right + outerClearance,
      };
      return [[scope.id, lanes] as const];
    }),
  );
}

export type LoopCircuitHorizontalBounds = {
  left: number;
  right: number;
};

export function getLoopCircuitHorizontalBounds(
  nodes: ExpandedCanvasNode[],
  scopes: readonly ExpandedLoopScope[],
) {
  const routes = getLoopScopeLanes(nodes, scopes);
  return new Map(
    scopes.flatMap((scope) => {
      const marker = findScopeMarker(nodes, scope);
      const route = routes.get(scope.id);
      if (!marker || !route) return [];
      const bounds: LoopCircuitHorizontalBounds = {
        left: marker.position.x,
        right: route.rightX,
      };
      return [[marker.id, bounds] as const];
    }),
  );
}

export function getLoopRouteData(
  edge: ExpandedCanvasEdge,
  routes: ReadonlyMap<string, LoopScopeLanes>,
): LoopRouteData {
  const lanes = routes.get(edge.data.scopeId);
  if (!lanes || edge.data.kind === "flow") return {};
  if (edge.data.kind === "loop-return") {
    return {
      routeX: lanes.rightX,
      routeTopY: lanes.topY,
      routeBottomY: lanes.bottomY,
    };
  }
  return {};
}
