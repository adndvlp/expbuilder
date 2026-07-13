import { Loop, Trial } from "../../ConfigurationPanel/types";
import { LayoutEdge, LayoutNode } from "../utils/layoutUtils";

export type FlowLayoutOptions = {
  timeline: any[];
  selectedTrialId?: string | number;
  selectedLoopId?: string | number;
  openLoopId?: string | number;
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: any) => void;
  onAddBranch: (id: number | string) => void;
  onOpenLoop?: (loopId: string) => void;
};

export type BranchRendererContext = FlowLayoutOptions & {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  renderedItems: Map<number | string, string>;
  branchHorizontalSpacing: number;
  branchVerticalOffset: number;
};

export type BranchRenderer = (
  item: Trial | Loop,
  parentId: string,
  x: number,
  y: number,
  depth?: number,
) => number;
