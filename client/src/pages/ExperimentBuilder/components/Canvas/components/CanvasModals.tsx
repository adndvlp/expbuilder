import { ReactNode, useEffect } from "react";
import { TimelineItem } from "../../../contexts/TrialsContext";
import LoopRangeModal from "../../ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/LoopRangeModal";
import AddTrialModal from "./AddTrialModal";
import MoveItemModal from "./MoveItemModal";
import { CanvasItemToMove } from "../hooks/useCanvasMoveActions";
import LoopBranchLevelModal from "../features/loop-branching/LoopBranchLevelModal";
import type { LoopBranchLevel } from "../features/loop-branching/types";

type CanvasModalsProps = {
  timeline: TimelineItem[];
  selectedItemId: string | number | null;
  showLoopModal: boolean;
  onAddLoop: (itemIds: (number | string)[]) => Promise<void>;
  onCloseLoop: () => void;
  showAddTrialModal: boolean;
  pendingParentId: string | number | null;
  onAddTrial: (addAsBranch: boolean) => Promise<void>;
  onCloseAddTrial: () => void;
  showLoopBranchLevelModal: boolean;
  loopBranchLevels: LoopBranchLevel[];
  isCreatingLoopBranch: boolean;
  onSelectLoopBranchLevel: (scopeId: string | null) => void | Promise<void>;
  onCloseLoopBranchLevel: () => void;
  showMoveItemModal: boolean;
  itemToMove: CanvasItemToMove | null;
  onMoveItem: (
    destinationId: string | number,
    addAsBranch: boolean,
  ) => Promise<void>;
  onCloseMoveItem: () => void;
};

function ModalOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  useEffect(() => {
    if (!onClose) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      data-testid="canvas-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div style={{ position: "relative", zIndex: 10000 }}>{children}</div>
    </div>
  );
}

export default function CanvasModals({
  timeline,
  selectedItemId,
  showLoopModal,
  onAddLoop,
  onCloseLoop,
  showAddTrialModal,
  pendingParentId,
  onAddTrial,
  onCloseAddTrial,
  showLoopBranchLevelModal,
  loopBranchLevels,
  isCreatingLoopBranch,
  onSelectLoopBranchLevel,
  onCloseLoopBranchLevel,
  showMoveItemModal,
  itemToMove,
  onMoveItem,
  onCloseMoveItem,
}: CanvasModalsProps) {
  const currentParent = itemToMove
    ? timeline.find((item) => item.branches?.includes(itemToMove.id))
    : undefined;
  const availableDestinations = itemToMove
    ? timeline
        .filter((item) => {
          if (item.id === itemToMove.id) return false;
          if (currentParent && item.id === currentParent.id) {
            return currentParent.branches!.length > 1;
          }
          return true;
        })
        .map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          hasBranches: (item.branches?.length || 0) > 0,
        }))
    : [];

  return (
    <>
      {showLoopModal && (
        <ModalOverlay onClose={onCloseLoop}>
          <LoopRangeModal
            timeline={timeline}
            onConfirm={onAddLoop}
            onClose={onCloseLoop}
            selectedTrialId={selectedItemId}
          />
        </ModalOverlay>
      )}

      {showAddTrialModal && (
        <ModalOverlay onClose={onCloseAddTrial}>
          <AddTrialModal
            onConfirm={onAddTrial}
            onClose={onCloseAddTrial}
            parentName={
              timeline.find((item) => item.id === pendingParentId)?.name
            }
          />
        </ModalOverlay>
      )}

      {showLoopBranchLevelModal && (
        <ModalOverlay
          onClose={
            isCreatingLoopBranch ? undefined : onCloseLoopBranchLevel
          }
        >
          <LoopBranchLevelModal
            sourceName={
              timeline.find((item) => item.id === pendingParentId)?.name ??
              "the selected trial"
            }
            levels={loopBranchLevels}
            isSubmitting={isCreatingLoopBranch}
            onConfirm={onSelectLoopBranchLevel}
            onClose={onCloseLoopBranchLevel}
          />
        </ModalOverlay>
      )}

      {showMoveItemModal && itemToMove && (
        <ModalOverlay onClose={onCloseMoveItem}>
          <MoveItemModal
            onConfirm={onMoveItem}
            onClose={onCloseMoveItem}
            itemName={itemToMove.name}
            availableDestinations={availableDestinations}
          />
        </ModalOverlay>
      )}
    </>
  );
}
