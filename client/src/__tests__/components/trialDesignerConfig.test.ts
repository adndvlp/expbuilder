import { renderHook, waitFor } from "@testing-library/react";
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
import { getTextComponentModel } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/textComponentModel";

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
});

describe("editor guides and visual config updates", () => {
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
});
