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

    expect(image).toEqual(expect.objectContaining({ width: 240, height: 120 }));
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
