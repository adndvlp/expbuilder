import {
  canvasStyles,
  describe,
  expect,
  it,
  renderHook,
  toJsPsychCoords,
  useConfigComponents,
} from "./testHarness";
import type { TrialComponent } from "./testHarness";

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
});
