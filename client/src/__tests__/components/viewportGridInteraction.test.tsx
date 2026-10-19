import { act, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDesignerSnapping } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/hooks/useDesignerSnapping";
import { nodeSnapBox } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/editorGuides/getSceneSnapTargets";
import type { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

function fixture() {
  const pointer = { x: 137, y: 113 };
  let position = { ...pointer };
  const parent = { getRelativePointerPosition: () => pointer, find: () => [] };
  const node: any = {
    id: () => "moving",
    getAttr: () => undefined,
    getParent: () => parent,
    x: () => position.x,
    y: () => position.y,
    getClientRect: () => ({
      x: position.x - 20,
      y: position.y - 5,
      width: 40,
      height: 10,
    }),
    position: (next: typeof position) => {
      position = next;
    },
    stopDrag: vi.fn(),
    fire: vi.fn(),
    findAncestor: () => node,
  };
  const component: TrialComponent = {
    id: "moving",
    type: "HtmlComponent",
    x: 137,
    y: 113,
    width: 40,
    height: 10,
    config: {},
  };
  const args = {
    components: [component],
    previewViewport: { width: 1000, height: 700 },
    stageScale: 1,
    gridEnabled: true,
    isOpen: true,
    setComponents: vi.fn(),
    setActiveGuides: vi.fn(),
    pushHistory: vi.fn(),
  };
  const hook = renderHook((props) => useDesignerSnapping(props), {
    initialProps: args,
  });
  const begin = () =>
    act(() => {
      hook.result.current.rememberPointer({ target: node } as any);
      pointer.x += 4;
      hook.result.current.beginDrag({
        target: node,
        evt: { altKey: false },
      } as any);
    });
  const move = (x: number, interaction: "drag" | "transform" = "drag") => {
    pointer.x = x;
    const result = hook.result.current.snap(
      nodeSnapBox(node, "moving"),
      { node, interaction },
      {},
    );
    node.position(result);
    return result;
  };
  return { ...hook, args, begin, move, node, pointer, component };
}

describe("grid drag interactions", () => {
  it("uses the free pointer, survives snapped node updates and releases the magnet", () => {
    const test = fixture();
    test.begin();
    expect(test.move(304).x).toBe(300);
    expect(test.move(307).x).toBe(300);
    expect(test.move(310).x).toBe(310);
    act(() => test.result.current.endDrag());
    expect(test.args.setActiveGuides).toHaveBeenLastCalledWith([]);
  });
  it("retains the original history snapshot despite transient DOM movement", () => {
    const test = fixture();
    test.begin();
    test.move(304);
    test.rerender({
      ...test.args,
      components: [{ ...test.component, x: 300 }],
    });
    test.result.current.recordHistory();
    test.result.current.recordHistory();
    expect(test.args.pushHistory).toHaveBeenCalledTimes(1);
    expect(test.args.pushHistory).toHaveBeenCalledWith([test.component]);
  });
  it("allows Alt to release and reenable attraction immediately", () => {
    const test = fixture();
    test.begin();
    expect(test.move(304).x).toBe(300);
    fireEvent.keyDown(window, { key: "Alt" });
    expect(test.node.fire).toHaveBeenCalledWith("dragmove", expect.any(Object));
    expect(test.move(304)).toEqual({ x: 304, y: 113, guides: [] });
    fireEvent.keyUp(window, { key: "Alt" });
    expect(test.move(304).x).toBe(300);
  });
  it("restores a cancelled drag without history or confirming intermediate coordinates", () => {
    const test = fixture();
    test.begin();
    test.move(304);
    let skipped = false;
    test.node.stopDrag.mockImplementation(() => {
      skipped = test.result.current.shouldSkipMutation();
      test.result.current.recordHistory();
    });
    act(() => test.result.current.cancelDrag());
    expect(skipped).toBe(true);
    expect(test.args.pushHistory).not.toHaveBeenCalled();
    expect(test.args.setComponents.mock.calls.at(-1)?.[0][0]).toMatchObject({
      x: 137,
      y: 113,
    });
    expect(test.node.x()).toBe(137);
  });
  it("cancels on viewport changes and reprojects the original relative position", () => {
    const test = fixture();
    test.begin();
    test.move(304);
    test.rerender({
      ...test.args,
      previewViewport: { width: 500, height: 350 },
    });
    const restored = test.args.setComponents.mock.calls.at(-1)?.[0][0];
    expect(restored.x).toBeCloseTo(68.5, 10);
    expect(restored.y).toBeCloseTo(56.5, 10);
    expect(test.args.pushHistory).not.toHaveBeenCalled();
  });
  it("does not restore a removed component when abandoning its drag", () => {
    const test = fixture();
    test.begin();
    test.rerender({ ...test.args, components: [] });
    expect(test.args.setComponents).not.toHaveBeenCalled();
    expect(test.node.stopDrag).toHaveBeenCalled();
  });
  it("keeps grid attraction out of transformations and out of the disabled state", () => {
    const test = fixture();
    test.node.position({ x: 304, y: 113 });
    expect(test.move(304, "transform").x).toBe(304);
    test.rerender({ ...test.args, gridEnabled: false });
    expect(test.move(304).x).toBe(304);
  });
  it("keeps the idle model and history untouched when changing grid or scale", () => {
    const test = fixture();
    test.rerender({ ...test.args, gridEnabled: false, stageScale: 0.5 });
    expect(test.args.setComponents).not.toHaveBeenCalled();
    expect(test.args.pushHistory).not.toHaveBeenCalled();
  });
  it("cleans up an active drag on loss of focus", () => {
    const test = fixture();
    test.begin();
    test.move(304);
    fireEvent.blur(window);
    expect(test.node.stopDrag).toHaveBeenCalled();
    expect(test.args.pushHistory).not.toHaveBeenCalled();
  });
});
