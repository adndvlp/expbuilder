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
const VERTICAL_GAP = 120,
  BRANCH_GAP = 260;
export type RenderedBlock = {
  entryId: string;
  exitIds: string[];
  maxY: number;
};
type RenderedScope = ExpandedCanvasLayout & { maxY: number };
export type ScopeRenderContext = {
  renderScope: (
    scopeId: string,
    timeline: readonly LayoutTimelineItem[],
    x: number,
    y: number,
  ) => RenderedScope;
  nodes: ExpandedCanvasNode[];
  edges: ExpandedCanvasEdge[];
  edgeKeys: Set<string>;
  renderedBlocks: Map<string, RenderedBlock>;
  expandedScopes: Map<string, ExpandedLoopScope>;
  visitedScopeIds: Set<string>;
  markerOffset: number;
  branchTargets: Map<string, Set<string>>;
  branchEdges: readonly GraphBranchEdge[];
  scopeParents: Readonly<Record<string, string | null>>;
  scopeOwners: Map<string, string | null>;
  explicitSourceNodes: Set<string>;
};

const idKey = (id: LayoutItemId) => String(id);

function renderBranches(
  context: ScopeRenderContext,
  scopeId: string,
  timeline: LayoutTimelineItem[],
  source: LayoutTimelineItem,
  sourceBlock: RenderedBlock,
  x: number,
  y: number,
  path: Set<string>,
  projection: ReturnType<typeof projectLayoutBranches>,
): RenderedBlock {
  const byId = new Map(timeline.map((item) => [idKey(item.id), item]));
  const targets = (projection.targetsBySource.get(idKey(source.id)) ?? [])
    .map((id) => byId.get(idKey(id)))
    .filter((item): item is LayoutTimelineItem => Boolean(item));
  if (targets.length === 0) return sourceBlock;

  const exits: string[] = [];
  let maxY = sourceBlock.maxY;
  targets.forEach((target, index) => {
    const targetKey = idKey(target.id);
    if (path.has(targetKey)) return;
    const branchX = x + (index - (targets.length - 1) / 2) * BRANCH_GAP;
    const block = renderExpandedItem(context, scopeId, target, branchX, y);
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
      branchX,
      Math.max(y, block.maxY) + VERTICAL_GAP,
      new Set([...path, targetKey]),
      projection,
    );
    exits.push(...nested.exitIds);
    maxY = Math.max(maxY, nested.maxY);
  });
  return {
    entryId: sourceBlock.entryId,
    exitIds: [...new Set(exits.length > 0 ? exits : sourceBlock.exitIds)],
    maxY,
  };
}

export function renderExpandedScope(
  context: ScopeRenderContext,
  scopeId: string,
  rawTimeline: readonly LayoutTimelineItem[],
  x: number,
  startY: number,
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
  let previousExits: string[] = [];
  let entryId: string | undefined;
  let y = startY;
  let maxY = startY;

  mainItems.forEach((item) => {
    const sequentialX =
      previousExits.length === 1
        ? (context.nodes.find((node) => node.id === previousExits[0])?.position
            .x ?? x)
        : x;
    const block = renderExpandedItem(context, scopeId, item, sequentialX, y);
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
      sequentialX,
      Math.max(y, block.maxY) + VERTICAL_GAP,
      new Set([idKey(item.id)]),
      projection,
    );
    previousExits = withBranches.exitIds;
    maxY = Math.max(maxY, withBranches.maxY);
    y = withBranches.maxY + VERTICAL_GAP;
  });

  const detachedTargets = timeline.filter(
    (item) =>
      canonicalTargets.has(idKey(item.id)) &&
      !context.renderedBlocks.has(getScopedNodeId(scopeId, item.type, item.id)),
  );
  detachedTargets.forEach((item, index) => {
    const block = renderExpandedItem(
      context,
      scopeId,
      item,
      x + (index + 1) * BRANCH_GAP,
      Math.max(startY, maxY),
    );
    const nested = renderBranches(
      context,
      scopeId,
      timeline,
      item,
      block,
      x + (index + 1) * BRANCH_GAP,
      block.maxY + VERTICAL_GAP,
      new Set([idKey(item.id)]),
      projection,
    );
    if (!entryId) entryId = nested.entryId;
    previousExits = [...new Set([...previousExits, ...nested.exitIds])];
    maxY = Math.max(maxY, nested.maxY);
  });

  return {
    nodes: context.nodes,
    edges: context.edges,
    entryId,
    exitIds: previousExits,
    maxY,
  };
}
