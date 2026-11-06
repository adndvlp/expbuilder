import { useRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useDesignerComponents } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/hooks/useDesignerComponents";
import { useDesignerClipboard } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/hooks/useDesignerClipboard";
import useConfigComponents from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents";
import type { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import { DESIGN_SIZE } from "../../../../shared/dynamic-layout/scene";
import { relativeCoordinates } from "../../../../shared/dynamic-layout/geometry";

it("keeps design geometry across preview sizes and undoes actual edits", () => {
  const autoSave = vi.fn();
  const { result, rerender } = renderHook(
    ({ width, height }) => {
      const previewViewport = { width, height };
      const model = useDesignerComponents();
      const componentsRef = useRef<TrialComponent[]>([]);
      componentsRef.current = model.components;
      const toJsPsychCoords = (x: number, y: number) =>
        relativeCoordinates(x, y, DESIGN_SIZE);
      const serialize = useConfigComponents({
        toJsPsychCoords,
        columnMapping: {},
      });
      const clipboard = useDesignerClipboard({
        canvasWidth: DESIGN_SIZE.width,
        canvasHeight: DESIGN_SIZE.height,
        componentsRef,
        isOpen: true,
        selectedIds: ["text"],
        setComponents: model.setComponents,
        autoSaveComponents: (components) => autoSave(serialize(components)),
        setEditingTextId: vi.fn(),
        setSelectedIds: vi.fn(),
        toJsPsychCoords,
      });
      return {
        ...model,
        previewViewport,
        ...clipboard,
        export: () => serialize(model.components),
      };
    },
    { initialProps: { width: 1000, height: 700 } },
  );
  act(() =>
    result.current.setComponents([
      {
        id: "text",
        type: "TextComponent",
        x: 1408,
        y: 580,
        width: 640,
        height: 256,
        textFontSize: 51.2,
        config: { text: { source: "typed", value: "Hello" } },
      },
    ]),
  );
  const baseline = result.current.export();
  rerender({ width: 375, height: 725 });
  expect(result.current.components[0]).toMatchObject({
    x: 1408,
    y: 580,
    width: 640,
    textFontSize: 51.2,
  });
  expect(result.current.export()).toEqual(baseline);
  expect(autoSave).not.toHaveBeenCalled();
  expect(result.current.historyCount).toBe(0);
  act(() =>
    result.current.setComponentsWithHistoryAndAutoSave((components) =>
      components.map((component) => ({
        ...component,
        x: 1920,
        y: 1015,
        width: 768,
        height: 204.8,
        textFontSize: 102.4,
      })),
    ),
  );
  const edited = autoSave.mock.calls.at(-1)![0];
  expect(edited.components.value[0]).toMatchObject({
    coordinates: { x: 50, y: -40 },
    width: 30,
    height: 8,
    _font_size_runtime_vw: { source: "typed", value: 4 },
  });
  expect(edited.components.value[0].font_size).toBeUndefined();
  rerender({ width: 1920, height: 1080 });
  expect(result.current.export()).toEqual(edited);
  expect(result.current.components[0]).toMatchObject({
    x: 1920,
    y: expect.closeTo(1015, 9),
    width: 768,
    height: 204.8,
    textFontSize: 102.4,
  });
  expect(result.current.historyCount).toBe(1);
  expect(autoSave).toHaveBeenCalledTimes(1);
  act(() => {
    result.current.undoLastChange();
  });
  expect(result.current.export()).toEqual(baseline);
  expect(result.current.components[0].width).toBe(640);
  expect(result.current.historyCount).toBe(0);
});
