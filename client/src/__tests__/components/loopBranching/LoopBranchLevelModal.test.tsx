import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LoopBranchLevelModal from "../../../pages/ExperimentBuilder/components/Canvas/features/loop-branching/LoopBranchLevelModal";

describe("LoopBranchLevelModal", () => {
  it("[TC-04] requires one level and returns the selected scope", () => {
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

  it("[TC-03] lists ancestry names and relationship descriptions", () => {
    render(
      <LoopBranchLevelModal
        sourceName="Source"
        levels={[
          { scopeId: "inner", name: "Inner loop", relation: "current", branchCount: 0 },
          { scopeId: "outer", name: "Outer loop", relation: "ancestor", branchCount: 2 },
          { scopeId: null, name: "Main timeline", relation: "root", branchCount: 1 },
        ]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Continue inside Inner loop")).toBeInTheDocument();
    expect(screen.getByText("Exit to Outer loop")).toBeInTheDocument();
    expect(screen.getByText("Exit all containing loops")).toBeInTheDocument();
    expect(screen.getByText("2 existing")).toBeInTheDocument();
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

  it("[TC-06] disables choices and actions while submission is pending", () => {
    const onConfirm = vi.fn();
    render(
      <LoopBranchLevelModal
        sourceName="Source"
        levels={[
          { scopeId: "inner", name: "Inner", relation: "current", branchCount: 0 },
        ]}
        isSubmitting
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Inner" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("[TC-11] exposes labelled controls operable from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <LoopBranchLevelModal
        sourceName="Source"
        levels={[
          { scopeId: "inner", name: "Inner", relation: "current", branchCount: 0 },
          { scopeId: null, name: "Main timeline", relation: "root", branchCount: 0 },
        ]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.tab();
    const inner = screen.getByRole("checkbox", { name: "Inner" });
    expect(inner).toHaveFocus();
    await user.keyboard(" ");
    expect(inner).toBeChecked();
    await user.tab();
    const root = screen.getByRole("checkbox", { name: "Main timeline" });
    expect(root).toHaveFocus();
    await user.keyboard(" ");
    expect(root).toBeChecked();
    expect(inner).not.toBeChecked();
  });

  it("[TC-12] keeps a long ancestry scrollable without removing its actions", () => {
    const levels = Array.from({ length: 30 }, (_, index) => ({
      scopeId: `loop-${index}`,
      name: `Loop ${index}`,
      relation: index === 0 ? "current" as const : "ancestor" as const,
      branchCount: 0,
    }));
    render(
      <LoopBranchLevelModal
        sourceName="Source"
        levels={levels}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const first = screen.getByRole("checkbox", { name: "Loop 0" });
    const list = first.parentElement?.parentElement;
    expect(list).toHaveStyle({ maxHeight: "400px", overflowY: "auto" });
    expect(screen.getByRole("checkbox", { name: "Loop 29" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeVisible();
  });
});
