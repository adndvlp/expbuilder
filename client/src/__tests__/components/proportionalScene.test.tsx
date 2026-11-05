import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useDesignerComponents } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/hooks/useDesignerComponents";
import useConfigComponents from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents";
import type { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import { relativeCoordinates } from "../../../../shared/dynamic-layout/geometry";
import { getViewport } from "../../../../server/dynamicplugin/layout/RuntimeViewport";

const design = { width: 2560, height: 1450 };
const text: TrialComponent = {
  id: "welcome",
  type: "TextComponent",
  x: 1280,
  y: 290,
  width: 512,
  height: 128,
  textFontSize: 64,
  config: { text: { source: "typed", value: "Welcome" } },
};

it("keeps the editable composition unchanged when selecting another preview screen", () => {
  const { result, rerender } = renderHook(
    ({ viewport }) => ({
      ...useDesignerComponents(),
      previewViewport: viewport,
    }),
    { initialProps: { viewport: design } },
  );
  act(() => result.current.setComponents([text]));
  const original = result.current.components;
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 3840, height: 2160 },
  ]) {
    rerender({ viewport });
    expect(result.current.previewViewport).toEqual(viewport);
    expect(result.current.components).toEqual(original);
  }
});

it.each([
  { width: 390, height: 844 },
  { width: 3840, height: 2160 },
])(
  "serializes the same design independently of preview %j",
  (previewViewport) => {
    const options = {
      columnMapping: {},
      previewViewport,
      toJsPsychCoords: (x: number, y: number) =>
        relativeCoordinates(x, y, design),
    };
    const serialize = useConfigComponents(options);
    expect(serialize([text]).components.value[0]).toMatchObject({
      coordinates: { x: 0, y: 60 },
      width: 20,
      height: 5,
      _font_size_runtime_vw: { source: "typed", value: 2.5 },
    });
  },
);

it("uses the shared logical size when a component obtains its layout context", () => {
  expect(getViewport({})).toMatchObject(design);
});
