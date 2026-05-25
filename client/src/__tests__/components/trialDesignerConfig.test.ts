import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CANVAS_STYLES } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import type {
  CanvasStyles,
  TrialComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import useConfigComponents from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents";
import useLoadComponents from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useLoadComponents";
import {
  restoreStyleFields,
  syncConfigToComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/syncConfigToComponent";

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
        screenLayouts: {
          "1440x900": { x: 10, y: 20, width: 30, height: 9 },
        },
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
