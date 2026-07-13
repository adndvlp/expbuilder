import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MoveItemModal from "../../../pages/ExperimentBuilder/components/Canvas/components/MoveItemModal";
import LoopRangeModal from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/LoopRangeModal";

describe("Canvas modals", () => {
  it("allows branch or sequential moves for branched destinations, including id 0", () => {
    const onConfirm = vi.fn();

    const { rerender } = render(
      <MoveItemModal
        itemName="Probe trial"
        availableDestinations={[
          { id: 0, name: "Root trial", type: "trial", hasBranches: true },
        ]}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Root trial"));

    expect(screen.getByText("Sequential")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sequential"));
    fireEvent.click(screen.getByText("Move"));

    expect(onConfirm).toHaveBeenCalledWith(0, false);

    rerender(
      <MoveItemModal
        itemName="Probe trial"
        availableDestinations={[
          {
            id: "loop-1",
            name: "Loop target",
            type: "loop",
            hasBranches: true,
          },
        ]}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Loop target"));
    fireEvent.click(screen.getByText("Branch (Parallel)"));
    fireEvent.click(screen.getByText("Move"));

    expect(onConfirm).toHaveBeenCalledWith("loop-1", true);
  });

  it("auto-includes recursive LoopRangeModal branches and allows deselecting manual choices", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <LoopRangeModal
        timeline={[
          { id: 1, type: "trial", name: "Trial 1", branches: [2, "missing"] },
          { id: 2, type: "trial", name: "Trial 2", branches: [1] },
          { id: "loop-a", type: "loop", name: "Loop A", branches: [] },
        ]}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByLabelText("Trial 1"));
    expect(screen.getByText("(auto-included)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Confirm (3 items)"));
    expect(onConfirm).toHaveBeenCalledWith([1, 2, "missing"]);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Trial 1"));
    expect(screen.getByText("Confirm (0 items)")).toBeDisabled();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("confirms a loop range when no close callback is provided", () => {
    const onConfirm = vi.fn();
    render(
      <LoopRangeModal
        timeline={[{ id: 1, type: "trial", name: "Trial 1", branches: [] }]}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByLabelText("Trial 1"));
    fireEvent.click(screen.getByText("Confirm (1 items)"));

    expect(onConfirm).toHaveBeenCalledWith([1]);
  });
});
