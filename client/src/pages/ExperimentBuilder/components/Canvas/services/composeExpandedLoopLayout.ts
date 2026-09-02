import type {
  ComposeExpandedLoopLayoutInput,
  ExpandedCanvasEdge,
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
  ExpandedLoopScope,
  LayoutItemId,
  LayoutTimelineItem,
} from "./expandedLayoutTypes";
import { CANVAS_EDGE_HANDLES } from "./canvasHandleIds";
import { addExpandedEdge, addExpandedFlowEdges } from "./expandedEdgeFactory";
import { getMainLayoutItems, sanitizeLayoutTimeline } from "./sanitizeLayoutTimeline";
import { finalizeExpandedLoopLayout } from "./finalizeExpandedLoopLayout";
import { getScopedNodeId } from "./scopedNodeId";
import { createExpandedItemNode } from "./expandedNodeFactory";
import {
  addCanonicalBranchEdges,
  getCanonicalBranchTargets,
} from "./canonicalBranchProjection";
export { getScopedNodeId } from "./scopedNodeId";
const ROOT_X = 500, ROOT_Y = 80;
const VERTICAL_GAP = 120, BRANCH_GAP = 260;
const DEFAULT_MARKER_OFFSET = 260;
type RenderedBlock = { entryId: string; exitIds: string[]; maxY: number };
type RenderedScope = ExpandedCanvasLayout & { maxY: number };
type ScopeRenderContext = {
  nodes: ExpandedCanvasNode[];
  edges: ExpandedCanvasEdge[];
  edgeKeys: Set<string>;
  renderedBlocks: Map<string, RenderedBlock>;
  expandedScopes: Map<string, ExpandedLoopScope>;
  visitedScopeIds: Set<string>;
  markerOffset: number;
  branchTargets: Map<string, Set<string>>;
};

const idKey = (id: LayoutItemId) => String(id);
const scopeKey = (parentScopeId: string, loopId: LayoutItemId) =>
  `${parentScopeId}\u0000${idKey(loopId)}`;

function renderItem(
  context: ScopeRenderContext,
  scopeId: string,
  item: LayoutTimelineItem,
  x: number,
  y: number,
): RenderedBlock {
  const nodeId = getScopedNodeId(scopeId, item.type, item.id);
  const cached = context.renderedBlocks.get(nodeId);
  if (cached) return cached;

  const expandedScope =
    item.type === "loop"
      ? context.expandedScopes.get(scopeKey(scopeId, item.id))
      : undefined;
  const canExpand =
    expandedScope &&
    expandedScope.timeline.length > 0 &&
    !context.visitedScopeIds.has(expandedScope.id);

  if (!canExpand || !expandedScope) {
    createExpandedItemNode(context.nodes, scopeId, item, x, y, false);
    const block = { entryId: nodeId, exitIds: [nodeId], maxY: y };
    context.renderedBlocks.set(nodeId, block);
    return block;
  }

  context.visitedScopeIds.add(expandedScope.id);
  const innerNodeStart = context.nodes.length;
  const inner = renderScope(
    context,
    expandedScope.id,
    expandedScope.timeline,
    x,
    y,
  );
  context.visitedScopeIds.delete(expandedScope.id);
  const innerMinX = Math.min(
    x,
    ...context.nodes.slice(innerNodeStart).map((node) => node.position.x),
  );
  const markerId = createExpandedItemNode(
    context.nodes,
    scopeId,
    item,
    innerMinX - context.markerOffset,
    inner.entryId ? (y + inner.maxY) / 2 : y,
    true,
  );

  if (!inner.entryId) {
    const block = { entryId: markerId, exitIds: [markerId], maxY: y };
    context.renderedBlocks.set(nodeId, block);
    return block;
  }

  const loopExitId = inner.exitIds[inner.exitIds.length - 1]!;
  if (loopExitId === inner.entryId) {
    addExpandedEdge(
      context,
      markerId,
      markerId,
      "loop-return",
      expandedScope.id,
      CANVAS_EDGE_HANDLES.singleItemLoop,
    );
  } else {
    addExpandedEdge(
      context,
      inner.entryId,
      markerId,
      "loop-control",
      expandedScope.id,
      CANVAS_EDGE_HANDLES.loopEntry,
    );
    addExpandedEdge(
      context,
      markerId,
      loopExitId,
      "loop-control",
      expandedScope.id,
      CANVAS_EDGE_HANDLES.loopExit,
    );
    addExpandedEdge(
      context,
      loopExitId,
      inner.entryId,
      "loop-return",
      expandedScope.id,
      CANVAS_EDGE_HANDLES.loopReturn,
    );
  }
  const block = {
    entryId: inner.entryId,
    exitIds: inner.exitIds,
    maxY: inner.maxY,
  };
  context.renderedBlocks.set(nodeId, block);
  return block;
}

function renderBranches(
  context: ScopeRenderContext,
  scopeId: string,
  timeline: LayoutTimelineItem[],
  source: LayoutTimelineItem,
  sourceBlock: RenderedBlock,
  x: number,
  y: number,
  path: Set<string>,
): RenderedBlock {
  const byId = new Map(timeline.map((item) => [idKey(item.id), item]));
  const targets = (source.branches ?? [])
    .map((id) => byId.get(idKey(id)))
    .filter((item): item is LayoutTimelineItem => Boolean(item));
  if (targets.length === 0) return sourceBlock;

  const exits: string[] = [];
  let maxY = sourceBlock.maxY;
  targets.forEach((target, index) => {
    const targetKey = idKey(target.id);
    if (path.has(targetKey)) return;
    const branchX = x + (index - (targets.length - 1) / 2) * BRANCH_GAP;
    const block = renderItem(context, scopeId, target, branchX, y);
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

function renderScope(
  context: ScopeRenderContext,
  scopeId: string,
  rawTimeline: readonly LayoutTimelineItem[],
  x: number,
  startY: number,
): RenderedScope {
  const timeline = sanitizeLayoutTimeline(rawTimeline);
  const canonicalTargets = context.branchTargets.get(scopeId) ?? new Set();
  const mainItems = getMainLayoutItems(timeline).filter(
    (item) => !canonicalTargets.has(idKey(item.id)),
  );
  let previousExits: string[] = [];
  let entryId: string | undefined;
  let y = startY;
  let maxY = startY;

  mainItems.forEach((item) => {
    const block = renderItem(context, scopeId, item, x, y);
    if (!entryId) entryId = block.entryId;
    addExpandedFlowEdges(context, previousExits, block.entryId, scopeId);
    const withBranches = renderBranches(
      context,
      scopeId,
      timeline,
      item,
      block,
      x,
      Math.max(y, block.maxY) + VERTICAL_GAP,
      new Set([idKey(item.id)]),
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
    const block = renderItem(
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

export function composeExpandedLoopLayout({
  rootTimeline,
  expandedScopes,
  branchEdges = [],
  scopeParents = {},
  markerHorizontalOffset = DEFAULT_MARKER_OFFSET,
}: ComposeExpandedLoopLayoutInput): ExpandedCanvasLayout {
  const scopeMap = new Map<string, ExpandedLoopScope>();
  expandedScopes.forEach((scope) => {
    const key = scopeKey(scope.parentScopeId, scope.loopId);
    if (!scopeMap.has(key)) scopeMap.set(key, scope);
  });
  const context: ScopeRenderContext = {
    nodes: [],
    edges: [],
    edgeKeys: new Set(),
    renderedBlocks: new Map(),
    expandedScopes: scopeMap,
    visitedScopeIds: new Set(),
    markerOffset: markerHorizontalOffset,
    branchTargets: getCanonicalBranchTargets(branchEdges, expandedScopes),
  };
  const result: ExpandedCanvasLayout = renderScope(
    context,
    "root",
    rootTimeline,
    ROOT_X,
    ROOT_Y,
  );
  addCanonicalBranchEdges(result, branchEdges, scopeParents, context.renderedBlocks);
  return finalizeExpandedLoopLayout({
    layout: result,
    scopes: expandedScopes,
    markerOffset: markerHorizontalOffset,
    verticalGap: VERTICAL_GAP,
  });
}
