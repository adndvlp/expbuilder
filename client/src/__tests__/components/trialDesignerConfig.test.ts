import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CANVAS_STYLES } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import type {
  CanvasStyles,
  TrialComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import {
  applyComponentConfigPatch,
  typedValue,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/componentConfigUpdates";
import {
  getComponentSnapBox,
  snapBoxToGuides,
  snapComponentBox,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/editorGuides";
import useConfigComponents from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents";
import useLoadComponents from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useLoadComponents";
import {
  restoreStyleFields,
  syncConfigToComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/syncConfigToComponent";
import {
  getTextHeightForWidth,
  getTextNaturalSize,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/textSizing";
import {
  getConfigValue,
  getTextComponentModel,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/textComponentModel";

const canvasStyles: CanvasStyles = {
  ...DEFAULT_CANVAS_STYLES,
  width: 1000,
  height: 700,
  backgroundColor: "#101010",
  fullScreen: false,
};

function toJsPsychCoords(x: number, y: number) {
  return { x: x / 10, y: y / 10 };
}

function fromJsPsychCoords(coords: { x: number; y: number }) {
  return { x: coords.x * 10, y: coords.y * 10 };
}

describe("useConfigFromComponents", () => {
  it("serializes stimulus and response components into dynamic plugin columnMapping", () => {
    const textComponent: TrialComponent = {
      id: "text-1",
      type: "TextComponent",
      x: 120,
      y: 80,
      width: 300,
      height: 90,
      rotation: 15,
      zIndex: 2,
      screenLayouts: {
        "1440x900": { x: 10, y: 20, width: 30, height: 9 },
      },
      config: {
        text: { source: "typed", value: "Hello" },
        font_size: { source: "typed", value: 20 },
        font_color: { source: "typed", value: "#ff0000" },
        coordinates: { source: "typed", value: { x: 0, y: 0 } },
      },
    };
    const buttonComponent: TrialComponent = {
      id: "button-1",
      type: "ButtonResponseComponent",
      x: 500,
      y: 400,
      width: 200,
      height: 60,
      zIndex: 3,
      config: {
        button_text: { source: "typed", value: "Continue" },
        button_font_size: { source: "typed", value: 18 },
        button_color: { source: "typed", value: "#0088ff" },
      },
    };

    const { result } = renderHook(() =>
      useConfigComponents({
        toJsPsychCoords,
        columnMapping: {
          trial_duration: { source: "typed", value: 1000 },
          stale_field: { source: "none", value: null },
        },
        canvasStyles,
      }),
    );

    const config = result.current([textComponent, buttonComponent]);

    expect(config.trial_duration).toEqual({ source: "typed", value: 1000 });
    expect(config.stale_field).toBeUndefined();
    expect(config.__canvasStyles).toEqual({
      source: "typed",
      value: canvasStyles,
    });
    expect(config.components.value).toEqual([
      expect.objectContaining({
        type: "TextComponent",
        coordinates: { x: 12, y: 8 },
        width: 30,
        height: 9,
        rotation: 15,
        zIndex: 2,
        text: { source: "typed", value: "Hello" },
        font_size: { source: "typed", value: 20 },
        font_color: { source: "typed", value: "#ff0000" },
        _font_size_runtime_vw: { source: "typed", value: 2 },
      }),
    ]);
    expect(config.response_components.value).toEqual([
      expect.objectContaining({
        type: "ButtonResponseComponent",
        coordinates: { x: 50, y: 40 },
        width: 20,
        height: 6,
        zIndex: 3,
        button_text: { source: "typed", value: "Continue" },
        button_font_size: { source: "typed", value: 18 },
        button_color: { source: "typed", value: "#0088ff" },
      }),
    ]);
    expect(
      config.response_components.value[0]._button_font_size_runtime_vw,
    ).toEqual({
      source: "typed",
      value: expect.closeTo(1.8),
    });
  });

  it("removes empty component arrays from generated config", () => {
    const { result } = renderHook(() =>
      useConfigComponents({
        toJsPsychCoords,
        columnMapping: {
          components: { source: "typed", value: [{ type: "TextComponent" }] },
          response_components: {
            source: "typed",
            value: [{ type: "ButtonResponseComponent" }],
          },
        },
        canvasStyles,
      }),
    );

    const config = result.current([]);

    expect(config.components).toBeUndefined();
    expect(config.response_components).toBeUndefined();
  });

  it("serializes input response runtime font and box dimensions", () => {
    const inputComponent: TrialComponent = {
      id: "input-1",
      type: "InputResponseComponent",
      x: 300,
      y: 200,
      width: 500,
      height: 80,
      inputFontSize: 22,
      inputWidth: 240,
      config: {
        placeholder: { source: "typed", value: "Answer" },
      },
    };

    const { result } = renderHook(() =>
      useConfigComponents({
        toJsPsychCoords,
        columnMapping: {},
        canvasStyles,
      }),
    );

    const config = result.current([inputComponent]);

    expect(config.response_components.value[0]).toEqual(
      expect.objectContaining({
        type: "InputResponseComponent",
        coordinates: { x: 30, y: 20 },
        placeholder: { source: "typed", value: "Answer" },
        _input_font_size_runtime_vw: {
          source: "typed",
          value: expect.closeTo(2.2),
        },
        width: 24,
        height: expect.closeTo(3.3),
      }),
    );
  });

  it("serializes raw geometry without canvas styles and makes HTML portable", () => {
    const imageComponent = {
      id: "image-1",
      type: "ImageComponent",
      x: 100,
      y: 50,
      width: 240,
      height: 120,
    } as TrialComponent;
    const htmlComponent = {
      id: "html-1",
      type: "HtmlComponent",
      x: 20,
      y: 30,
      width: 400,
      height: 200,
      config: {
        stimulus: {
          source: "typed",
          value: '<i class="fa fa-star extra"></i>',
        },
      },
    } as TrialComponent;
    const { result } = renderHook(() =>
      useConfigComponents({
        toJsPsychCoords,
        columnMapping: {},
        canvasStyles: undefined,
      }),
    );

    const config = result.current([imageComponent, htmlComponent]);
    const [image, html] = config.components.value;

    expect(image).toEqual(
      expect.objectContaining({ width: 240, height: 120 }),
    );
    expect(html.width).toBeUndefined();
    expect(html.height).toBeUndefined();
    expect(html.stimulus.value).toContain("&#9733;");
    expect(html.stimulus.value).not.toContain("fa-star");
    expect(config.__canvasStyles).toBeUndefined();
  });

  it("uses runtime font and input-size fallbacks", () => {
    const components = [
      {
        id: "text-default",
        type: "TextComponent",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        config: { text: { source: "typed", value: "Default" } },
      },
      {
        id: "button-default",
        type: "ButtonResponseComponent",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        config: { button_text: { source: "typed", value: "Continue" } },
      },
      {
        id: "input-config",
        type: "InputResponseComponent",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        config: {
          input_font_size: { source: "typed", value: 18 },
          placeholder: { source: "typed", value: "Configured" },
        },
      },
      {
        id: "input-default",
        type: "InputResponseComponent",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    ] as TrialComponent[];
    const { result } = renderHook(() =>
      useConfigComponents({
        toJsPsychCoords,
        columnMapping: {},
        canvasStyles,
      }),
    );

    const config = result.current(components);
    expect(config.components.value[0]._font_size_runtime_vw.value).toBeCloseTo(
      1.6,
    );
    expect(
      config.response_components.value[0]._button_font_size_runtime_vw.value,
    ).toBeCloseTo(1.4);
    expect(config.response_components.value[1]).toEqual(
      expect.objectContaining({
        _input_font_size_runtime_vw: expect.objectContaining({
          source: "typed",
          value: expect.closeTo(1.8),
        }),
        width: expect.closeTo(9.9),
        height: expect.closeTo(2.7),
      }),
    );
    expect(config.response_components.value[2]).toEqual(
      expect.objectContaining({
        _input_font_size_runtime_vw: expect.objectContaining({
          source: "typed",
          value: expect.closeTo(1.6),
        }),
        width: expect.closeTo(8.8),
        height: expect.closeTo(2.4),
      }),
    );
  });
});

describe("syncConfigToComponent", () => {
  it("syncs universal geometry and text style fields without mutating the original component", () => {
    const component: TrialComponent = {
      id: "text-1",
      type: "TextComponent",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      zIndex: 0,
      config: {},
    };

    const updated = syncConfigToComponent(
      component,
      {
        coordinates: { source: "typed", value: { x: 12, y: 8 } },
        width: { source: "typed", value: 30 },
        height: { source: "typed", value: 9 },
        rotation: { source: "typed", value: 15 },
        zIndex: { source: "typed", value: 2 },
        font_color: { source: "typed", value: "#ff0000" },
        font_size: { source: "typed", value: 20 },
        text_align: { source: "typed", value: "center" },
      },
      fromJsPsychCoords,
      1000,
    );

    expect(component).toEqual(
      expect.objectContaining({ x: 0, y: 0, width: 0, height: 0 }),
    );
    expect(updated).toEqual(
      expect.objectContaining({
        x: 120,
        y: 80,
        width: 300,
        height: 90,
        rotation: 15,
        zIndex: 2,
        textFontColor: "#ff0000",
        textFontSize: 20,
        textAlign: "center",
      }),
    );
  });

  it("keeps raw geometry without a canvas width for components without style maps", () => {
    const component: TrialComponent = {
      id: "audio-1",
      type: "AudioComponent",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      config: {},
    };

    const updated = syncConfigToComponent(
      component,
      {
        width: { source: "typed", value: 240 },
        height: { source: "typed", value: 80 },
      },
      fromJsPsychCoords,
    );

    expect(updated).toMatchObject({ width: 240, height: 80 });
  });

  it("restores top-level style fields from config for loaded components", () => {
    const restored = restoreStyleFields({
      id: "button-1",
      type: "ButtonResponseComponent",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      config: {
        button_color: { source: "typed", value: "#0088ff" },
        button_text_color: { source: "typed", value: "#ffffff" },
        button_font_size: { source: "typed", value: 18 },
      },
    });

    expect(restored).toEqual(
      expect.objectContaining({
        buttonColor: "#0088ff",
        buttonTextColor: "#ffffff",
        buttonFontSize: 18,
      }),
    );
  });
});

describe("getTextNaturalSize", () => {
  it("keeps short placeholder text at the default visual size", () => {
    expect(
      getTextNaturalSize({
        text: "Text",
        fontSize: 16,
        canvasWidth: 1440,
      }),
    ).toEqual({ width: 200, height: 40 });
  });

  it("uses default max width and reads primitive text config values", () => {
    expect(
      getTextNaturalSize({
        text: "Text",
        fontSize: 16,
      }),
    ).toEqual({ width: 200, height: 40 });

    expect(
      getConfigValue(
        {
          id: "text-primitive",
          type: "TextComponent",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          config: { text: "Primitive text" },
        } as TrialComponent,
        "text",
        "fallback",
      ),
    ).toBe("Primitive text");
  });

  it("preserves falsy primitive config and defaults null typed values", () => {
    const component = {
      id: "text-falsy",
      type: "TextComponent",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      config: {
        enabled: false,
        count: 0,
        text: { source: "typed", value: null },
      },
    } as TrialComponent;

    expect(getConfigValue(component, "enabled", true)).toBe(false);
    expect(getConfigValue(component, "count", 10)).toBe(0);
    expect(getConfigValue(component, "text", "fallback")).toBe("fallback");
  });

  it("expands long text without requiring a manual resize", () => {
    const size = getTextNaturalSize({
      text: "In this task, you will see five arrows on the screen, like the example below.",
      fontSize: 16,
      canvasWidth: 1440,
    });

    expect(size.width).toBeGreaterThan(600);
    expect(size.height).toBe(40);
  });

  it("caps very long text to the canvas and grows vertically for wrapped lines", () => {
    const size = getTextNaturalSize({
      text: "word ".repeat(120),
      fontSize: 20,
      canvasWidth: 500,
    });

    expect(size.width).toBe(430);
    expect(size.height).toBeGreaterThan(40);
  });

  it("increases text box height when a fixed width forces wrapping", () => {
    const wideHeight = getTextHeightForWidth({
      text: "Thanks for your time You can close this window",
      fontSize: 65,
      lineHeight: 1.5,
      width: 900,
    });
    const narrowHeight = getTextHeightForWidth({
      text: "Thanks for your time You can close this window",
      fontSize: 65,
      lineHeight: 1.5,
      width: 360,
    });

    expect(narrowHeight).toBeGreaterThan(wideHeight);
  });

  it("falls back for empty text and invalid typography values", () => {
    expect(
      getTextNaturalSize({
        text: "",
        fontSize: Number.NaN,
        lineHeight: -1,
        canvasWidth: 1440,
      }),
    ).toEqual({ width: 200, height: 40 });

    expect(
      getTextHeightForWidth({
        text: "",
        fontSize: Number.POSITIVE_INFINITY,
        lineHeight: 0,
        width: 200,
      }),
    ).toBe(40);
  });

  it("does not let stale saved text height clip wrapped text", () => {
    const component: TrialComponent = {
      id: "text-1",
      type: "TextComponent",
      x: 500,
      y: 350,
      width: 420,
      height: 60,
      config: {
        text: {
          source: "typed",
          value: "Thanks for your time\nYou can close this window",
        },
        font_size: { source: "typed", value: 65 },
        line_height: { source: "typed", value: 1.5 },
      },
    };

    const model = getTextComponentModel(component, canvasStyles.width);

    expect(model.effectiveHeight).toBeGreaterThan(component.height);
    expect(model.drawHeight).toBe(model.effectiveHeight);
  });

  it("uses natural dimensions and combines italic and bold font styles", () => {
    const component: TrialComponent = {
      id: "text-natural",
      type: "TextComponent",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      config: {
        text: { source: "typed", value: "Natural text" },
        font_style: { source: "typed", value: "italic" },
        font_weight: { source: "typed", value: "bold" },
      },
    };

    const model = getTextComponentModel(component, canvasStyles.width);

    expect(model.effectiveWidth).toBeGreaterThanOrEqual(200);
    expect(model.effectiveHeight).toBeGreaterThanOrEqual(40);
    expect(model.konvaFontStyle).toBe("italic bold");
  });
});

describe("editor guides and visual config updates", () => {
  it("derives snap boxes for component families with component-specific defaults", () => {
    const buttonBox = getComponentSnapBox({
      id: "button-1",
      type: "ButtonResponseComponent",
      x: 80,
      y: 90,
      width: 0,
      height: 0,
      rotation: 12,
      config: {
        choices: { source: "typed", value: ["A", "B", "C"] },
        grid_rows: { source: "typed", value: 2 },
        grid_columns: { source: "typed", value: 0 },
      },
    });

    expect(buttonBox).toEqual({
      id: "button-1",
      x: 80,
      y: 90,
      width: 160,
      height: 68,
      rotation: 12,
    });

    expect(
      getComponentSnapBox({
        id: "button-fallback",
        type: "ButtonResponseComponent",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        config: {
          choices: { source: "typed", value: "Single" },
          grid_rows: { source: "typed", value: "bad" },
        },
      }),
    ).toMatchObject({ width: 80, height: 34, rotation: 0 });

    const inputBox = getComponentSnapBox({
      id: "input-1",
      type: "InputResponseComponent",
      x: 10,
      y: 20,
      width: 0,
      height: 0,
      config: {
        input_font_size: { source: "typed", value: 20 },
      },
    });

    expect(inputBox.width).toBeCloseTo(110);
    expect(inputBox.height).toBe(30);

    expect(
      getComponentSnapBox({
        id: "slider-1",
        type: "SliderResponseComponent",
        x: 10,
        y: 20,
        width: 0,
        height: 0,
        config: {},
      }),
    ).toMatchObject({ width: 300, height: 120 });

    expect(
      getComponentSnapBox({
        id: "keyboard-1",
        type: "KeyboardResponseComponent",
        x: 10,
        y: 20,
        width: 0,
        height: 0,
        config: {},
      }),
    ).toMatchObject({ width: 220, height: 48 });

    expect(
      getComponentSnapBox({
        id: "image-1",
        type: "ImageComponent",
        x: 10,
        y: 20,
        width: 0,
        height: 0,
        config: {},
      }),
    ).toMatchObject({ width: 160, height: 120 });

    expect(
      getComponentSnapBox({
        id: "audio-1",
        type: "AudioComponent",
        x: 10,
        y: 20,
        width: 0,
        height: 0,
        config: {},
      }),
    ).toMatchObject({ width: 200, height: 80 });
  });

  it("preserves configured snap dimensions and button grid columns", () => {
    expect(
      getComponentSnapBox({
        id: "button-sized",
        type: "ButtonResponseComponent",
        x: 0,
        y: 0,
        width: 420,
        height: 96,
        config: {
          choices: { source: "typed", value: ["A", "B"] },
          grid_rows: { source: "typed", value: 1 },
          grid_columns: { source: "typed", value: 4 },
        },
      }),
    ).toMatchObject({ width: 420, height: 96 });

    expect(
      getComponentSnapBox({
        id: "slider-sized",
        type: "SliderResponseComponent",
        x: 0,
        y: 0,
        width: 360,
        height: 140,
        config: {},
      }),
    ).toMatchObject({ width: 360, height: 140 });

    expect(
      getComponentSnapBox({
        id: "image-sized",
        type: "ImageComponent",
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        config: {},
      }),
    ).toMatchObject({ width: 640, height: 480 });
  });

  it("snaps moving boxes to the canvas center and returns guide lines", () => {
    const snapped = snapBoxToGuides({
      box: {
        id: "text-1",
        x: 497,
        y: 352,
        width: 120,
        height: 40,
      },
      targets: [],
      canvasWidth: 1000,
      canvasHeight: 700,
    });

    expect(snapped.x).toBe(500);
    expect(snapped.y).toBe(350);
    expect(snapped.guides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orientation: "vertical",
          position: 500,
          from: 0,
          to: 700,
        }),
        expect.objectContaining({
          orientation: "horizontal",
          position: 350,
          from: 0,
          to: 1000,
        }),
      ]),
    );
  });

  it("snaps component edges and centers to other components", () => {
    const moving: TrialComponent = {
      id: "moving",
      type: "TextComponent",
      x: 246,
      y: 120,
      width: 100,
      height: 40,
      config: {
        text: { source: "typed", value: "Moving" },
        font_size: { source: "typed", value: 16 },
      },
    };
    const target: TrialComponent = {
      id: "target",
      type: "TextComponent",
      x: 300,
      y: 120,
      width: 100,
      height: 40,
      config: {
        text: { source: "typed", value: "Target" },
        font_size: { source: "typed", value: 16 },
      },
    };

    const snapped = snapComponentBox(
      {
        id: moving.id,
        x: moving.x,
        y: moving.y,
        width: moving.width,
        height: moving.height,
      },
      [moving, target],
      canvasStyles,
    );

    expect(snapped.x).toBe(250);
    expect(snapped.y).toBe(120);
    expect(snapped.guides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orientation: "vertical",
          position: 250,
        }),
        expect.objectContaining({
          orientation: "horizontal",
          position: 100,
        }),
      ]),
    );
  });

  it("does not snap when all anchors are outside the threshold", () => {
    const snapped = snapBoxToGuides({
      box: {
        id: "text-1",
        x: 480,
        y: 320,
        width: 120,
        height: 40,
      },
      targets: [],
      canvasWidth: 1000,
      canvasHeight: 700,
    });

    expect(snapped).toEqual({ x: 480, y: 320, guides: [] });
  });

  it("applies typed config patches and restores top-level text fields", () => {
    const component: TrialComponent = {
      id: "text-1",
      type: "TextComponent",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      config: {
        text: { source: "typed", value: "Old" },
        font_color: { source: "typed", value: "#000000" },
      },
    };

    const updated = applyComponentConfigPatch(
      component,
      {
        text: typedValue("New"),
        font_color: typedValue("#ff00ff"),
      },
      { textFontColor: "#ff00ff" },
    );

    expect(updated.config.text).toEqual({ source: "typed", value: "New" });
    expect(updated.config.font_color).toEqual({
      source: "typed",
      value: "#ff00ff",
    });
    expect(updated.textFontColor).toBe("#ff00ff");
  });
});

describe("useLoadComponents", () => {
  it("loads saved stimulus and response components back into Konva component state", async () => {
    const setComponents = vi.fn();
    const setSelectedId = vi.fn();
    let currentCanvasStyles: CanvasStyles = {
      ...DEFAULT_CANVAS_STYLES,
      backgroundColor: "#202020",
      fullScreen: false,
    };
    const setCanvasStyles = vi.fn((updater) => {
      currentCanvasStyles =
        typeof updater === "function" ? updater(currentCanvasStyles) : updater;
    });

    renderHook(() =>
      useLoadComponents({
        isOpen: true,
        columnMapping: {
          components: {
            source: "typed",
            value: [
              {
                type: "TextComponent",
                coordinates: { x: 12, y: 8 },
                width: 30,
                height: 9,
                rotation: 15,
                zIndex: 2,
                text: { source: "typed", value: "Hello" },
                font_color: { source: "typed", value: "#ff0000" },
                font_size: { source: "typed", value: 20 },
              },
            ],
          },
          response_components: {
            source: "typed",
            value: [
              {
                type: "ButtonResponseComponent",
                coordinates: { x: 50, y: 40 },
                width: 20,
                height: 6,
                zIndex: 3,
                button_text: { source: "typed", value: "Continue" },
                button_color: { source: "typed", value: "#0088ff" },
              },
            ],
          },
          __canvasStyles: {
            source: "typed",
            value: {
              width: 1000,
              height: 700,
              progressBar: true,
            },
          },
        },
        fromJsPsychCoords,
        CANVAS_WIDTH: 1000,
        CANVAS_HEIGHT: 700,
        setComponents,
        setSelectedId,
        setCanvasStyles,
      }),
    );

    await waitFor(() => {
      expect(setComponents).toHaveBeenCalled();
      expect(setCanvasStyles).toHaveBeenCalled();
    });

    const loadedComponents = setComponents.mock.calls[0][0] as TrialComponent[];

    expect(setSelectedId).not.toHaveBeenCalled();
    expect(loadedComponents).toHaveLength(2);
    expect(loadedComponents[0]).toEqual(
      expect.objectContaining({
        type: "TextComponent",
        x: 120,
        y: 80,
        width: 300,
        height: 90,
        rotation: 15,
        zIndex: 2,
        textFontColor: "#ff0000",
        textFontSize: 20,
      }),
    );
    expect(loadedComponents[1]).toEqual(
      expect.objectContaining({
        type: "ButtonResponseComponent",
        x: 500,
        y: 400,
        width: 200,
        height: 60,
        zIndex: 3,
        buttonColor: "#0088ff",
      }),
    );
    expect(currentCanvasStyles).toEqual(
      expect.objectContaining({
        width: 1000,
        height: 700,
        progressBar: true,
        backgroundColor: "#202020",
        fullScreen: false,
      }),
    );
  });

  it("resets loaded state when closed and auto-sizes an empty trial on reopen", async () => {
    const setComponents = vi.fn();
    const setSelectedId = vi.fn();
    let currentCanvasStyles: CanvasStyles = {
      ...DEFAULT_CANVAS_STYLES,
      backgroundColor: "#303030",
      fullScreen: true,
    };
    const setCanvasStyles = vi.fn((updater) => {
      currentCanvasStyles =
        typeof updater === "function" ? updater(currentCanvasStyles) : updater;
    });
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: { width: 1366, height: 768 },
    });

    const props = {
      isOpen: true,
      columnMapping: {},
      fromJsPsychCoords,
      CANVAS_WIDTH: 1000,
      CANVAS_HEIGHT: 700,
      setComponents,
      setSelectedId,
      setCanvasStyles,
    };
    const { rerender } = renderHook(
      ({ isOpen }) => useLoadComponents({ ...props, isOpen }),
      { initialProps: { isOpen: true } },
    );

    await waitFor(() => {
      expect(setComponents).toHaveBeenCalledWith([]);
      expect(setSelectedId).toHaveBeenCalledWith(null);
    });
    expect(currentCanvasStyles).toEqual(
      expect.objectContaining({
        width: 1366,
        height: 768,
        backgroundColor: "#303030",
        fullScreen: true,
      }),
    );

    rerender({ isOpen: true });
    expect(setComponents).toHaveBeenCalledTimes(1);

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    await waitFor(() => {
      expect(setComponents).toHaveBeenCalledTimes(2);
    });
  });

  it("loads single legacy component entries and non-editor-sized components", async () => {
    const setComponents = vi.fn();
    const setSelectedId = vi.fn();
    let currentCanvasStyles: CanvasStyles = {
      ...DEFAULT_CANVAS_STYLES,
      backgroundColor: "#404040",
      fullScreen: false,
    };
    const setCanvasStyles = vi.fn((updater) => {
      currentCanvasStyles =
        typeof updater === "function" ? updater(currentCanvasStyles) : updater;
    });

    renderHook(() =>
      useLoadComponents({
        isOpen: true,
        columnMapping: {
          components: {
            source: "typed",
            value: {
              type: "HtmlComponent",
              stimulus: { source: "typed", value: "<p>Hello</p>" },
              width: 50,
              height: 10,
              rotation: 0,
            },
          },
          response_components: {
            source: "typed",
            value: {
              type: "FileUploadResponseComponent",
              button_label: "Upload legacy",
              coordinates: { x: 20, y: 30 },
              width: 40,
              height: 12,
            },
          },
          __canvasStyles: { source: "typed", value: {} },
        },
        fromJsPsychCoords,
        CANVAS_WIDTH: 1000,
        CANVAS_HEIGHT: 700,
        setComponents,
        setSelectedId,
        setCanvasStyles,
      }),
    );

    await waitFor(() => {
      expect(setComponents).toHaveBeenCalled();
    });
    const loadedComponents = setComponents.mock.calls[0][0] as TrialComponent[];

    expect(loadedComponents).toHaveLength(2);
    expect(loadedComponents[0]).toEqual(
      expect.objectContaining({
        type: "HtmlComponent",
        x: 500,
        y: 350,
        width: 0,
        height: 0,
        rotation: 0,
        zIndex: 0,
        config: {
          stimulus: { source: "typed", value: "<p>Hello</p>" },
        },
      }),
    );
    expect(loadedComponents[1]).toEqual(
      expect.objectContaining({
        type: "FileUploadResponseComponent",
        x: 200,
        y: 300,
        width: 0,
        height: 0,
        config: {
          button_label: { source: "typed", value: "Upload legacy" },
          coordinates: { source: "typed", value: { x: 20, y: 30 } },
        },
      }),
    );
    expect(setSelectedId).not.toHaveBeenCalled();
    expect(currentCanvasStyles).toEqual(
      expect.objectContaining({
        backgroundColor: "#404040",
        fullScreen: false,
      }),
    );
  });

  it("keeps loading idempotent in StrictMode and restores response rotation", async () => {
    const setComponents = vi.fn();
    const setSelectedId = vi.fn();
    const setCanvasStyles = vi.fn((updater) => {
      const previous: CanvasStyles = {
        ...DEFAULT_CANVAS_STYLES,
        backgroundColor: "#505050",
        fullScreen: false,
      };
      return typeof updater === "function" ? updater(previous) : updater;
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.StrictMode, null, children);

    renderHook(
      () =>
        useLoadComponents({
          isOpen: true,
          columnMapping: {
            components: {
              source: "typed",
              value: {
                type: "TextComponent",
                legacyText: "ignored",
              },
            },
            response_components: {
              source: "typed",
              value: {
                type: "ButtonResponseComponent",
                button_text: "Continue",
                width: 20,
                height: 6,
                rotation: 12,
              },
            },
          },
          fromJsPsychCoords,
          CANVAS_WIDTH: 1000,
          CANVAS_HEIGHT: 700,
          setComponents,
          setSelectedId,
          setCanvasStyles,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(setComponents).toHaveBeenCalledTimes(1);
    });
    const loadedComponents = setComponents.mock.calls[0][0] as TrialComponent[];

    expect(loadedComponents[0].config).not.toHaveProperty("legacyText");
    expect(loadedComponents[1]).toEqual(
      expect.objectContaining({
        type: "ButtonResponseComponent",
        x: 500,
        y: 350,
        width: 200,
        height: 60,
        rotation: 12,
        config: expect.objectContaining({
          button_text: { source: "typed", value: "Continue" },
          rotation: { source: "typed", value: 12 },
        }),
      }),
    );
    expect(setSelectedId).not.toHaveBeenCalled();
  });
});
