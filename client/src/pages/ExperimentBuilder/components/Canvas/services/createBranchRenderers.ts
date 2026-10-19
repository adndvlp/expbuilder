import { Trial } from "../../ConfigurationPanel/types";
import {
  calculateBranchWidth,
  createEdge,
  createTrialNode,
} from "../utils/layoutUtils";
import { findItemById } from "../utils/trialUtils";
import { BranchRendererContext } from "./flowLayoutTypes";

export function createBranchRenderers({
  timeline,
  selectedTrialId,
  onSelectTrial,
  onAddBranch,
  nodes,
  edges,
  renderedItems,
  branchHorizontalSpacing,
  branchVerticalOffset,
}: BranchRendererContext) {
  const getTrialNodeId = (id: number | string) => `trial-${id}`;

  const renderTrialWithBranches = (
    trial: Trial,
    parentId: string,
    x: number,
    y: number,
    depth: number = 0,
  ): number => {
    const trialId = getTrialNodeId(trial.id);
    const isSelected = selectedTrialId === trial.id;
    const existingNodeId = renderedItems.get(trial.id);
    if (existingNodeId) {
      edges.push(createEdge(parentId, existingNodeId));
      return 0;
    }

    renderedItems.set(trial.id, trialId);
    edges.push(createEdge(parentId, trialId));
    nodes.push(
      createTrialNode(
        trialId,
        trial.name,
        x,
        y,
        !!isSelected,
        () => onSelectTrial(trial),
        isSelected ? () => onAddBranch(trial.id) : undefined,
      ),
    );

    let maxDepth = 0;
    if (
      trial.branches &&
      Array.isArray(trial.branches) &&
      trial.branches.length > 0
    ) {
      const branchWidths = trial.branches.map((branchId) =>
        calculateBranchWidth(branchId, timeline, branchHorizontalSpacing),
      );
      const totalWidth = branchWidths.reduce((sum, width) => sum + width, 0);
      let currentX = x - totalWidth / 2;

      trial.branches.forEach((branchId: number | string, index: number) => {
        const item = findItemById(timeline, branchId);
        if (item) {
          const branchWidth = branchWidths[index];
          const branchX = currentX + branchWidth / 2;
          const branchY = y + branchVerticalOffset;
          if (item.type !== "trial") return;
          const branchDepth = renderTrialWithBranches(
            item as Trial,
            trialId,
            branchX,
            branchY,
            depth + 1,
          );
          maxDepth = Math.max(maxDepth, branchDepth);
          currentX += branchWidth;
        }
      });
    }
    return maxDepth + 1;
  };

  return { renderTrialWithBranches };
}
