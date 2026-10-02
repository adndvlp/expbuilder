import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import CanvasModals from "../../../pages/ExperimentBuilder/components/Canvas/components/CanvasModals";

const modalProps = (): ComponentProps<typeof CanvasModals> => ({
  timeline: [
    { id: "container", type: "loop", name: "Container", trials: [3] },
    { id: 1, type: "trial", name: "A", branches: [] },
    { id: 2, type: "trial", name: "B", branches: [] },
  ],
  selectedItemId: 1,
  showLoopModal: false,
  onAddLoop: vi.fn(),
  onCloseLoop: vi.fn(),
  showAddTrialModal: false,
  pendingParentId: null,
  onAddTrial: vi.fn(),
  onCloseAddTrial: vi.fn(),
  showLoopBranchLevelModal: false,
  loopBranchLevels: [],
  isCreatingLoopBranch: false,
  onSelectLoopBranchLevel: vi.fn(),
  onCloseLoopBranchLevel: vi.fn(),
  showMoveItemModal: true,
  itemToMove: { id: 1, type: "trial", name: "A" },
  onMoveItem: vi.fn(),
  onCloseMoveItem: vi.fn(),
});

describe("canvas move modal endpoints", () => {
  it.each(["loop", "trial"])(
    "does not open for a known loop even when the payload says %s",
    (type) => {
      const props = modalProps();
      // Exercise untrusted runtime input as well as the public TypeScript contract.
      props.itemToMove = {
        id: "container",
        type,
        name: "Container",
      } as typeof props.itemToMove;
      render(<CanvasModals {...props} />);

      expect(screen.queryByText("Move Item")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("canvas-modal-overlay"),
      ).not.toBeInTheDocument();
      expect(props.onMoveItem).not.toHaveBeenCalled();
    },
  );

  it("offers only trials as destinations for a trial move", () => {
    render(<CanvasModals {...modalProps()} />);
    expect(screen.getByText("Move Item")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("Container")).not.toBeInTheDocument();
  });
});
