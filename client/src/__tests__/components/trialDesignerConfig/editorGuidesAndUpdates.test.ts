import {
  applyComponentConfigPatch,
  describe,
  expect,
  getComponentSnapBox,
  it,
  typedValue,
} from "./testHarness";
import type { TrialComponent } from "./testHarness";

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
