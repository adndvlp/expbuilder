import { describe, expect, it } from "vitest";
import {
  getConfigValue,
  getHtmlSceneNode,
  getHtmlSceneNodes,
  isHtmlSceneComponent,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/sceneModel";
import type {
  PreviewViewport,
  TrialComponent,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

function component(
  type: TrialComponent["type"],
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: `${type}-${Math.random()}`,
    type,
    x: 100,
    y: 80,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: 0,
    config: {},
    ...overrides,
  } as TrialComponent;
}

const previewViewport: PreviewViewport = {
  width: 600,
  height: 400,
};

describe("coverage core branches: HTML scene model", () => {
  it("covers config values, fallback sizes, metrics and sorting", () => {
    expect(isHtmlSceneComponent("TextComponent")).toBe(true);
    expect(isHtmlSceneComponent("AudioComponent" as any)).toBe(false);
    expect(
      getConfigValue(component("TextComponent"), "missing", "fallback"),
    ).toBe("fallback");
    expect(
      getConfigValue(
        component("TextComponent", { config: { text: { source: "none" } } }),
        "text",
        "fallback",
      ),
    ).toBe("fallback");
    expect(
      getConfigValue(
        component("TextComponent", {
          config: { text: { source: "typed", value: "hello" } },
        }),
        "text",
        "fallback",
      ),
    ).toBe("hello");
    expect(
      getConfigValue(
        component("TextComponent", {
          config: { text: { source: "typed", value: null } },
        }),
        "text",
        "fallback",
      ),
    ).toBe("fallback");
    expect(
      getConfigValue(
        component("TextComponent", { config: { text: "raw" } }),
        "text",
        "",
      ),
    ).toBe("raw");

    const configured = getHtmlSceneNode(
      component("TextComponent", {
        id: "configured",
        x: 300,
        y: 200,
        config: {
          width: { source: "typed", value: 50 },
          height: { source: "typed", value: 25 },
        },
      }),
      previewViewport,
    )!;
    expect(configured).toMatchObject({
      left: 150,
      top: 125,
      width: 300,
      height: 150,
      rotation: 0,
      zIndex: 0,
    });

    expect(
      getHtmlSceneNode(component("AudioComponent" as any), previewViewport),
    ).toBeNull();
    expect(
      getHtmlSceneNode(
        component("HtmlComponent", { id: "metric" }),
        previewViewport,
        { metric: { width: 10, height: 20 } },
      )!.width,
    ).toBe(10);
    expect(
      getHtmlSceneNode(
        component("HtmlComponent", { id: "fallback" }),
        previewViewport,
      ),
    ).toMatchObject({ width: 120, height: 40 });
    expect(
      getHtmlSceneNode(
        component("TextComponent", { width: 220, height: 60 }),
        previewViewport,
      ),
    ).toMatchObject({ width: 220, height: 60 });
    expect(
      getHtmlSceneNode(component("SurveyComponent"), previewViewport)!.height,
    ).toBe(240);

    expect(
      getHtmlSceneNode(
        component("SketchpadComponent", {
          config: {
            canvas_shape: { source: "typed", value: "circle" },
            canvas_diameter: { source: "typed", value: 75 },
          },
        }),
        previewViewport,
      ),
    ).toMatchObject({ width: 75, height: 115 });
    expect(
      getHtmlSceneNode(
        component("SketchpadComponent", {
          config: {
            canvas_width: { source: "typed", value: 180 },
            canvas_height: { source: "typed", value: 90 },
          },
        }),
        previewViewport,
      ),
    ).toMatchObject({ width: 180, height: 130 });
    expect(
      getHtmlSceneNode(
        component("SliderResponseComponent", {
          config: { height: { source: "typed", value: 20 } },
        }),
        previewViewport,
      ),
    ).toMatchObject({ width: 300, height: 120 });
    expect(
      getHtmlSceneNode(component("SliderResponseComponent"), previewViewport),
    ).toMatchObject({ width: 300, height: 120 });

    expect(
      getHtmlSceneNode(
        component("InputResponseComponent", {
          inputFontSize: 20,
          inputWidth: 240,
        } as any),
        previewViewport,
      ),
    ).toMatchObject({ width: 240, height: 30 });
    expect(
      getHtmlSceneNode(
        component("InputResponseComponent", {
          config: {
            width: { source: "typed", value: 50 },
            input_font_size: { source: "typed", value: 18 },
          },
        }),
        previewViewport,
      ),
    ).toMatchObject({ width: 300, height: 27 });
    const computedInput = getHtmlSceneNode(
      component("InputResponseComponent", {
        config: { input_font_size: { source: "typed", value: 10 } },
      }),
      previewViewport,
    )!;
    expect(computedInput.width).toBeCloseTo(55);
    expect(computedInput.height).toBe(15);

    expect(
      getHtmlSceneNode(component("ButtonResponseComponent"), previewViewport),
    ).toMatchObject({ width: 80, height: 34 });
    expect(
      getHtmlSceneNode(component("ImageComponent"), previewViewport),
    ).toMatchObject({ width: 1, height: 1 });
    expect(
      getHtmlSceneNode(component("FileUploadResponseComponent"), previewViewport),
    ).toMatchObject({ width: 120, height: 40 });
    expect(
      getHtmlSceneNode(
        component("TextComponent", { id: "no-z", zIndex: undefined }),
        previewViewport,
      )!.zIndex,
    ).toBe(0);

    const sorted = getHtmlSceneNodes(
      [
        component("TextComponent", { id: "high", zIndex: 10 }),
        component("TextComponent", { id: "low", zIndex: 1 }),
        component("AudioComponent" as any, { id: "ignored" }),
      ],
      previewViewport,
    );
    expect(sorted.map((node) => node.id)).toEqual(["low", "high"]);
  });
});
