import type {
  ComposeExpandedLoopLayoutInput,
  ExpandedCanvasLayout,
  ExpandedLoopScope,
} from "./expandedLayoutTypes";
import { layoutScopeGraph } from "./layoutScopeGraph";
import { addExpandedFlowEdges } from "./expandedEdgeFactory";
import { getScopedNodeId } from "./scopedNodeId";
import {
  addCanonicalBranchEdges,
  getCanonicalBranchEdgeId,
  getCanonicalBranchTargets,
} from "./canonicalBranchProjection";
import {
  renderExpandedScope,
  type ScopeRenderContext,
} from "./expandedScopeRenderer";
export { getScopedNodeId } from "./scopedNodeId";
const DEFAULT_MARKER_OFFSET = 260;
const idKey = (id: string | number) => String(id);
const scopeKey = (parentScopeId: string, loopId: string | number) =>
  `${parentScopeId}\u0000${idKey(loopId)}`;
export function composeExpandedLoopLayout({
  rootTimeline,
  expandedScopes,
  branchEdges = [],
  scopeParents = {},
  markerHorizontalOffset = DEFAULT_MARKER_OFFSET,
  entryItemIds,
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
    renderScope: (scopeId, timeline) =>
      renderExpandedScope(context, scopeId, timeline),
    nodes: [],
    edges: [],
    edgeKeys: new Set(),
    renderedBlocks: new Map(),
    expandedScopes: scopeMap,
    visitedScopeIds: new Set(),
    branchTargets: getCanonicalBranchTargets(
      canonicalEdges,
      expandedScopes,
      parents,
    ),
    branchEdges: canonicalEdges,
    scopeParents: parents,
    scopeOwners,
    explicitSourceNodes: new Set(),
    branchBlocks: new Map(),
  };
  const result = context.renderScope("root", rootTimeline);
  context.edgeKeys = addCanonicalBranchEdges(result, canonicalEdges, parents);
  for (const scope of [
    { id: "root", timeline: rootTimeline },
    ...expandedScopes,
  ]) {
    for (const item of scope.timeline) {
      if (item.type !== "loop" || item.nextItemId == null) continue;
      const target = scope.timeline.find(
        (candidate) => idKey(candidate.id) === idKey(item.nextItemId!),
      );
      if (!target) continue;
      const sourceBlock = context.renderedBlocks.get(
        getScopedNodeId(scope.id, "loop", item.id),
      );
      const targetBlock = context.renderedBlocks.get(
        getScopedNodeId(scope.id, target.type, target.id),
      );
      if (sourceBlock && targetBlock)
        addExpandedFlowEdges(
          context,
          sourceBlock.exitIds,
          targetBlock.entryId,
          scope.id,
        );
    }
  }
  const authoredOrders = new Map(
    [rootTimeline, ...expandedScopes.map((scope) => scope.timeline)]
      .flat()
      .map((item) => [
        idKey(item.id),
        new Map((item.branches ?? []).map((id, index) => [idKey(id), index])),
      ]),
  );
  const semanticOrders = new Map(
    canonicalEdges.flatMap((edge) => {
      const order = authoredOrders
        .get(idKey(edge.sourceId))
        ?.get(idKey(edge.targetId));
      return order === undefined
        ? []
        : [[getCanonicalBranchEdgeId(edge), order] as const];
    }),
  );
  return layoutScopeGraph(
    result,
    expandedScopes,
    markerHorizontalOffset,
    entryItemIds,
    rootTimeline,
    semanticOrders,
  );
}
