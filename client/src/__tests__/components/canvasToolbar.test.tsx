import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CanvasToolbar from "../../pages/ExperimentBuilder/components/Canvas/components/CanvasToolbar";

const handlers = () => ({
  onCreateLoop: vi.fn(),
  onAddTrial: vi.fn(),
  onShowBranches: vi.fn(),
  onMoveItem: vi.fn(),
});

describe("CanvasToolbar", () => {
  it("offers root actions for a selected root item", () => {
    const actions = handlers();
    render(
      <CanvasToolbar
        fabStyle={{}}
        scopeKind="root"
        itemCount={3}
        hasSelection
        {...actions}
      />,
    );

    fireEvent.click(screen.getByTitle("Add loop"));
    fireEvent.click(screen.getByTitle("Branches"));
    fireEvent.click(screen.getByTitle("Move Item"));

    expect(actions.onCreateLoop).toHaveBeenCalledOnce();
    expect(actions.onShowBranches).toHaveBeenCalledOnce();
    expect(actions.onMoveItem).toHaveBeenCalledOnce();
    expect(screen.queryByTitle("Add trial")).not.toBeInTheDocument();
  });

  it("offers only add trial when the root timeline is empty", () => {
    const actions = handlers();
    render(
      <CanvasToolbar
        fabStyle={{}}
        scopeKind="root"
        itemCount={0}
        hasSelection={false}
        {...actions}
      />,
    );

    fireEvent.click(screen.getByTitle("Add trial"));

    expect(actions.onAddTrial).toHaveBeenCalledOnce();
    expect(screen.queryByTitle("Add loop")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Branches")).not.toBeInTheDocument();
  });

  it("offers nested-loop actions for a selected loop-scope item", () => {
    const actions = handlers();
    render(
      <CanvasToolbar
        fabStyle={{}}
        scopeKind="loop"
        itemCount={2}
        hasSelection
        {...actions}
      />,
    );

    fireEvent.click(screen.getByTitle("Create Nested Loop"));
    fireEvent.click(screen.getByTitle("Branches"));
    fireEvent.click(screen.getByTitle("Move Item"));

    expect(actions.onCreateLoop).toHaveBeenCalledOnce();
    expect(actions.onShowBranches).toHaveBeenCalledOnce();
    expect(actions.onMoveItem).toHaveBeenCalledOnce();
  });
});
