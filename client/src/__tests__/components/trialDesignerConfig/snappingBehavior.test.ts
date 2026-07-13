import {
  canvasStyles,
  describe,
  expect,
  it,
  snapBoxToGuides,
  snapComponentBox,
} from "./testHarness";
import type { TrialComponent } from "./testHarness";

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
});
