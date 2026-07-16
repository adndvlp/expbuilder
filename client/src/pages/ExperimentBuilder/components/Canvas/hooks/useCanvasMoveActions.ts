import { useState } from "react";
import useTrials from "../../../hooks/useTrials";
import { moveScopedItem } from "../actions";
import type {
  CanvasActionScope,
  CanvasItemToMove,
} from "../actions";

export type { CanvasItemToMove } from "../actions";

export function useCanvasMoveActions(
  trials: ReturnType<typeof useTrials>,
  actionScope?: CanvasActionScope,
) {
  const [showMoveItemModal, setShowMoveItemModal] = useState(false);
  const [itemToMove, setItemToMove] = useState<CanvasItemToMove | null>(null);
  const scope: CanvasActionScope = actionScope ?? {
    kind: "root",
    items: trials.timeline,
  };

  const onMoveItem = (itemId: string | number) => {
    const item = scope.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    setItemToMove({ id: item.id, name: item.name, type: item.type });
    setShowMoveItemModal(true);
  };

  const handleMoveItemConfirm = async (
    destinationId: string | number,
    addAsBranch: boolean,
  ) => {
    if (!itemToMove) return;
    setShowMoveItemModal(false);
    try {
      const result = await moveScopedItem({
        scope,
        dependencies: trials,
        item: itemToMove,
        destinationId,
        addAsBranch,
      });
      if (result.status === "destination-not-found") {
        console.error("Destination item not found");
      }
    } catch (error: unknown) {
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
