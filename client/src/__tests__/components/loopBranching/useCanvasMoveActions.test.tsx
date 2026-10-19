import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCanvasMoveActions } from "../../../pages/ExperimentBuilder/components/Canvas/hooks/useCanvasMoveActions";
import type { CanvasActionScope } from "../../../pages/ExperimentBuilder/components/Canvas/actions";
import { createDependencies } from "../canvasScopedActions/testHarness";

const scopeItems = [
  { id: 1, type: "trial" as const, name: "A", branches: [] },
  { id: "child", type: "loop" as const, name: "Child loop", trials: [3] },
  { id: 2, type: "trial" as const, name: "B", branches: [] },
];

describe("trial movement in the canvas", () => {
  it.each(["root", "loop"] as const)(
    "cannot open or confirm a loop move in the %s scope",
    async (kind) => {
      const dependencies = createDependencies();
      const scope: CanvasActionScope =
        kind === "root"
          ? { kind, items: scopeItems }
          : { kind, loopId: "parent-loop", items: scopeItems, rootItems: [] };
      const trials = {
        ...dependencies,
        timeline: scopeItems,
      } as unknown as Parameters<typeof useCanvasMoveActions>[0];
      const { result } = renderHook(() => useCanvasMoveActions(trials, scope));

      act(() => result.current.onMoveItem("child"));
      expect(result.current.showMoveItemModal).toBe(false);
      expect(result.current.itemToMove).toBeNull();
      await act(async () => result.current.handleMoveItemConfirm(2, false));
      for (const dependency of Object.values(dependencies)) {
        expect(dependency).not.toHaveBeenCalled();
      }
    },
  );

  it("opens a trial move using its actual ID when the request has a string ID", () => {
    const dependencies = createDependencies();
    const trials = {
      ...dependencies,
      timeline: scopeItems,
    } as unknown as Parameters<typeof useCanvasMoveActions>[0];
    const { result } = renderHook(() => useCanvasMoveActions(trials));

    act(() => result.current.onMoveItem("2"));
    expect(result.current.showMoveItemModal).toBe(true);
    expect(result.current.itemToMove).toEqual({
      id: 2,
      name: "B",
      type: "trial",
    });
  });
});
