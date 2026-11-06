import type {
  ExpandedCanvasEdge,
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
  ExpandedLoopScope,
  LayoutItemId,
  LayoutTimelineItem,
} from "./expandedLayoutTypes";
import type { GraphBranchEdge } from "../../../modules/experiment-graph/types";
import { addExpandedFlowEdges } from "./expandedEdgeFactory";
import {
  getMainLayoutItems,
  sanitizeLayoutTimeline,
} from "./sanitizeLayoutTimeline";
import { getScopedNodeId } from "./scopedNodeId";
import {
  layoutConnectionKey,
  projectLayoutBranches,
} from "./layoutBranchProjection";
import { renderExpandedItem } from "./expandedItemRenderer";
export type RenderedBlock = {
  entryId: string;
  exitIds: string[];
};
type RenderedScope = ExpandedCanvasLayout;
export type ScopeRenderContext = {
  renderScope: (
    scopeId: string,
    timeline: readonly LayoutTimelineItem[],
  ) => RenderedScope;
  nodes: ExpandedCanvasNode[];
  edges: ExpandedCanvasEdge[];
  edgeKeys: Set<string>;
  renderedBlocks: Map<string, RenderedBlock>;
  expandedScopes: Map<string, ExpandedLoopScope>;
  visitedScopeIds: Set<string>;
  branchTargets: Map<string, Set<string>>;
  branchEdges: readonly GraphBranchEdge[];
  scopeParents: Readonly<Record<string, string | null>>;
  scopeOwners: Map<string, string | null>;
  explicitSourceNodes: Set<string>;
  branchBlocks: Map<string, RenderedBlock>;
};

const idKey = (id: LayoutItemId) => String(id);

function renderBranches(
  context: ScopeRenderContext,
  scopeId: string,
  timeline: LayoutTimelineItem[],
  source: LayoutTimelineItem,
  sourceBlock: RenderedBlock,
  path: Set<string>,
  projection: ReturnType<typeof projectLayoutBranches>,
): RenderedBlock {
  const key = getScopedNodeId(scopeId, source.type, source.id);
  const cached = context.branchBlocks.get(key);
  if (cached) return cached;
  const byId = new Map(timeline.map((item) => [idKey(item.id), item]));
  const targets = (projection.targetsBySource.get(idKey(source.id)) ?? [])
    .map((id) => byId.get(idKey(id)))
    .filter((item): item is LayoutTimelineItem => Boolean(item));
  if (targets.length === 0) return sourceBlock;

  const exits: string[] = [];
  targets.forEach((target) => {
    const targetKey = idKey(target.id);
    if (path.has(targetKey)) return;
    const block = renderExpandedItem(context, scopeId, target);
    if (
      !projection.canonicalPairs.has(layoutConnectionKey(source.id, target.id))
    )
      addExpandedFlowEdges(
        context,
        sourceBlock.exitIds,
        block.entryId,
        scopeId,
      );
    const nested = renderBranches(
      context,
      scopeId,
      timeline,
      target,
      block,
      new Set([...path, targetKey]),
      projection,
    );
    exits.push(...nested.exitIds);
  });
  const result = {
    entryId: sourceBlock.entryId,
    exitIds: [...new Set(exits.length > 0 ? exits : sourceBlock.exitIds)],
  };
  context.branchBlocks.set(key, result);
  return result;
}

export function renderExpandedScope(
  context: ScopeRenderContext,
  scopeId: string,
  rawTimeline: readonly LayoutTimelineItem[],
): RenderedScope {
  const timeline = sanitizeLayoutTimeline(rawTimeline);
  const projection = projectLayoutBranches(
    timeline,
    context.scopeOwners.get(scopeId) ?? null,
    context.branchEdges,
    context.scopeParents,
    rawTimeline,
  );
  const targetIds = new Set(
    [...projection.targetsBySource.values()].flat().map(idKey),
  );
  const canonicalTargets = context.branchTargets.get(scopeId) ?? new Set();
  const mainItems = getMainLayoutItems(timeline).filter(
    (item) =>
      !canonicalTargets.has(idKey(item.id)) && !targetIds.has(idKey(item.id)),
  );
  // Cycles can leave no root; render a stable seed so their nodes stay visible.
  if (mainItems.length === 0 && timeline.length > 0)
    mainItems.push(timeline[0]!);
  projection.outgoingSources.forEach((itemId) => {
    const item = timeline.find((candidate) => idKey(candidate.id) === itemId);
    if (item)
      context.explicitSourceNodes.add(
        getScopedNodeId(scopeId, item.type, item.id),
      );
  });
  timeline.forEach((item) => {
    if (item.type === "trial" && item.defaultNextTrialId !== undefined)
      context.explicitSourceNodes.add(
        getScopedNodeId(scopeId, item.type, item.id),
      );
  });
  let previousExits: string[] = [];
  let entryId: string | undefined;

  mainItems.forEach((item) => {
    const block = renderExpandedItem(context, scopeId, item);
    if (!entryId) entryId = block.entryId;
    addExpandedFlowEdges(
      context,
      previousExits.filter((id) => !context.explicitSourceNodes.has(id)),
      block.entryId,
      scopeId,
    );
    const withBranches = renderBranches(
      context,
      scopeId,
      timeline,
      item,
      block,
      new Set([idKey(item.id)]),
      projection,
    );
    previousExits = withBranches.exitIds;
  });

  const detachedTargets = timeline.filter(
    (item) =>
      canonicalTargets.has(idKey(item.id)) &&
      !context.renderedBlocks.has(getScopedNodeId(scopeId, item.type, item.id)),
  );
  detachedTargets.forEach((item) => {
    const block = renderExpandedItem(context, scopeId, item);
    const nested = renderBranches(
      context,
      scopeId,
      timeline,
      item,
      block,
      new Set([idKey(item.id)]),
      projection,
    );
    if (!entryId) entryId = nested.entryId;
    previousExits = [...new Set([...previousExits, ...nested.exitIds])];
  });

  return {
    nodes: context.nodes,
    edges: context.edges,
    entryId,
    exitIds: previousExits,
  };
}
