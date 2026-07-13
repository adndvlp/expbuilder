import {
  canvasStyles,
  describe,
  expect,
  getConfigValue,
  getTextComponentModel,
  getTextHeightForWidth,
  getTextNaturalSize,
  it,
} from "./testHarness";
import type { TrialComponent } from "./testHarness";

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
