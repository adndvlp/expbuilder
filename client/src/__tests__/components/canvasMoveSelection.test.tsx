import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Canvas from "../../pages/ExperimentBuilder/components/Canvas";

const mocks = vi.hoisted(() => ({ workspace: {} as any }));
vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/hooks/useCanvasWorkspace",
  () => ({
    useCanvasWorkspace: () => mocks.workspace,
  }),
);
vi.mock("@xyflow/react", () => ({ ReactFlow: () => null }));

describe("canvas move selection", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  it.each(["root", "loop"] as const)(
    "offers movement only for selected trials in the %s scope",
    (kind) => {
      const loop = { id: "nested", name: "Nested loop", trials: [3] };
      const trial = { id: 1, type: "Trial", name: "A" };
      mocks.workspace = {
        nodes: [],
        edges: [],
        expanded: { isLoading: false, error: null },
        actionScope: {
          kind,
          items: [
            { id: loop.id, type: "loop", name: loop.name, trials: loop.trials },
            { id: trial.id, type: "trial", name: trial.name, branches: [] },
          ],
        },
        selectedItem: loop,
        hasSelection: true,
        trials: { selectedTrial: null, selectedLoop: loop },
        loopActions: { handleCreateLoop: vi.fn() },
        branchActions: {},
        moveActions: {
          onMoveItem: vi.fn(),
          showMoveItemModal: false,
          itemToMove: null,
        },
        setShowBranchedModal: vi.fn(),
      };
      const view = render(<Canvas />);

      expect(screen.queryByTitle("Move Item")).not.toBeInTheDocument();
      expect(screen.queryByText("Move Item")).not.toBeInTheDocument();
      expect(
        screen.getByTitle(kind === "root" ? "Add loop" : "Create Nested Loop"),
      ).toBeInTheDocument();
      expect(mocks.workspace.moveActions.onMoveItem).not.toHaveBeenCalled();

      mocks.workspace.selectedItem = trial;
      mocks.workspace.trials = { selectedTrial: trial, selectedLoop: null };
      view.rerender(<Canvas />);
      fireEvent.click(screen.getByTitle("Move Item"));
      expect(mocks.workspace.moveActions.onMoveItem).toHaveBeenCalledWith(
        trial.id,
      );
    },
  );
});
