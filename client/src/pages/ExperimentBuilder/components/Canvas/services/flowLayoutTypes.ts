import type { TimelineItem } from "../../../contexts/TrialsContext";
import { Trial } from "../../ConfigurationPanel/types";
import { LayoutEdge, LayoutNode } from "../utils/layoutUtils";

export type FlowLayoutOptions = {
  timeline: TimelineItem[];
  selectedTrialId?: string | number;
  selectedLoopId?: string | number;
  openLoopId?: string | number;
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: TimelineItem) => void;
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
