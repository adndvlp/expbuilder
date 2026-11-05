import type {
  ModelState,
  Point,
  ModelComponent,
} from "../../../../../../../shared/experiment-workspace/types";
import type { Node, Edge } from "@xyflow/react";
export type WorkspaceLayout = {
  positions: Record<string, Point>;
  sizes: Record<string, { width: number; height: number }>;
  groups: ModelComponent[];
  flowNodes: Node[];
  flowEdges: Edge[];
};
export function layout(state: ModelState): WorkspaceLayout;
export { insertionEndpoints } from "./insertion";
