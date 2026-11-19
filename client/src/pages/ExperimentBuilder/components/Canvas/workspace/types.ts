import type { Node, Edge } from "@xyflow/react";
import type {
  ExpandedCanvasNodeData,
  ExpandedCanvasEdge,
  CanvasCubic,
} from "../services/expandedLayoutTypes";
import type {
  ModelState,
  ModelComponent,
  Point,
  Pair,
  LoopLevel,
  StructureEndpoints,
  InsertionResult,
} from "../../../../../../../shared/experiment-workspace/dist/types.js";
import type { WorkspaceCommandResponse } from "../../../modules/experiment-workspace/types";
import type {
  CommandKind,
  CommandArgs,
} from "../../../../../../../shared/experiment-workspace/dist/commandTypes.js";
export type { WorkspaceSelection } from "../../../modules/experiment-workspace/selection";
export type WorkspaceNodeData = ExpandedCanvasNodeData & {
  free?: boolean;
  partial?: boolean;
  pendingRoot?: boolean;
  loop?: boolean;
  selected?: boolean;
  multiple?: boolean;
  ghost?: boolean;
  isEntry?: boolean;
  width?: number;
  height?: number;
  onCheck?: (id: string, checked?: boolean) => void;
  onAdd?: (id: string) => void;
  onToggle?: (id: string) => void;
};
export type WorkspaceNode = Node<WorkspaceNodeData, "trial" | "loop"> & {
  type: "trial" | "loop";
  measured: { width: number; height: number };
};
export type WorkspaceEdgeData = ExpandedCanvasEdge["data"] & {
  routeX?: number;
  routeTopY?: number;
  routeBottomY?: number;
  semantics?: string[];
  semantic?: string | null;
  selectionId?: string;
  control?: boolean;
  editable?: boolean;
  boundary?: boolean;
  canReconnect?: boolean;
};
export type WorkspaceEdge = Edge<WorkspaceEdgeData> & {
  sourceHandle: string;
  targetHandle: string;
  data: WorkspaceEdgeData;
};
export type WorkspaceLayout = {
  positions: Record<string, Point>;
  sizes: Record<string, { width: number; height: number }>;
  componentIds: Record<string, string>;
  groups: ModelComponent[];
  boxes: never[];
  flowNodes: WorkspaceNode[];
  flowEdges: WorkspaceEdge[];
};
export type Projection = { nodes: WorkspaceNode[]; edges: WorkspaceEdge[] };
export type Offset = { ids: Set<string>; dx: number; dy: number };
export type Candidate = {
  sourceId: string;
  targetId: string;
  mode: "parallel" | "sequential";
  side: "left" | "right";
  distance: number;
  junction?: boolean;
};
export type Proposal = InsertionResult & {
  state: ModelState;
  layout: WorkspaceLayout;
  candidate?: Candidate;
};
export type ConnectionRequest = Pair & {
  previous?: Pair;
  edgeRefs?: string[];
  endpoints?: StructureEndpoints | null;
};
export type BranchRequest = {
  parentId: string;
  revision?: string;
  connection?: ConnectionRequest;
};
export type ConnectionModal = BranchRequest & { scopeId?: string | null } & (
    | { type: "level"; levels: LoopLevel[] }
    | { type: "placement" }
  );
export type Execute = <K extends CommandKind>(
  kind: K,
  args: CommandArgs[K],
  revision?: string,
) => Promise<WorkspaceCommandResponse<K> | null>;
export function translateCurve(
  curve: CanvasCubic[],
  dx: number,
  dy: number,
): CanvasCubic[] {
  const move = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  return curve.map((c) => ({
    start: move(c.start),
    control1: move(c.control1),
    control2: move(c.control2),
    end: move(c.end),
  }));
}
