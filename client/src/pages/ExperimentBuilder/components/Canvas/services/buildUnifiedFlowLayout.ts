import type { TimelineItem } from "../../../contexts/TrialsContext";
import type { GraphBranchEdge } from "../../../modules/experiment-graph/types";
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
import { assignBranchColorSlots } from "./assignBranchEdgeColors";
import { getBranchEdgeStroke } from "./branchEdgeTheme";
import {
  getLoopRouteData,
  getLoopScopeLanes,
} from "./loopScopeGeometry";
import { collapseLoopEdgesToCircuits } from "./collapseLoopEdgesToCircuits";

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
  branchEdges?: readonly GraphBranchEdge[];
  scopeParents?: Readonly<Record<string, string | null>>;
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
    branchEdges: input.branchEdges,
    scopeParents: input.scopeParents,
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
  const loopRoutes = getLoopScopeLanes(layout.nodes, expandedScopes);
  const branchColorSlots = assignBranchColorSlots(
    layout.edges,
    input.branchEdges,
  );
  const visualEdges = collapseLoopEdgesToCircuits(
    layout.nodes,
    layout.edges,
  );
  const edges = visualEdges.map((edge) => {
    const isLoopEdge = edge.data.kind === "loop-return";
    const routeData = getLoopRouteData(edge, loopRoutes);
    return {
      ...edge,
      type: isLoopEdge ? "loop" : edge.type,
      data: {
        ...edge.data,
        ...routeData,
      },
      animated: isLoopEdge,
      style: {
        stroke: isLoopEdge
          ? "#2f80ed"
          : getBranchEdgeStroke(branchColorSlots.get(edge.id)),
        strokeWidth: isLoopEdge ? 2 : 1.5,
        strokeDasharray: isLoopEdge ? "6 6" : undefined,
      },
    };
  });
  return { nodes, edges };
}
