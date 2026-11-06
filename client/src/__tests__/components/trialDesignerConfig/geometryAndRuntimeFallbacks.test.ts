import {
  describe,
  expect,
  it,
  renderHook,
  toJsPsychCoords,
  useConfigComponents,
} from "./testHarness";
import type { TrialComponent } from "./testHarness";

describe("useConfigFromComponents", () => {
  it("serializes design geometry using the common basis and makes HTML portable", () => {
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
      }),
    );

    const config = result.current([imageComponent, htmlComponent]);
    const [image, html] = config.components.value;

    expect(image).toEqual(
      expect.objectContaining({ width: 9.375, height: 4.6875 }),
    );
    // HtmlComponent now exports its manual box size so the runtime can honor
    // a resized HTML box instead of letting content overflow the canvas.
    expect(html.width).toBe(15.625);
    expect(html.height).toBe(7.8125);
    expect(html.stimulus.value).toContain("&#9733;");
    expect(html.stimulus.value).not.toContain("fa-star");
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
      }),
    );

    const config = result.current(components);
    expect(config.components.value[0]._font_size_runtime_vw.value).toBeCloseTo(
      0.625,
    );
    expect(
      config.response_components.value[0]._button_font_size_runtime_vw.value,
    ).toBeCloseTo(0.546875);
    expect(config.response_components.value[1]).toEqual(
      expect.objectContaining({
        _input_font_size_runtime_vw: expect.objectContaining({
          source: "typed",
          value: expect.closeTo(0.703125),
        }),
        width: expect.closeTo(3.8671875),
        height: expect.closeTo(1.0546875),
      }),
    );
    expect(config.response_components.value[2]).toEqual(
      expect.objectContaining({
        _input_font_size_runtime_vw: expect.objectContaining({
          source: "typed",
          value: expect.closeTo(0.625),
        }),
        width: expect.closeTo(3.4375),
        height: expect.closeTo(0.9375),
      }),
    );
  });
});
