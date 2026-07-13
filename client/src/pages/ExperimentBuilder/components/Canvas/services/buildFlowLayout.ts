import { Loop, Trial } from "../../ConfigurationPanel/types";
import {
  alignMergePointNodes,
  calculateBranchWidth,
  createEdge,
  createLoopNode,
  createTrialNode,
  LAYOUT_CONSTANTS,
  LayoutEdge,
  LayoutNode,
} from "../utils/layoutUtils";
import { findItemById, getTrialIdsInLoops } from "../utils/trialUtils";
import {
  collectBranchIds,
  getMergePointIds,
  getNextSequentialItem,
  isMergePoint,
  itemIdKey,
} from "../../../utils/branchGraphUtils";
import { createBranchRenderers } from "./createBranchRenderers";
import { FlowLayoutOptions } from "./flowLayoutTypes";

export function buildFlowLayout(options: FlowLayoutOptions) {
  const {
    timeline,
    selectedTrialId,
    selectedLoopId,
    openLoopId,
    onSelectTrial,
    onSelectLoop,
    onAddBranch,
    onOpenLoop,
  } = options;
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const renderedItems = new Map<number | string, string>();
  const getTrialNodeId = (id: number | string) => `trial-${id}`;
  const getLoopNodeId = (id: number | string) => `loop-${id}`;
  const { xTrial, yStep, branchHorizontalSpacing, branchVerticalOffset } =
    LAYOUT_CONSTANTS;
  const trialIdsInLoops = new Set(
    getTrialIdsInLoops(timeline).map((id) => itemIdKey(id)),
  );
  const branchIds = collectBranchIds(timeline);
  const mergePointIds = getMergePointIds(timeline);
  const excludedSequentialIds = new Set<string>([
    ...branchIds,
    ...trialIdsInLoops,
  ]);
  const allBlocks = timeline.filter((item) =>
    item.type === "trial"
      ? !trialIdsInLoops.has(itemIdKey(item.id)) &&
        !branchIds.has(itemIdKey(item.id))
      : !branchIds.has(itemIdKey(item.id)),
  );
  const { renderTrialWithBranches, renderLoopWithBranches } =
    createBranchRenderers({
      ...options,
      nodes,
      edges,
      renderedItems,
      branchHorizontalSpacing,
      branchVerticalOffset,
    });

  let yPos = 100;
  allBlocks.forEach((item) => {
    const itemId =
      item.type === "trial" ? getTrialNodeId(item.id) : getLoopNodeId(item.id);
    const isSelected =
      item.type === "trial"
        ? selectedTrialId === item.id
        : selectedLoopId === item.id || openLoopId === item.id;
    renderedItems.set(item.id, itemId);

    if (item.type === "trial") {
      nodes.push(
        createTrialNode(
          itemId,
          item.name,
          xTrial,
          yPos,
          !!isSelected,
          () => onSelectTrial(item),
          isSelected ? () => onAddBranch(item.id) : undefined,
        ),
      );
    } else {
      nodes.push(
        createLoopNode(
          itemId,
          item.name,
          xTrial,
          yPos,
          !!isSelected,
          () => onSelectLoop(item),
          isSelected ? () => onAddBranch(item.id) : undefined,
          onOpenLoop ? () => onOpenLoop(String(item.id)) : undefined,
        ),
      );
    }

    let maxBranchDepth = 0;
    if (
      item.branches &&
      Array.isArray(item.branches) &&
      item.branches.length > 0
    ) {
      const branchWidths = item.branches.map((branchId: number | string) =>
        calculateBranchWidth(branchId, timeline, branchHorizontalSpacing),
      );
      const totalWidth = branchWidths.reduce(
        (sum: number, width: number) => sum + width,
        0,
      );
      let currentX = xTrial - totalWidth / 2;
      item.branches.forEach((branchId: number | string, index: number) => {
        const branchItem = findItemById(timeline, branchId);
        if (branchItem) {
          const branchWidth = branchWidths[index];
          const branchX = currentX + branchWidth / 2;
          const branchDepth =
            branchItem.type === "trial"
              ? renderTrialWithBranches(
                  branchItem as Trial,
                  itemId,
                  branchX,
                  yPos + branchVerticalOffset,
                  0,
                )
              : renderLoopWithBranches(
                  branchItem as Loop,
                  itemId,
                  branchX,
                  yPos + branchVerticalOffset,
                  0,
                );
          maxBranchDepth = Math.max(maxBranchDepth, branchDepth);
          currentX += branchWidth;
        }
      });
    }
    yPos +=
      maxBranchDepth > 0
        ? yStep + maxBranchDepth * branchVerticalOffset + 20
        : yStep;
  });

  alignMergePointNodes({
    nodes,
    items: timeline,
    mergePointIds,
    branchVerticalOffset,
    getNodeId: (item) =>
      item.type === "trial" ? getTrialNodeId(item.id) : getLoopNodeId(item.id),
  });
  for (let index = 0; index < allBlocks.length - 1; index++) {
    if (allBlocks[index].branches?.length > 0) continue;
    const currentId =
      allBlocks[index].type === "trial"
        ? getTrialNodeId(allBlocks[index].id)
        : getLoopNodeId(allBlocks[index].id);
    const nextId =
      allBlocks[index + 1].type === "trial"
        ? getTrialNodeId(allBlocks[index + 1].id)
        : getLoopNodeId(allBlocks[index + 1].id);
    edges.push(createEdge(currentId, nextId));
  }
  timeline.forEach((item) => {
    if (
      !isMergePoint(mergePointIds, item.id) ||
      (item.branches && item.branches.length > 0)
    ) {
      return;
    }
    const nextItem = getNextSequentialItem(
      timeline,
      item.id,
      excludedSequentialIds,
    );
    if (!nextItem) return;
    const currentNodeId =
      item.type === "trial" ? getTrialNodeId(item.id) : getLoopNodeId(item.id);
    const nextNodeId =
      nextItem.type === "trial"
        ? getTrialNodeId(nextItem.id)
        : getLoopNodeId(nextItem.id);
    edges.push(createEdge(currentNodeId, nextNodeId));
  });
  const dedupedEdges = Array.from(
    new Map(edges.map((edge) => [edge.id, edge])).values(),
  );
  return { nodes, edges: dedupedEdges };
}
