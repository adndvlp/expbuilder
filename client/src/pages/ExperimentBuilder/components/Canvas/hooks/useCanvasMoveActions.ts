import { useState } from "react";
import useTrials from "../../../hooks/useTrials";

export type CanvasItemToMove = {
  id: number | string;
  name: string;
  type: "trial" | "loop";
};

export function useCanvasMoveActions(trials: ReturnType<typeof useTrials>) {
  const {
    timeline,
    getTrial,
    getLoop,
    updateTrial,
    updateLoop,
    updateTimeline,
  } = trials;
  const [showMoveItemModal, setShowMoveItemModal] = useState(false);
  const [itemToMove, setItemToMove] = useState<CanvasItemToMove | null>(null);

  const onMoveItem = async (itemId: number | string) => {
    const item = timeline.find((t) => t.id === itemId);
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
      const currentParent = timeline.find((item) =>
        item.branches?.includes(itemToMove.id),
      );

      if (currentParent) {
        // Get the branches of the item to move (its children)
        const itemToMoveData = timeline.find(
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
      const destinationItem = timeline.find(
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

      // ========== STEP 3: REORDER TIMELINE ==========
      // The moved item should be positioned right after the destination
      const newTimeline = [...timeline];

      // Remove the moved item from its current position
      const movedItemIndex = newTimeline.findIndex(
        (item) => item.id === itemToMove.id,
      );
      if (movedItemIndex !== -1) {
        newTimeline.splice(movedItemIndex, 1);
      }

      // Find the destination's position (after removal)
      const destIndex = newTimeline.findIndex(
        (item) => item.id === destinationId,
      );

      // Insert the moved item right after the destination
      if (destIndex !== -1) {
        newTimeline.splice(destIndex + 1, 0, {
          id: itemToMove.id,
          type: itemToMove.type,
          name: itemToMove.name,
          branches: [], // Will be updated by the backend
        });
      } else {
        // If destination was removed with the moved item, append at the end.
        newTimeline.push({
          id: itemToMove.id,
          type: itemToMove.type,
          name: itemToMove.name,
          branches: [],
        });
      }

      // Update the timeline in the backend
      await updateTimeline(newTimeline);
      console.log("✓ Timeline reordered");
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
