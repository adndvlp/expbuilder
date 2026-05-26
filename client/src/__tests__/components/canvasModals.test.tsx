import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AddTrialModal from "../../pages/ExperimentBuilder/components/Canvas/components/AddTrialModal";
import MoveItemModal from "../../pages/ExperimentBuilder/components/Canvas/components/MoveItemModal";

describe("Canvas modals", () => {
  it("confirms AddTrialModal choices as sequential parent or branch", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <AddTrialModal
        parentName="Encoding trial"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Add New Trial")).toBeInTheDocument();
    expect(screen.getByText("Encoding trial")).toBeInTheDocument();

    fireEvent.click(screen.getByText("As Parent (Sequential)"));
    fireEvent.click(screen.getByText("As Branch (Parallel)"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(onConfirm).toHaveBeenNthCalledWith(1, false);
    expect(onConfirm).toHaveBeenNthCalledWith(2, true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps MoveItemModal disabled until a destination is selected", () => {
    const onConfirm = vi.fn();

    render(
      <MoveItemModal
        itemName="Practice loop"
        availableDestinations={[]}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Move Item")).toBeInTheDocument();
    expect(screen.getByText("Practice loop")).toBeInTheDocument();
    expect(screen.getByText("No available destinations")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Move"));

    expect(screen.getByText("Move")).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("moves sequentially when the destination has no branches", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <MoveItemModal
        itemName="Recall trial"
        availableDestinations={[
          { id: "trial-2", name: "Target trial", type: "trial", hasBranches: false },
        ]}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText("Target trial"));
    expect(screen.queryByText("How to add to")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Move"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(onConfirm).toHaveBeenCalledWith("trial-2", false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

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
          { id: "loop-1", name: "Loop target", type: "loop", hasBranches: true },
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
});
