import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useExperimentState } from "../../../pages/ExperimentBuilder/hooks/useExpetimentState";
import {
  buildPastedComponents,
  cloneTrialComponents,
  getSelectedTrialComponents,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/designerComponentClipboard";
import { snapKonvaNode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/snapKonvaNode";
import { sampleComponent } from "./testHarness";

describe("coverage utilities: experiment state and designer helpers", () => {
  it("notifies hook subscribers when experiment version increments", () => {
    const { result } = renderHook(() => useExperimentState());
    const startingVersion = result.current.version;

    act(() => {
      result.current.incrementVersion();
    });

    expect(result.current.version).toBe(startingVersion + 1);
  });

  it("clones, selects and builds pasted trial components with new names and positions", () => {
    vi.spyOn(Date, "now").mockReturnValue(12345);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const source = sampleComponent();
    const cloned = cloneTrialComponents([source]);

    cloned[0].config.name.value = "Changed";
    expect(source.config.name.value).toBe("Title");
    expect(getSelectedTrialComponents([source], ["text-1"])).toEqual([source]);
    expect(getSelectedTrialComponents([source], ["missing"])).toEqual([]);

    const pasted = buildPastedComponents({
      clipboardComponents: [source, sampleComponent({ id: "text-2", x: 280 })],
      existingComponents: [sampleComponent({ id: "existing", zIndex: 7 })],
      canvasWidth: 300,
      canvasHeight: 200,
      pasteAt: { x: 50, y: 60 },
      toJsPsychCoords: (x, y) => ({ x: x / 2, y: y / 2 }),
    });

    expect(pasted).toHaveLength(2);
    expect(pasted[0]).toMatchObject({
      x: 50,
      y: 60,
      zIndex: 8,
    });
    expect(pasted[0].id).toBe("TextComponent-12345-0-i");
    expect(pasted[0].config.name.value).toBe("Title_copy");
    expect(pasted[0].config.coordinates.value).toEqual({ x: 25, y: 30 });
    expect(pasted[1].x).toBe(300);
    expect(pasted[1].config.name.value).toBe("Title_copy_2");

    expect(
      buildPastedComponents({
        clipboardComponents: [],
        existingComponents: [],
        canvasWidth: 100,
        canvasHeight: 100,
        pasteCount: 2,
        toJsPsychCoords: (x, y) => ({ x, y }),
      }),
    ).toEqual([]);
  });

  it("snaps Konva nodes and clears guides when no snap target exists", () => {
    const batchDraw = vi.fn();
    const node = {
      x: vi.fn((value?: number) => (value === undefined ? 10 : undefined)),
      y: vi.fn((value?: number) => (value === undefined ? 20 : undefined)),
      rotation: vi.fn(() => 3),
      getLayer: vi.fn(() => ({ batchDraw })),
    };
    const onGuidesChange = vi.fn();
    const onSnap = vi.fn(() => ({
      x: 12,
      y: 24,
      guides: [{ orientation: "vertical", position: 12, from: 0, to: 40 }],
    }));

    expect(
      snapKonvaNode({
        node: node as any,
        id: "shape-1",
        width: 100,
        height: 50,
        onSnap,
        onGuidesChange,
      }),
    ).toEqual({
      x: 12,
      y: 24,
      guides: [{ orientation: "vertical", position: 12, from: 0, to: 40 }],
    });
    expect(onSnap).toHaveBeenCalledWith({
      id: "shape-1",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 3,
    });
    expect(node.x).toHaveBeenCalledWith(12);
    expect(node.y).toHaveBeenCalledWith(24);
    expect(batchDraw).toHaveBeenCalled();
    expect(onGuidesChange).toHaveBeenCalledWith([
      { orientation: "vertical", position: 12, from: 0, to: 40 },
    ]);

    onSnap.mockReturnValue(null);
    expect(
      snapKonvaNode({
        node: node as any,
        id: "shape-1",
        width: 100,
        height: 50,
        onSnap,
        onGuidesChange,
      }),
    ).toEqual({ x: 10, y: 20, guides: [] });
    expect(onGuidesChange).toHaveBeenLastCalledWith([]);
  });
});
