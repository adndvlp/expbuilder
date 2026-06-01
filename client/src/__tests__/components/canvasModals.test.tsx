import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AddTrialModal from "../../pages/ExperimentBuilder/components/Canvas/components/AddTrialModal";
import LoopBreadcrumb from "../../pages/ExperimentBuilder/components/Canvas/components/LoopBreadcrumb";
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

  it("applies AddTrialModal hover states and fallback parent copy", () => {
    render(<AddTrialModal onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("The selected item")).toBeInTheDocument();

    const parentButton = screen.getByText("As Parent (Sequential)");
    const branchButton = screen.getByText("As Branch (Parallel)");
    const cancelButton = screen.getByText("Cancel");

    fireEvent.mouseEnter(parentButton);
    expect(parentButton).toHaveStyle({ color: "#fff", transform: "translateY(-1px)" });
    fireEvent.mouseLeave(parentButton);
    expect(parentButton).toHaveStyle({ transform: "translateY(0)" });

    fireEvent.mouseEnter(branchButton);
    expect(branchButton).toHaveStyle({ transform: "translateY(-1px)" });
    fireEvent.mouseLeave(branchButton);
    expect(branchButton).toHaveStyle({ transform: "translateY(0)" });

    fireEvent.mouseEnter(cancelButton);
    expect(cancelButton).toHaveStyle({ opacity: "1" });
    fireEvent.mouseLeave(cancelButton);
    expect(cancelButton).toHaveStyle({ opacity: "0.7" });
  });

  it("navigates LoopBreadcrumb root and visible loops", () => {
    const onNavigate = vi.fn();
    const onNavigateToRoot = vi.fn();

    render(
      <LoopBreadcrumb
        loopStack={[
          { id: "loop-1", name: "Outer loop" },
          { id: "loop-2", name: "Inner loop" },
        ]}
        onNavigate={onNavigate}
        onNavigateToRoot={onNavigateToRoot}
      />,
    );

    fireEvent.click(screen.getByText("Root"));
    fireEvent.click(screen.getByText("Outer loop"));
    fireEvent.click(screen.getByText("Inner loop"));

    expect(onNavigateToRoot).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenNthCalledWith(1, 0);
    expect(onNavigate).toHaveBeenNthCalledWith(2, 1);

    const outerButton = screen.getByText("Outer loop");
    fireEvent.mouseEnter(outerButton);
    expect(outerButton).toHaveStyle({ background: "rgba(255, 255, 255, 0.15)" });
    fireEvent.mouseLeave(outerButton);
    expect(outerButton).toHaveStyle({ background: "transparent" });
  });

  it("collapses long LoopBreadcrumb stacks while preserving real indexes", () => {
    const onNavigate = vi.fn();
    const onNavigateToRoot = vi.fn();

    const { container } = render(
      <LoopBreadcrumb
        compact
        loopStack={[
          { id: "loop-1", name: "Loop 1" },
          { id: "loop-2", name: "Loop 2" },
          { id: "loop-3", name: "Loop 3" },
          { id: "loop-4", name: "Loop 4" },
          { id: "loop-5", name: "Loop 5" },
        ]}
        onNavigate={onNavigate}
        onNavigateToRoot={onNavigateToRoot}
      />,
    );

    expect(screen.queryByText("Root")).not.toBeInTheDocument();
    expect(screen.getByText("...")).toBeInTheDocument();
    expect(screen.getByText("Loop 1")).toBeInTheDocument();
    expect(screen.queryByText("Loop 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Loop 3")).not.toBeInTheDocument();
    expect(screen.getByText("Loop 4")).toBeInTheDocument();
    expect(screen.getByText("Loop 5")).toBeInTheDocument();

    fireEvent.click(container.querySelector("button")!);
    fireEvent.click(screen.getByText("Loop 1"));
    fireEvent.click(screen.getByText("Loop 4"));
    fireEvent.click(screen.getByText("Loop 5"));

    expect(onNavigateToRoot).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenNthCalledWith(1, 0);
    expect(onNavigate).toHaveBeenNthCalledWith(2, 3);
    expect(onNavigate).toHaveBeenNthCalledWith(3, 4);
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

  it("applies MoveItemModal fallback labels and hover states", () => {
    render(
      <MoveItemModal
        availableDestinations={[
          { id: 1, name: "Trial destination", type: "trial", hasBranches: false },
          { id: "loop-2", name: "Loop destination", type: "loop", hasBranches: true },
        ]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("the selected item")).toBeInTheDocument();
    expect(screen.getByText("Trial")).toBeInTheDocument();
    expect(screen.getByText("Loop")).toBeInTheDocument();

    const trialDestination = screen.getByText("Trial destination").parentElement!;
    fireEvent.mouseEnter(trialDestination);
    expect(trialDestination).toHaveStyle({ background: "rgba(255, 255, 255, 0.1)" });
    fireEvent.mouseLeave(trialDestination);
    expect(trialDestination).toHaveStyle({ background: "rgba(255, 255, 255, 0.05)" });

    fireEvent.click(trialDestination);
    fireEvent.mouseEnter(trialDestination);
    expect(trialDestination).toHaveStyle({ background: "rgba(76, 175, 80, 0.25)" });

    const moveButton = screen.getByText("Move");
    fireEvent.mouseEnter(moveButton);
    expect(moveButton).toHaveStyle({ transform: "translateY(-1px)" });
    fireEvent.mouseLeave(moveButton);
    expect(moveButton).toHaveStyle({ transform: "translateY(0)" });

    const cancelButton = screen.getByText("Cancel");
    fireEvent.mouseEnter(cancelButton);
    expect(cancelButton).toHaveStyle({ background: "rgba(255, 255, 255, 0.15)" });
    fireEvent.mouseLeave(cancelButton);
    expect(cancelButton).toHaveStyle({ background: "rgba(255, 255, 255, 0.05)" });
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
