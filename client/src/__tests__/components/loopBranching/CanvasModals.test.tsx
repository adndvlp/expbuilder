import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CanvasModals from "../../../pages/ExperimentBuilder/components/Canvas/components/CanvasModals";

const renderLevelModal = (onClose: () => void, onSelect = vi.fn()) =>
  render(
    <CanvasModals
      timeline={[
        { id: 1, type: "trial", name: "Source", branches: [] },
      ]}
      selectedItemId={1}
      showLoopModal={false}
      onAddLoop={vi.fn()}
      onCloseLoop={vi.fn()}
      showAddTrialModal={false}
      pendingParentId={1}
      onAddTrial={vi.fn()}
      onCloseAddTrial={vi.fn()}
      showLoopBranchLevelModal
      loopBranchLevels={[
        {
          scopeId: "inner",
          name: "Inner",
          relation: "current",
          branchCount: 0,
        },
      ]}
      isCreatingLoopBranch={false}
      onSelectLoopBranchLevel={onSelect}
      onCloseLoopBranchLevel={onClose}
      showMoveItemModal={false}
      itemToMove={null}
      onMoveItem={vi.fn()}
      onCloseMoveItem={vi.fn()}
    />,
  );

afterEach(cleanup);

describe("Canvas loop branch modal shell", () => {
  it.each(["cancel", "backdrop", "escape"])(
    "[TC-02] closes through %s without confirming a mutation",
    (action) => {
      const onClose = vi.fn();
      const onSelect = vi.fn();
      renderLevelModal(onClose, onSelect);

      if (action === "cancel") {
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      } else if (action === "backdrop") {
        fireEvent.mouseDown(screen.getByTestId("canvas-modal-overlay"));
      } else {
        fireEvent.keyDown(document, { key: "Escape" });
      }

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    },
  );
});
