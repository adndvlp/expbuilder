export const ROOT_CANVAS_SCOPE_ID = "root";

export type LayoutItemId = string | number;

export type LayoutTimelineItem = {
  id: LayoutItemId;
  type: "trial" | "loop";
  name: string;
  branches?: readonly LayoutItemId[];
  trials?: readonly LayoutItemId[];
  parentLoopId?: string | null;
};

export type ExpandedLoopScope = {
  id: string;
  parentScopeId: string;
  loopId: LayoutItemId;
  timeline: readonly LayoutTimelineItem[];
};

export type ExpandedCanvasNodeRole = "item" | "loop-marker";

export type ExpandedCanvasNodeData = {
  scopeId: string;
  itemId: LayoutItemId;
  name: string;
  role: ExpandedCanvasNodeRole;
  expanded: boolean;
};

export type ExpandedCanvasNode = {
  id: string;
  type: "trial" | "loop";
  data: ExpandedCanvasNodeData;
  position: { x: number; y: number };
  draggable: false;
};

export type ExpandedCanvasEdgeKind =
  | "flow"
  | "loop-control"
  | "loop-return";

export type ExpandedCanvasEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type: "default" | "smoothstep";
  data: {
    kind: ExpandedCanvasEdgeKind;
    scopeId: string;
  };
};

export type ExpandedCanvasLayout = {
  nodes: ExpandedCanvasNode[];
  edges: ExpandedCanvasEdge[];
  entryId?: string;
  exitIds: string[];
};

export type ComposeExpandedLoopLayoutInput = {
  rootTimeline: readonly LayoutTimelineItem[];
  expandedScopes: readonly ExpandedLoopScope[];
  markerHorizontalOffset?: number;
};
