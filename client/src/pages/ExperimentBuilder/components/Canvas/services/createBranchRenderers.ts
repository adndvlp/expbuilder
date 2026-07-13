import { Loop, Trial } from "../../ConfigurationPanel/types";
import {
  calculateBranchWidth,
  createEdge,
  createLoopNode,
  createTrialNode,
} from "../utils/layoutUtils";
import { findItemById } from "../utils/trialUtils";
import { BranchRendererContext } from "./flowLayoutTypes";

export function createBranchRenderers({
  timeline,
  selectedTrialId,
  selectedLoopId,
  openLoopId,
  onSelectTrial,
  onSelectLoop,
  onAddBranch,
  onOpenLoop,
  nodes,
  edges,
  renderedItems,
  branchHorizontalSpacing,
  branchVerticalOffset,
}: BranchRendererContext) {
  const getTrialNodeId = (id: number | string) => `trial-${id}`;
  const getLoopNodeId = (id: number | string) => `loop-${id}`;

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
          const branchDepth =
            item.type === "trial"
              ? renderTrialWithBranches(
                  item as Trial,
                  trialId,
                  branchX,
                  branchY,
                  depth + 1,
                )
              : renderLoopWithBranches(
                  item as Loop,
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

  const renderLoopWithBranches = (
    loop: Loop,
    parentId: string,
    x: number,
    y: number,
    depth: number = 0,
  ): number => {
    const loopId = getLoopNodeId(loop.id);
    const isSelected = selectedLoopId === loop.id || openLoopId === loop.id;
    const existingNodeId = renderedItems.get(loop.id);
    if (existingNodeId) {
      edges.push(createEdge(parentId, existingNodeId));
      return 0;
    }

    renderedItems.set(loop.id, loopId);
    edges.push(createEdge(parentId, loopId));
    nodes.push(
      createLoopNode(
        loopId,
        loop.name,
        x,
        y,
        !!isSelected,
        () => onSelectLoop(loop),
        isSelected ? () => onAddBranch(loop.id) : undefined,
        onOpenLoop ? () => onOpenLoop(String(loop.id)) : undefined,
      ),
    );

    let maxDepth = 0;
    if (
      loop.branches &&
      Array.isArray(loop.branches) &&
      loop.branches.length > 0
    ) {
      const branchWidths = loop.branches.map((branchId) =>
        calculateBranchWidth(branchId, timeline, branchHorizontalSpacing),
      );
      const totalWidth = branchWidths.reduce((sum, width) => sum + width, 0);
      let currentX = x - totalWidth / 2;

      loop.branches.forEach((branchId: number | string, index: number) => {
        const item = findItemById(timeline, branchId);
        if (item) {
          const branchWidth = branchWidths[index];
          const branchX = currentX + branchWidth / 2;
          const branchY = y + branchVerticalOffset;
          const branchDepth =
            item.type === "trial"
              ? renderTrialWithBranches(
                  item as Trial,
                  loopId,
                  branchX,
                  branchY,
                  depth + 1,
                )
              : renderLoopWithBranches(
                  item as Loop,
                  loopId,
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

  return { renderTrialWithBranches, renderLoopWithBranches };
}
