import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoopBranchLevelModal from "../../../pages/ExperimentBuilder/components/Canvas/features/loop-branching/LoopBranchLevelModal";

describe("LoopBranchLevelModal", () => {
  it("requires one level and returns the selected scope", () => {
    const onConfirm = vi.fn();
    render(
      <LoopBranchLevelModal
        sourceName="Last trial"
        levels={[
          {
            scopeId: "inner",
            name: "Inner loop",
            relation: "current",
            branchCount: 0,
          },
          {
            scopeId: "outer",
            name: "Outer loop",
            relation: "ancestor",
            branchCount: 1,
          },
          {
            scopeId: null,
            name: "Main timeline",
            relation: "root",
            branchCount: 0,
          },
        ]}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    const confirm = screen.getByRole("button", { name: "Continue" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByText("Main timeline"));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it("uses checkbox styling while keeping the choice exclusive", () => {
    render(
      <LoopBranchLevelModal
        sourceName="Last trial"
        levels={[
          {
            scopeId: "inner",
            name: "Inner loop",
            relation: "current",
            branchCount: 0,
          },
          {
            scopeId: "outer",
            name: "Outer loop",
            relation: "ancestor",
            branchCount: 0,
          },
        ]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Inner loop"));
    fireEvent.click(screen.getByText("Outer loop"));
    expect(screen.getByRole("checkbox", { name: "Inner loop" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Outer loop" })).toBeChecked();
  });
});
