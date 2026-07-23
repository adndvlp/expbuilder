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
import {
  addExpandedEdge,
  addExpandedFlowEdges,
} from "./expandedEdgeFactory";
import {
  getMainLayoutItems,
  sanitizeLayoutTimeline,
} from "./sanitizeLayoutTimeline";
import { finalizeExpandedLayout } from "./finalizeExpandedLayout";
const ROOT_X = 500;
const ROOT_Y = 80;
const VERTICAL_GAP = 120;
const BRANCH_GAP = 260;
const DEFAULT_MARKER_OFFSET = 260;
type RenderedBlock = {
  entryId: string;
  exitIds: string[];
  maxY: number;
};
type RenderedScope = ExpandedCanvasLayout & { maxY: number };
type ScopeRenderContext = {
  nodes: ExpandedCanvasNode[];
  edges: ExpandedCanvasEdge[];
  edgeKeys: Set<string>;
  renderedBlocks: Map<string, RenderedBlock>;
  expandedScopes: Map<string, ExpandedLoopScope>;
  visitedScopeIds: Set<string>;
  markerOffset: number;
};

const idKey = (id: LayoutItemId) => String(id);
const scopeKey = (parentScopeId: string, loopId: LayoutItemId) =>
  `${parentScopeId}\u0000${idKey(loopId)}`;

export const getScopedNodeId = (
  scopeId: string,
  type: LayoutTimelineItem["type"],
  itemId: LayoutItemId,
) =>
  `${encodeURIComponent(scopeId)}::${type}::${encodeURIComponent(String(itemId))}`;

function createItemNode(
  context: ScopeRenderContext,
  scopeId: string,
  item: LayoutTimelineItem,
  x: number,
  y: number,
  expanded: boolean,
) {
  const id = getScopedNodeId(scopeId, item.type, item.id);
  context.nodes.push({
    id,
    type: item.type,
    data: {
      scopeId,
      itemId: item.id,
      name: item.name,
      role: expanded ? "loop-marker" : "item",
      expanded,
    },
    position: { x, y },
    draggable: false,
  });
  return id;
}

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
    createItemNode(context, scopeId, item, x, y, false);
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
  const markerId = createItemNode(
    context,
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

  const loopExitId = inner.exitIds.at(-1)!;
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
  const mainItems = getMainLayoutItems(timeline);
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
  };
  const result: ExpandedCanvasLayout = renderScope(
    context,
    "root",
    rootTimeline,
    ROOT_X,
    ROOT_Y,
  );
  return finalizeExpandedLayout(result, VERTICAL_GAP);
}
