import type { TimelineItem } from "../../../contexts/TrialsContext";
import type {
  ExpandedLoopEntry,
  LoopScopeId,
} from "../hooks/useExpandedLoopPath";
import { composeExpandedLoopLayout } from "./composeExpandedLoopLayout";
import { CANVAS_HANDLE_IDS } from "./canvasHandleIds";
import { ROOT_CANVAS_SCOPE_ID } from "./expandedLayoutTypes";
import type {
  ExpandedCanvasEdge,
  ExpandedCanvasNodeData,
  ExpandedCanvasNode,
  LayoutTimelineItem,
} from "./expandedLayoutTypes";

export type UnifiedCanvasNodeData = ExpandedCanvasNodeData & {
  selected: boolean;
  loading: boolean;
  onClick: () => void;
  onAddBranch?: () => void;
  onOpenLoop?: () => void;
};

type BuildUnifiedFlowLayoutInput = {
  timeline: TimelineItem[];
  expandedPath: ExpandedLoopEntry[];
  selectedItemId: string | number | null;
  selectedScopeId: LoopScopeId | null;
  pendingLoopId?: LoopScopeId | null;
  onSelectTrial: (trial: TimelineItem, scopeId: LoopScopeId | null) => void;
  onSelectLoop: (loop: TimelineItem, scopeId: LoopScopeId | null) => void;
  onToggleLoop: (loop: TimelineItem, scopeId: LoopScopeId | null) => void;
  onAddBranch: (itemId: string | number, scopeId: LoopScopeId | null) => void;
};

const itemKey = (id: string | number) => String(id);
const CANVAS_NODE_WIDTH = 180;
const CANVAS_NODE_HEIGHT = 50;
const LOOP_ROUTE_PADDING = 44;
const LOOP_CONTROL_OFFSET = 36;
const LOOP_ENTRY_CLEARANCE = 44;
const LOOP_UPPER_HANDLE_RATIO = 0.32;
const idsMatch = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
) => left != null && right != null && itemKey(left) === itemKey(right);

export const getLoopLayoutScopeId = (loopId: LoopScopeId) =>
  `loop-scope:${encodeURIComponent(String(loopId))}`;

function toLayoutScopeId(scopeId: LoopScopeId | null) {
  return scopeId === null
    ? ROOT_CANVAS_SCOPE_ID
    : getLoopLayoutScopeId(scopeId);
}

function getLoopRouteBounds(
  nodes: ExpandedCanvasNode[],
  scopeIds: string[],
) {
  return new Map(
    scopeIds.map((scopeId, depth) => {
      const descendantScopes = new Set(scopeIds.slice(depth));
      const scopedNodes = nodes.filter((node) =>
        descendantScopes.has(node.data.scopeId),
      );
      const right = Math.max(
        0,
        ...scopedNodes.map((node) => node.position.x + CANVAS_NODE_WIDTH),
      );
      const nestingOffset = (scopeIds.length - depth - 1) * 24;
      return [scopeId, right + LOOP_ROUTE_PADDING + nestingOffset] as const;
    }),
  );
}

function getLoopEntryRouteY(
  edge: ExpandedCanvasEdge,
  nodes: ExpandedCanvasNode[],
  nodeById: Map<string, ExpandedCanvasNode>,
) {
  if (
    edge.data.kind !== "loop-control" ||
    edge.sourceHandle !== CANVAS_HANDLE_IDS.loopEntrySource
  ) {
    return undefined;
  }
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  if (!source || !target) return undefined;
  const connectionY =
    source.position.y + CANVAS_NODE_HEIGHT * LOOP_UPPER_HANDLE_RATIO;
  const laneX =
    target.position.x + CANVAS_NODE_WIDTH + LOOP_CONTROL_OFFSET;
  const left = Math.min(laneX, source.position.x);
  const right = Math.max(laneX, source.position.x);
  const blockers = nodes.filter(
    (node) =>
      node.id !== source.id &&
      node.id !== target.id &&
      node.position.x < right &&
      node.position.x + CANVAS_NODE_WIDTH > left &&
      node.position.y < connectionY &&
      node.position.y + CANVAS_NODE_HEIGHT > connectionY,
  );
  if (blockers.length === 0) return undefined;
  return (
    Math.min(
      source.position.y,
      target.position.y,
      ...blockers.map((node) => node.position.y),
    ) - LOOP_ENTRY_CLEARANCE
  );
}

export function buildUnifiedFlowLayout(input: BuildUnifiedFlowLayoutInput) {
  const scopeItems = new Map<string, TimelineItem[]>([
    [ROOT_CANVAS_SCOPE_ID, input.timeline],
  ]);
  const domainScopes = new Map<string, LoopScopeId | null>([
    [ROOT_CANVAS_SCOPE_ID, null],
  ]);
  const expandedScopes = input.expandedPath.map((entry) => {
    const id = getLoopLayoutScopeId(entry.loop.id);
    scopeItems.set(id, entry.items);
    domainScopes.set(id, entry.loop.id);
    return {
      id,
      parentScopeId: toLayoutScopeId(entry.loop.parentLoopId),
      loopId: entry.loop.id,
      timeline: entry.items as LayoutTimelineItem[],
    };
  });
  const selectedLayoutScopeId = toLayoutScopeId(input.selectedScopeId);
  const layout = composeExpandedLoopLayout({
    rootTimeline: input.timeline,
    expandedScopes,
  });

  const nodes = layout.nodes.map((node) => {
    const item = scopeItems
      .get(node.data.scopeId)
      ?.find((candidate) => idsMatch(candidate.id, node.data.itemId));
    if (!item) return node;
    const domainScopeId = domainScopes.get(node.data.scopeId) ?? null;
    const selected =
      node.data.scopeId === selectedLayoutScopeId &&
      idsMatch(item.id, input.selectedItemId);
    const data: UnifiedCanvasNodeData = {
      ...node.data,
      selected,
      loading: idsMatch(input.pendingLoopId, item.id),
      onClick: () => {
        if (item.type === "trial") input.onSelectTrial(item, domainScopeId);
        else input.onSelectLoop(item, domainScopeId);
      },
      onAddBranch: selected
        ? () => input.onAddBranch(item.id, domainScopeId)
        : undefined,
      onOpenLoop:
        item.type === "loop"
          ? () => input.onToggleLoop(item, domainScopeId)
          : undefined,
    };
    return { ...node, data };
  });
  const expandedScopeIds = input.expandedPath.map((entry) =>
    getLoopLayoutScopeId(entry.loop.id),
  );
  const deepestLoop = Math.max(0, expandedScopeIds.length - 1);
  const loopDepths = new Map(
    expandedScopeIds.map((scopeId, depth) => [scopeId, depth]),
  );
  const routeBounds = getLoopRouteBounds(layout.nodes, expandedScopeIds);
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const edges = layout.edges.map((edge) => {
    const isReturn = edge.data.kind === "loop-return";
    const isLoopEdge = isReturn || edge.data.kind === "loop-control";
    const depth = loopDepths.get(edge.data.scopeId) ?? deepestLoop;
    const routeX = isReturn
      ? routeBounds.get(edge.data.scopeId)
      : undefined;
    const routeY = getLoopEntryRouteY(edge, layout.nodes, nodeById);
    return {
      ...edge,
      type: isLoopEdge ? "loop" : edge.type,
      data: {
        ...edge.data,
        routeX,
        routeY,
      },
      animated: isLoopEdge,
      pathOptions: isLoopEdge
        ? {
            borderRadius: 16,
            offset: isReturn ? 44 + (deepestLoop - depth) * 24 : 24,
          }
        : undefined,
      style: {
        stroke: isLoopEdge ? "#2f80ed" : "#aeb6c2",
        strokeWidth: isLoopEdge ? 2 : 1.5,
      },
    };
  });
  return { nodes, edges };
}
