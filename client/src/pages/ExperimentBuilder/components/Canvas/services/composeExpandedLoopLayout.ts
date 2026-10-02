import type {
  ComposeExpandedLoopLayoutInput,
  ExpandedCanvasLayout,
  ExpandedLoopScope,
} from "./expandedLayoutTypes";
import { finalizeExpandedLoopLayout } from "./finalizeExpandedLoopLayout";
import {
  addCanonicalBranchEdges,
  getCanonicalBranchTargets,
} from "./canonicalBranchProjection";
import {
  renderExpandedScope,
  type ScopeRenderContext,
} from "./expandedScopeRenderer";
export { getScopedNodeId } from "./scopedNodeId";
const ROOT_X = 500,
  ROOT_Y = 80,
  VERTICAL_GAP = 120,
  DEFAULT_MARKER_OFFSET = 260;
const idKey = (id: string | number) => String(id);
const scopeKey = (parentScopeId: string, loopId: string | number) =>
  `${parentScopeId}\u0000${idKey(loopId)}`;
export function composeExpandedLoopLayout({
  rootTimeline,
  expandedScopes,
  branchEdges = [],
  scopeParents = {},
  markerHorizontalOffset = DEFAULT_MARKER_OFFSET,
}: ComposeExpandedLoopLayoutInput): ExpandedCanvasLayout {
  const loopIds = new Set([
    ...Object.keys(scopeParents),
    ...expandedScopes.map((scope) => idKey(scope.loopId)),
    ...[rootTimeline, ...expandedScopes.map((scope) => scope.timeline)]
      .flat()
      .filter((item) => item.type === "loop")
      .map((item) => idKey(item.id)),
  ]);
  const canonicalEdges = branchEdges.filter(
    (edge) =>
      !loopIds.has(idKey(edge.sourceId)) && !loopIds.has(idKey(edge.targetId)),
  );
  const parents = { ...scopeParents };
  const scopeOwners = new Map<string, string | null>([
    ["root", null],
    ...expandedScopes.map((scope) => [scope.id, idKey(scope.loopId)] as const),
  ]);
  expandedScopes.forEach((scope) => {
    parents[idKey(scope.loopId)] = scopeOwners.get(scope.parentScopeId) ?? null;
  });
  const scopeMap = new Map<string, ExpandedLoopScope>();
  expandedScopes.forEach((scope) => {
    const key = scopeKey(scope.parentScopeId, scope.loopId);
    if (!scopeMap.has(key)) scopeMap.set(key, scope);
  });
  const context: ScopeRenderContext = {
    renderScope: (scopeId, timeline, x, y) =>
      renderExpandedScope(context, scopeId, timeline, x, y),
    nodes: [],
    edges: [],
    edgeKeys: new Set(),
    renderedBlocks: new Map(),
    expandedScopes: scopeMap,
    visitedScopeIds: new Set(),
    markerOffset: markerHorizontalOffset,
    branchTargets: getCanonicalBranchTargets(
      canonicalEdges,
      expandedScopes,
      parents,
    ),
    branchEdges: canonicalEdges,
    scopeParents: parents,
    scopeOwners,
    explicitSourceNodes: new Set(),
  };
  const result = context.renderScope("root", rootTimeline, ROOT_X, ROOT_Y);
  addCanonicalBranchEdges(result, canonicalEdges, parents);
  return finalizeExpandedLoopLayout({
    layout: result,
    scopes: expandedScopes,
    markerOffset: markerHorizontalOffset,
    verticalGap: VERTICAL_GAP,
  });
}
