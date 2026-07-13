import {
  describe,
  expect,
  fromJsPsychCoords,
  it,
  restoreStyleFields,
  syncConfigToComponent,
} from "./testHarness";
import type { TrialComponent } from "./testHarness";

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
