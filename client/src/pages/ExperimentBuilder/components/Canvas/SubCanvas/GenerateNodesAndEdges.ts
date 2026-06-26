import { useMemo } from "react";
import {
  LAYOUT_CONSTANTS,
  createTrialNode,
  createLoopNode,
  createEdge,
  calculateBranchWidth,
  alignMergePointNodes,
} from "../utils/layoutUtils";
import { Loop, Trial } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { Size } from "../hooks/useResizable";
import {
  collectBranchIds,
  getMergePointIds,
  getNextSequentialItem,
  isMergePoint,
} from "../../../utils/branchGraphUtils";

type Props = {
  loopTimeline: TimelineItem[];
  size: Size;
  selectedTrial: Trial | null;
  selectedLoop: Loop | null;
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: Loop) => void;
  onOpenNestedLoop: ((loopId: string | number) => void) | undefined;
  getTrial: (id: string | number) => Promise<Trial | null>;
  getLoop: (id: string | number) => Promise<Loop | null>;
  onAddBranch: (parentId: string | number) => Promise<void>;
};

export default function GenerateNodesAndEdges({
  onAddBranch,
  getLoop,
  getTrial,
  selectedLoop,
  selectedTrial,
  loopTimeline,
  size,
  onSelectTrial,
  onSelectLoop,
  onOpenNestedLoop,
}: Props) {
  const selectedTrialId = selectedTrial?.id;
  const selectedLoopId = selectedLoop?.id;

  // Generate nodes and edges based on loopTimeline
  const { nodes, edges } = useMemo(() => {
    const nodes: any[] = [];
    const edges: any[] = [];
    const renderedItems = new Map<number | string, string>();
    const { yStep, branchHorizontalSpacing, branchVerticalOffset } =
      LAYOUT_CONSTANTS;

    const xTrial = size.width / 3.1;

    const branchItemIds = collectBranchIds(loopTimeline);
    const mergePointIds = getMergePointIds(loopTimeline);
    const mainItems = loopTimeline.filter(
      (item) => !branchItemIds.has(String(item.id)),
    );

    // Recursive function to render an item and its branches
    const renderItemWithBranches = (
      item: TimelineItem,
      parentId: string,
      x: number,
      y: number,
      depth: number = 0,
    ): number => {
      const isTrial = item.type === "trial";
      const nodeId = isTrial ? `trial-${item.id}` : `loop-${item.id}`;

      if (renderedItems.has(item.id)) {
        const existingNodeId = renderedItems.get(item.id)!;
        if (parentId !== "root") {
          edges.push(createEdge(parentId, existingNodeId));
        }
        return y;
      }

      renderedItems.set(item.id, nodeId);

      // Create node
      const isSelected = isTrial
        ? selectedTrialId === item.id
        : selectedLoopId === item.id;

      const handleSelect = async () => {
        if (isTrial) {
          const trial = await getTrial(item.id);
          if (trial) onSelectTrial(trial);
        } else {
          const loop = await getLoop(item.id);
          if (loop) onSelectLoop(loop);
        }
      };

      if (isTrial) {
        nodes.push(
          createTrialNode(
            nodeId,
            item.name,
            x,
            y,
            isSelected,
            handleSelect,
            isSelected ? () => onAddBranch(item.id) : undefined,
          ),
        );
      } else {
        nodes.push(
          createLoopNode(
            nodeId,
            item.name,
            x,
            y,
            isSelected,
            handleSelect,
            isSelected ? () => onAddBranch(item.id) : undefined,
            onOpenNestedLoop ? () => onOpenNestedLoop(item.id) : undefined,
          ),
        );
      }

      if (parentId !== "root") {
        edges.push(createEdge(parentId, nodeId));
      }

      let maxY = y;

      // Render branches
      if (item.branches && item.branches.length > 0) {
        const branches = item.branches
          .map((branchId) => loopTimeline.find((i) => i.id === branchId))
          .filter((b): b is TimelineItem => b !== undefined);

        if (branches.length > 0) {
          // Calculate the width of each branch considering its sub-branches
          const branchWidths = item.branches.map((branchId) =>
            calculateBranchWidth(
              branchId,
              loopTimeline,
              branchHorizontalSpacing,
            ),
          );
          const totalWidth = branchWidths.reduce(
            (sum, width) => sum + width,
            0,
          );

          let currentX = x - totalWidth / 2;

          branches.forEach((branch, index) => {
            const branchWidth = branchWidths[index];
            const branchX = currentX + branchWidth / 2;
            const branchY = y + branchVerticalOffset;

            const finalY = renderItemWithBranches(
              branch,
              nodeId,
              branchX,
              branchY,
              depth + 1,
            );
            maxY = Math.max(maxY, finalY);

            currentX += branchWidth;
          });
        }
      }

      return maxY;
    };

    // Render main items and their branches
    let yPos = 60;
    mainItems.forEach((item, index) => {
      const finalY = renderItemWithBranches(item, "root", xTrial, yPos, 0);

      if (index < mainItems.length - 1) {
        yPos = finalY + yStep;
      }
    });

    alignMergePointNodes({
      nodes,
      items: loopTimeline,
      mergePointIds,
      branchVerticalOffset,
      getNodeId: (item) =>
        item.type === "trial" ? `trial-${item.id}` : `loop-${item.id}`,
    });

    // Add edges between main items (vertical sequence)
    for (let i = 0; i < mainItems.length - 1; i++) {
      const currentItem = mainItems[i];
      const nextItem = mainItems[i + 1];

      if (currentItem.branches && currentItem.branches.length > 0) {
        continue;
      }

      const currentNodeId =
        currentItem.type === "trial"
          ? `trial-${currentItem.id}`
          : `loop-${currentItem.id}`;
      const nextNodeId =
        nextItem.type === "trial"
          ? `trial-${nextItem.id}`
          : `loop-${nextItem.id}`;

      edges.push(createEdge(currentNodeId, nextNodeId));
    }

    loopTimeline.forEach((item) => {
      if (
        !isMergePoint(mergePointIds, item.id) ||
        (item.branches && item.branches.length > 0)
      ) {
        return;
      }

      const nextItem = getNextSequentialItem(
        loopTimeline,
        item.id,
        branchItemIds,
      );
      if (!nextItem) return;

      const currentNodeId =
        item.type === "trial" ? `trial-${item.id}` : `loop-${item.id}`;
      const nextNodeId =
        nextItem.type === "trial"
          ? `trial-${nextItem.id}`
          : `loop-${nextItem.id}`;

      edges.push(createEdge(currentNodeId, nextNodeId));
    });

    const dedupedEdges = Array.from(
      new Map(edges.map((edge) => [edge.id, edge])).values(),
    );

    return { nodes, edges: dedupedEdges };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loopTimeline,
    selectedTrialId,
    selectedLoopId,
    size.width,
  ]);
  return { nodes, edges };
}
