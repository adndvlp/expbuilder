import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrialNode from "../../pages/ExperimentBuilder/components/Canvas/TrialNode";
import LoopNode from "../../pages/ExperimentBuilder/components/Canvas/LoopNode";

describe("Canvas nodes", () => {
  it("renders a trial node, selects it and stops branch clicks from selecting the node", () => {
    const onClick = vi.fn();
    const onAddBranch = vi.fn();

    const { container } = render(
      <TrialNode
        data={{
          name: "Encoding trial",
          selected: true,
          onClick,
          onAddBranch,
        }}
      />,
    );

    const node = screen.getByText("Encoding trial");
    expect(node).toHaveClass("trial-node", "trial-node--selected");

    fireEvent.click(node);
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle("Add branch"));

    expect(onAddBranch).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".trial-node__add-branch-btn")).toBeInTheDocument();
  });

  it("hides the trial branch action when the node is not selected", () => {
    render(
      <TrialNode
        data={{
          name: "Filler trial",
          selected: false,
          onClick: vi.fn(),
          onAddBranch: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText("Filler trial")).not.toHaveClass("trial-node--selected");
    expect(screen.queryByTitle("Add branch")).not.toBeInTheDocument();
  });

  it("renders loop actions and stops open/branch buttons from selecting the loop", () => {
    const onClick = vi.fn();
    const onAddBranch = vi.fn();
    const onOpenLoop = vi.fn();

    render(
      <LoopNode
        data={{
          name: "Practice loop",
          selected: true,
          onClick,
          onAddBranch,
          onOpenLoop,
        }}
      />,
    );

    const loop = screen.getByText("Practice loop").closest(".loop-node")!;
    expect(loop).toHaveClass("loop-node--selected");

    fireEvent.click(loop);
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle("Open loop"));
    fireEvent.click(screen.getByTitle("Add branch"));

    expect(onOpenLoop).toHaveBeenCalledTimes(1);
    expect(onAddBranch).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps loop open visible but branch hidden when the loop is not selected", () => {
    render(
      <LoopNode
        data={{
          name: "Main loop",
          selected: false,
          onClick: vi.fn(),
          onAddBranch: vi.fn(),
          onOpenLoop: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText("Main loop").closest(".loop-node")).not.toHaveClass(
      "loop-node--selected",
    );
    expect(screen.getByTitle("Open loop")).toBeInTheDocument();
    expect(screen.queryByTitle("Add branch")).not.toBeInTheDocument();
  });
});
