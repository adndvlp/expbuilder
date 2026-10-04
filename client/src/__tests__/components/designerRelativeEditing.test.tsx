import { useRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useDesignerComponents } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/hooks/useDesignerComponents";
import { useDesignerClipboard } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/hooks/useDesignerClipboard";
import useConfigComponents from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents";
import type { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import { relativeCoordinates } from "../../../../shared/dynamic-layout/geometry";

it("exports mobile geometry and fonts relatively, and undoes across preview sizes", () => {
  const autoSave = vi.fn();
  const { result, rerender } = renderHook(
    ({ width, height }) => {
      const previewViewport = {
        width,
        height,
      };
      const model = useDesignerComponents(previewViewport);
      const componentsRef = useRef<TrialComponent[]>([]);
      componentsRef.current = model.components;
      const toJsPsychCoords = (x: number, y: number) =>
        relativeCoordinates(x, y, previewViewport);
      const serialize = useConfigComponents({
        toJsPsychCoords,
        previewViewport,
        columnMapping: {},
      });
      const clipboard = useDesignerClipboard({
        canvasWidth: width,
        canvasHeight: height,
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
        x: 550,
        y: 280,
        width: 250,
        height: 100,
        textFontSize: 20,
        config: { text: { source: "typed", value: "Hello" } },
      },
    ]),
  );
  const baseline = result.current.export();
  rerender({ width: 375, height: 725 });
  expect(result.current.components[0]).toMatchObject({
    x: expect.closeTo(206.25),
    y: 290,
    width: 93.75,
    textFontSize: 7.5,
  });
  expect(result.current.export()).toEqual(baseline);
  expect(autoSave).not.toHaveBeenCalled();
  expect(result.current.historyCount).toBe(0);
  act(() =>
    result.current.setComponentsWithHistoryAndAutoSave((components) =>
      components.map((component) => ({
        ...component,
        x: 281.25,
        y: 507.5,
        width: 112.5,
        height: 30,
        textFontSize: 15,
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
  expect(edited.__canvasStyles).toBeUndefined();
  expect(edited.components.value[0].font_size).toBeUndefined();
  rerender({ width: 1920, height: 1080 });
  expect(result.current.export()).toEqual(edited);
  expect(result.current.components[0]).toMatchObject({
    x: 1440,
    y: 756,
    width: 576,
    height: 153.6,
    textFontSize: 76.8,
  });
  expect(result.current.historyCount).toBe(1);
  expect(autoSave).toHaveBeenCalledTimes(1);
  act(() => {
    result.current.undoLastChange();
  });
  expect(result.current.export()).toEqual(baseline);
  expect(result.current.components[0].width).toBe(480);
  expect(result.current.historyCount).toBe(0);
});
