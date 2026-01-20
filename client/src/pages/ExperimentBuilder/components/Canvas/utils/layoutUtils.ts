import { Trial } from "../../ConfigurationPanel/types";
import { isTrial, findItemById } from "./trialUtils";

export const LAYOUT_CONSTANTS = {
  xTrial: 250,
  yStep: 100,
  branchHorizontalSpacing: 200,
  branchVerticalOffset: 100,
};

export interface LayoutNode {
  id: string;
  type: string;
  data: any;
  position: { x: number; y: number };
  draggable: boolean;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

export function calculateBranchWidth(
  branchId: number | string,
  trials: any[],
  branchHorizontalSpacing: number,
): number {
  const item = findItemById(trials, branchId);
  if (!item) return branchHorizontalSpacing;

  if (isTrial(item)) {
    const branchTrial = item as Trial;
    if (!branchTrial.branches || branchTrial.branches.length === 0) {
      return branchHorizontalSpacing;
    }

    const subBranchesWidth = branchTrial.branches.reduce(
      (total: number, subBranchId: number | string) => {
        return (
          total +
          calculateBranchWidth(subBranchId, trials, branchHorizontalSpacing)
        );
      },
      0,
    );

    return Math.max(branchHorizontalSpacing, subBranchesWidth);
  } else {
    return branchHorizontalSpacing;
  }
}

export function createTrialNode(
  id: string,
  name: string,
  x: number,
  y: number,
  isSelected: boolean,
  onClick: () => void,
  onAddBranch?: () => void,
): LayoutNode {
  return {
    id,
    type: "trial",
    data: {
      name,
      selected: isSelected,
      onAddBranch: isSelected ? onAddBranch : undefined,
      onClick,
    },
    position: { x, y },
    draggable: false,
  };
}

export function createLoopNode(
  id: string,
  name: string,
  x: number,
  y: number,
  isSelected: boolean,
  onClick: () => void,
  onAddBranch?: () => void,
  onOpenLoop?: () => void,
): LayoutNode {
  return {
    id,
    type: "loop",
    data: {
      name,
      selected: isSelected,
      onAddBranch: isSelected ? onAddBranch : undefined,
      onOpenLoop,
      onClick,
    },
    position: { x, y },
    draggable: false,
  };
}

export function createEdge(
  source: string,
  target: string,
  edgeType: string = "default",
): LayoutEdge {
  return {
    id: `e${source}-${target}`,
    source,
    target,
    type: edgeType,
  };
}
