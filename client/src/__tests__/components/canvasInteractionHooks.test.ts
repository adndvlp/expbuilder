import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDraggable } from "../../pages/ExperimentBuilder/components/Canvas/hooks/useDraggable";
import { useResizable } from "../../pages/ExperimentBuilder/components/Canvas/hooks/useResizable";

describe("Canvas interaction hooks", () => {
  it("tracks drag offset from mouse down through global mouse events", () => {
    const { result } = renderHook(() => useDraggable({ x: 10, y: 20 }));

    expect(result.current.dragging).toBe(false);
    expect(result.current.pos).toEqual({ x: 10, y: 20 });

    act(() => {
      result.current.handleMouseDown({ clientX: 30, clientY: 45 } as React.MouseEvent);
    });

    expect(result.current.dragging).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 70 }));
    });

    expect(result.current.pos).toEqual({ x: 30, y: 45 });

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });

    expect(result.current.dragging).toBe(false);
  });

  it("resizes from global mouse movement and clamps to minimum dimensions", () => {
    const stopPropagation = vi.fn();
    const { result } = renderHook(() =>
      useResizable({ width: 320, height: 240 }, 280, 180),
    );

    expect(result.current.resizing).toBe(false);
    expect(result.current.size).toEqual({ width: 320, height: 240 });

    act(() => {
      result.current.handleResizeMouseDown({
        clientX: 100,
        clientY: 120,
        stopPropagation,
      } as unknown as React.MouseEvent);
    });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(result.current.resizing).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 170, clientY: 180 }));
    });

    expect(result.current.size).toEqual({ width: 390, height: 300 });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: -500, clientY: -500 }));
    });

    expect(result.current.size).toEqual({ width: 280, height: 180 });

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });

    expect(result.current.resizing).toBe(false);
  });
});
