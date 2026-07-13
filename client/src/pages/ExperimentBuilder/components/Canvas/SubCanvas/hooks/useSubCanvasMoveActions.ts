import { useState } from "react";
import useTrials from "../../../../hooks/useTrials";
import { TimelineItem } from "../../../../contexts/TrialsContext";
import { CanvasItemToMove } from "../../hooks/useCanvasMoveActions";

type Props = {
  loopId: string;
  loopTimeline: TimelineItem[];
  onRefreshMetadata?: () => void;
  trials: ReturnType<typeof useTrials>;
};

export function useSubCanvasMoveActions({
  loopId,
  loopTimeline,
  onRefreshMetadata,
  trials,
}: Props) {
  const { getTrial, getLoop, updateTrial, updateLoop } = trials;
  const [showMoveItemModal, setShowMoveItemModal] = useState(false);
  const [itemToMove, setItemToMove] = useState<CanvasItemToMove | null>(null);

  const onMoveItem = async (itemId: number | string) => {
    const item = loopTimeline.find((t) => t.id === itemId);
    if (!item) return;

    setItemToMove({
      id: item.id,
      name: item.name,
      type: item.type,
    });
    setShowMoveItemModal(true);
  };

  // Handler to execute the item move
  const handleMoveItemConfirm = async (
    destinationId: number | string,
    addAsBranch: boolean,
  ) => {
    /* v8 ignore start */
    if (!itemToMove) return;
    /* v8 ignore stop */

    setShowMoveItemModal(false);

    try {
      // ========== STEP 1: REMOVE from current parent (reconnect as DELETE) ==========
      const currentParent = loopTimeline.find((item) =>
        item.branches?.includes(itemToMove.id),
      );

      if (currentParent) {
        // Get the branches of the item to move (its children)
        const itemToMoveData = loopTimeline.find(
          (item) => item.id === itemToMove.id,
        );
        const childrenBranches = itemToMoveData?.branches || [];

        // Remove the item from the parent's branches
        const updatedBranches = currentParent.branches!.filter(
          (branchId) => branchId !== itemToMove.id,
        );

        // RECONNECT: Add ALL children of the item to the parent's branches
        childrenBranches.forEach((childId) => {
          if (!updatedBranches.includes(childId)) {
            updatedBranches.push(childId);
          }
        });

        // Update the parent
        if (currentParent.type === "trial") {
          await updateTrial(currentParent.id, {
            branches: updatedBranches,
          });
        } else {
          await updateLoop(currentParent.id, {
            branches: updatedBranches,
          });
        }
      }

      // ========== STEP 2: ADD to the new destination ==========
      const destinationItem = loopTimeline.find(
        (item) => item.id === destinationId,
      );
      if (!destinationItem) {
        console.error("Destination item not found");
        return;
      }

      if (addAsBranch) {
        // BRANCH mode (parallel): Clear branches of the item and add it to the destination
        // First clear the branches of the moved item
        if (itemToMove.type === "trial") {
          await updateTrial(itemToMove.id, {
            branches: [],
          });
        } else {
          await updateLoop(itemToMove.id, {
            branches: [],
          });
        }

        // Then add it to the destination's branches
        if (destinationItem.type === "trial") {
          const destTrial = await getTrial(destinationId);
          if (destTrial) {
            await updateTrial(destinationId, {
              branches: [...(destTrial.branches || []), itemToMove.id],
            });
          }
        } else {
          const destLoop = await getLoop(destinationId);
          if (destLoop) {
            await updateLoop(destinationId, {
              branches: [...(destLoop.branches || []), itemToMove.id],
            });
          }
        }
      } else {
        // SEQUENTIAL mode (parent): The moved item takes the destination's branches,
        // and the destination points only to the moved item
        if (destinationItem.type === "trial") {
          const destTrial = await getTrial(destinationId);
          if (destTrial) {
            const destBranches = destTrial.branches || [];

            // Update the moved item to have the destination's branches
            if (itemToMove.type === "trial") {
              await updateTrial(itemToMove.id, {
                branches: destBranches,
              });
            } else {
              await updateLoop(itemToMove.id, {
                branches: destBranches,
              });
            }

            // Update the destination to point only to the moved item
            await updateTrial(destinationId, {
              branches: [itemToMove.id],
            });
          }
        } else {
          const destLoop = await getLoop(destinationId);
          if (destLoop) {
            const destBranches = destLoop.branches || [];

            // Update the moved item to have the destination's branches
            if (itemToMove.type === "trial") {
              await updateTrial(itemToMove.id, {
                branches: destBranches,
              });
            } else {
              await updateLoop(itemToMove.id, {
                branches: destBranches,
              });
            }

            // Update the destination to point only to the moved item
            await updateLoop(destinationId, {
              branches: [itemToMove.id],
            });
          }
        }
      }

      console.log(`✓ Moved ${itemToMove.name} to ${destinationItem.name}`);

      // ========== STEP 3: UPDATE LOOP DIRECT CHILDREN ==========
      // SubCanvas content belongs to loop.trials, not the root timeline.
      const parentLoop = await getLoop(loopId);
      if (parentLoop?.trials) {
        const nextTrials = parentLoop.trials.filter(
          (id) => id !== itemToMove.id,
        );
        if (nextTrials.length !== parentLoop.trials.length) {
          await updateLoop(loopId, { trials: nextTrials });
          if (itemToMove.type === "trial") {
            await updateTrial(itemToMove.id, { parentLoopId: String(loopId) });
          } else {
            await updateLoop(itemToMove.id, { parentLoopId: String(loopId) });
          }
        }
      }

      // Refresh metadata to update the loop SubCanvas view
      if (onRefreshMetadata) {
        onRefreshMetadata();
      }
    } catch (error) {
      console.error("Error moving item:", error);
    } finally {
      setItemToMove(null);
    }
  };

  return {
    showMoveItemModal,
    setShowMoveItemModal,
    itemToMove,
    setItemToMove,
    onMoveItem,
    handleMoveItemConfirm,
  };
}
