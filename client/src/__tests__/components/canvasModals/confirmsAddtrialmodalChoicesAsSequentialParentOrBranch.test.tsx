import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AddTrialModal from "../../../pages/ExperimentBuilder/components/Canvas/components/AddTrialModal";
import MoveItemModal from "../../../pages/ExperimentBuilder/components/Canvas/components/MoveItemModal";

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
    expect(parentButton).toHaveStyle({
      color: "#fff",
      transform: "translateY(-1px)",
    });
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

    const moveButton = screen.getByText("Move");
    expect(moveButton).toBeDisabled();
    fireEvent.mouseEnter(moveButton);
    fireEvent.mouseLeave(moveButton);
    expect(moveButton).not.toHaveStyle({ transform: "translateY(-1px)" });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("moves sequentially when the destination has no branches", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <MoveItemModal
        itemName="Recall trial"
        availableDestinations={[
          {
            id: "trial-2",
            name: "Target trial",
            type: "trial",
            hasBranches: false,
          },
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
          {
            id: 1,
            name: "Trial destination",
            type: "trial",
            hasBranches: false,
          },
          {
            id: "loop-2",
            name: "Loop destination",
            type: "loop",
            hasBranches: true,
          },
        ]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("the selected item")).toBeInTheDocument();
    expect(screen.getByText("Trial")).toBeInTheDocument();
    expect(screen.getByText("Loop")).toBeInTheDocument();

    const trialDestination =
      screen.getByText("Trial destination").parentElement!;
    fireEvent.mouseEnter(trialDestination);
    expect(trialDestination).toHaveStyle({
      background: "rgba(255, 255, 255, 0.1)",
    });
    fireEvent.mouseLeave(trialDestination);
    expect(trialDestination).toHaveStyle({
      background: "rgba(255, 255, 255, 0.05)",
    });

    fireEvent.click(trialDestination);
    fireEvent.mouseEnter(trialDestination);
    fireEvent.mouseLeave(trialDestination);
    expect(trialDestination).toHaveStyle({
      background: "rgba(76, 175, 80, 0.25)",
    });

    const moveButton = screen.getByText("Move");
    fireEvent.mouseEnter(moveButton);
    expect(moveButton).toHaveStyle({ transform: "translateY(-1px)" });
    fireEvent.mouseLeave(moveButton);
    expect(moveButton).toHaveStyle({ transform: "translateY(0)" });

    const cancelButton = screen.getByText("Cancel");
    fireEvent.mouseEnter(cancelButton);
    expect(cancelButton).toHaveStyle({
      background: "rgba(255, 255, 255, 0.15)",
    });
    fireEvent.mouseLeave(cancelButton);
    expect(cancelButton).toHaveStyle({
      background: "rgba(255, 255, 255, 0.05)",
    });
  });
});
