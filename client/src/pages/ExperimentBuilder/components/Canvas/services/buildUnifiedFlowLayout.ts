import type { TimelineItem } from "../../../contexts/TrialsContext";
import type {
  ExpandedLoopEntry,
  LoopScopeId,
} from "../hooks/useExpandedLoopPath";
import { composeExpandedLoopLayout } from "./composeExpandedLoopLayout";
import { ROOT_CANVAS_SCOPE_ID } from "./expandedLayoutTypes";
import type {
  ExpandedCanvasNodeData,
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
  const deepestLoop = Math.max(0, input.expandedPath.length - 1);
  const loopDepths = new Map(
    input.expandedPath.map((entry, depth) => [
      getLoopLayoutScopeId(entry.loop.id),
      depth,
    ]),
  );
  const edges = layout.edges.map((edge) => {
    const isReturn = edge.data.kind === "loop-return";
    const isLoopEdge = isReturn || edge.data.kind === "loop-control";
    const depth = loopDepths.get(edge.data.scopeId) ?? deepestLoop;
    return {
      ...edge,
      animated: isReturn,
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
