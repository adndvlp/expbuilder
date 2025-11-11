import { useMemo } from "react";
import { Trial, Loop } from "../../ConfigPanel/types";
import {
  isTrial,
  findItemById,
  collectAllBranchIds,
  getTrialIdsInLoops,
} from "../utils/trialUtils";
import {
  LAYOUT_CONSTANTS,
  LayoutNode,
  LayoutEdge,
  calculateBranchWidth,
  createTrialNode,
  createLoopNode,
  createEdge,
} from "../utils/layoutUtils";

interface UseFlowLayoutProps {
  trials: any[];
  selectedTrial: Trial | null;
  selectedLoop: any;
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: any) => void;
  onAddBranch: (id: number | string) => void;
  openLoop?: any;
  setOpenLoop?: (loop: any) => void;
}

export function useFlowLayout({
  trials,
  selectedTrial,
  selectedLoop,
  onSelectTrial,
  onSelectLoop,
  onAddBranch,
  openLoop,
  setOpenLoop,
}: UseFlowLayoutProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: LayoutNode[] = [];
    const edges: LayoutEdge[] = [];
    const renderedTrials = new Map<number | string, string>(); // Map trial.id -> nodeId

    const { xTrial, yStep, branchHorizontalSpacing, branchVerticalOffset } =
      LAYOUT_CONSTANTS;

    const trialIdsInLoops = getTrialIdsInLoops(trials);
    const branchIds = collectAllBranchIds(trials);

    const allBlocks = trials.filter((item) => {
      if (isTrial(item)) {
        return !trialIdsInLoops.includes(item.id) && !branchIds.has(item.id);
      } else {
        return !branchIds.has(item.id);
      }
    });

    // Recursive function to render a trial and all its branches
    const renderTrialWithBranches = (
      trial: Trial,
      parentId: string,
      x: number,
      y: number,
      depth: number = 0
    ): number => {
      const trialId = `${parentId}-${trial.id}`;
      const isSelected = selectedTrial && selectedTrial.id === trial.id;

      // Check if this trial has already been rendered
      const existingNodeId = renderedTrials.get(trial.id);

      if (existingNodeId) {
        // Trial already rendered, just create the edge without rendering again
        edges.push(createEdge(parentId, existingNodeId));
        return 0; // No depth added since we're not rendering
      }

      // Mark this trial as rendered
      renderedTrials.set(trial.id, trialId);

      // Create edge from parent to this trial
      edges.push(createEdge(parentId, trialId));

      nodes.push(
        createTrialNode(
          trialId,
          trial.name,
          x,
          y,
          !!isSelected,
          () => {
            onSelectTrial(trial);
            // Close any open loop when selecting a branch trial
            if (setOpenLoop) {
              setOpenLoop(null);
            }
          },
          isSelected ? () => onAddBranch(trial.id) : undefined
        )
      );

      let maxDepth = 0;

      if (
        trial.branches &&
        Array.isArray(trial.branches) &&
        trial.branches.length > 0
      ) {
        const branchWidths = trial.branches.map((branchId) =>
          calculateBranchWidth(branchId, trials, branchHorizontalSpacing)
        );
        const totalWidth = branchWidths.reduce((sum, width) => sum + width, 0);

        let currentX = x - totalWidth / 2;

        trial.branches.forEach((branchId: number | string, index: number) => {
          const item = findItemById(trials, branchId);
          if (item) {
            const branchWidth = branchWidths[index];
            const branchX = currentX + branchWidth / 2;
            const branchY = y + branchVerticalOffset;

            if (isTrial(item)) {
              const branchTrial = item as Trial;
              const branchDepth = renderTrialWithBranches(
                branchTrial,
                trialId,
                branchX,
                branchY,
                depth + 1
              );
              maxDepth = Math.max(maxDepth, branchDepth);

              // Edge is created inside renderTrialWithBranches now
            } else {
              const loop = item as Loop;
              const loopDepth = renderLoopWithBranches(
                loop,
                trialId,
                branchX,
                branchY,
                depth + 1
              );
              maxDepth = Math.max(maxDepth, loopDepth);

              // Edge is created inside renderLoopWithBranches now
            }

            currentX += branchWidth;
          }
        });
      }

      return maxDepth + 1;
    };

    // Recursive function to render a loop and all its branches
    const renderLoopWithBranches = (
      loop: Loop,
      parentId: string,
      x: number,
      y: number,
      depth: number = 0
    ): number => {
      const loopId = `${parentId}-${loop.id}`;
      const isSelected =
        (selectedLoop && selectedLoop.id === loop.id) ||
        (openLoop && openLoop.id === loop.id);

      // Check if this loop has already been rendered
      const existingNodeId = renderedTrials.get(loop.id);

      if (existingNodeId) {
        // Loop already rendered, just create the edge without rendering again
        edges.push(createEdge(parentId, existingNodeId));
        return 0; // No depth added since we're not rendering
      }

      // Mark this loop as rendered
      renderedTrials.set(loop.id, loopId);

      // Create edge from parent to this loop
      edges.push(createEdge(parentId, loopId));

      nodes.push(
        createLoopNode(
          loopId,
          loop.name,
          x,
          y,
          !!isSelected,
          () => {
            onSelectLoop(loop);
            if (setOpenLoop) setOpenLoop(loop);
          },
          isSelected ? () => onAddBranch(loop.id) : undefined,
          setOpenLoop ? () => setOpenLoop(loop) : undefined
        )
      );

      let maxDepth = 0;

      if (
        loop.branches &&
        Array.isArray(loop.branches) &&
        loop.branches.length > 0
      ) {
        const branchWidths = loop.branches.map((branchId) =>
          calculateBranchWidth(branchId, trials, branchHorizontalSpacing)
        );
        const totalWidth = branchWidths.reduce((sum, width) => sum + width, 0);

        let currentX = x - totalWidth / 2;

        loop.branches.forEach((branchId: number | string, index: number) => {
          const item = findItemById(trials, branchId);
          if (item) {
            const branchWidth = branchWidths[index];
            const branchX = currentX + branchWidth / 2;
            const branchY = y + branchVerticalOffset;

            if (isTrial(item)) {
              const branchTrial = item as Trial;
              const branchDepth = renderTrialWithBranches(
                branchTrial,
                loopId,
                branchX,
                branchY,
                depth + 1
              );
              maxDepth = Math.max(maxDepth, branchDepth);

              // Edge is created inside renderTrialWithBranches now
            } else {
              const nestedLoop = item as Loop;
              const nestedDepth = renderLoopWithBranches(
                nestedLoop,
                loopId,
                branchX,
                branchY,
                depth + 1
              );
              maxDepth = Math.max(maxDepth, nestedDepth);

              // Edge is created inside renderLoopWithBranches now
            }

            currentX += branchWidth;
          }
        });
      }

      return maxDepth + 1;
    };

    // Render main sequence trials and their branches
    let yPos = 100;
    allBlocks.forEach((item) => {
      const itemId = isTrial(item) ? String(item.id) : `loop-${item.id}`;

      const isSelected = isTrial(item)
        ? selectedTrial && selectedTrial.id === item.id
        : (selectedLoop && selectedLoop.id === item.id) ||
          (openLoop && openLoop.id === item.id);

      // Mark main sequence items as rendered
      renderedTrials.set(item.id, itemId);

      if (isTrial(item)) {
        nodes.push(
          createTrialNode(
            itemId,
            item.name,
            xTrial,
            yPos,
            !!isSelected,
            () => {
              onSelectTrial(item);
              // Check if this trial belongs to a loop
              const parentLoop = trials.find(
                (t: any) =>
                  t.trials && t.trials.some((tr: any) => tr.id === item.id)
              );
              if (parentLoop && setOpenLoop) {
                // Only open the loop if it's not already open
                if (!openLoop || openLoop.id !== parentLoop.id) {
                  setOpenLoop(parentLoop);
                }
              } else if (setOpenLoop) {
                // This trial is not in any loop, so close any open loop
                setOpenLoop(null);
              }
            },
            isSelected ? () => onAddBranch(item.id) : undefined
          )
        );
      } else {
        const loopItem = item as Loop;
        nodes.push(
          createLoopNode(
            itemId,
            loopItem.name,
            xTrial,
            yPos,
            !!isSelected,
            () => {
              onSelectLoop(loopItem);
              if (setOpenLoop) setOpenLoop(loopItem);
            },
            isSelected ? () => onAddBranch(loopItem.id) : undefined,
            setOpenLoop ? () => setOpenLoop(loopItem) : undefined
          )
        );
      }

      // Render branches recursively and calculate max depth
      let maxBranchDepth = 0;
      if (
        item.branches &&
        Array.isArray(item.branches) &&
        item.branches.length > 0
      ) {
        const branchWidths = item.branches.map((branchId: number | string) =>
          calculateBranchWidth(branchId, trials, branchHorizontalSpacing)
        );
        const totalWidth = branchWidths.reduce(
          (sum: number, width: number) => sum + width,
          0
        );
        let currentX = xTrial - totalWidth / 2;

        item.branches.forEach((branchId: number | string, index: number) => {
          const branchItem = findItemById(trials, branchId);
          if (branchItem) {
            const branchWidth = branchWidths[index];
            const branchX = currentX + branchWidth / 2;

            if (isTrial(branchItem)) {
              const branchTrial = branchItem as Trial;
              const branchDepth = renderTrialWithBranches(
                branchTrial,
                itemId,
                branchX,
                yPos + branchVerticalOffset,
                0
              );
              maxBranchDepth = Math.max(maxBranchDepth, branchDepth);

              // Edge is created inside renderTrialWithBranches now
            } else {
              const loop = branchItem as Loop;
              const loopDepth = renderLoopWithBranches(
                loop,
                itemId,
                branchX,
                yPos + branchVerticalOffset,
                0
              );
              maxBranchDepth = Math.max(maxBranchDepth, loopDepth);

              // Edge is created inside renderLoopWithBranches now
            }

            currentX += branchWidth;
          }
        });
      }

      if (maxBranchDepth > 0) {
        yPos += yStep + maxBranchDepth * branchVerticalOffset + 20;
      } else {
        yPos += yStep;
      }
    });

    // Create vertical edges between main sequence trials
    for (let i = 0; i < allBlocks.length - 1; i++) {
      const currentId = isTrial(allBlocks[i])
        ? String(allBlocks[i].id)
        : `loop-${allBlocks[i].id}`;
      const nextId = isTrial(allBlocks[i + 1])
        ? String(allBlocks[i + 1].id)
        : `loop-${allBlocks[i + 1].id}`;

      edges.push(createEdge(currentId, nextId));
    }

    return { nodes, edges };
  }, [
    trials,
    selectedTrial,
    selectedLoop,
    openLoop,
    onSelectTrial,
    onSelectLoop,
    onAddBranch,
  ]);

  return { nodes, edges };
}
