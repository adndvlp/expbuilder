import type { LayoutTimelineItem } from "./expandedLayoutTypes";
import type {
  RenderedBlock,
  ScopeRenderContext,
} from "./expandedScopeRenderer";
import { CANVAS_EDGE_HANDLES } from "./canvasHandleIds";
import { addExpandedEdge } from "./expandedEdgeFactory";
import { createExpandedItemNode } from "./expandedNodeFactory";
import { getScopedNodeId } from "./scopedNodeId";
const scopeKey = (parentScopeId: string, loopId: string | number) =>
  `${parentScopeId}\u0000${String(loopId)}`;
export function renderExpandedItem(
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
  const inner = context.renderScope(
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
