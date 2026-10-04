import { describe, expect, it } from "vitest";
import { createViewportGrid } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/editorGrid";
import { snapBoxToGuides } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/editorGuides";
import { getSnapBounds } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/editorGuides/geometry";
import { DEVICE_PRESETS } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/previewViewport/devicePresets";

const viewport = { width: 2000, height: 1400 };
const grid = createViewportGrid(viewport);
const point = (x: number, y = 113) => ({
  id: "moving",
  x,
  y,
  width: 0,
  height: 0,
});
const resolve = (x: number, options: Record<string, any> = {}) =>
  snapBoxToGuides({
    box: point(x),
    targets: [],
    canvasWidth: viewport.width,
    canvasHeight: viewport.height,
    grid,
    ...options,
  });

describe("proportional viewport grid and magnetic positioning", () => {
  it.each([...DEVICE_PRESETS, { width: 1063, height: 696, label: "Custom" }])(
    "every line aligns precisely in $label ($width by $height)",
    (size) => {
      const lines = createViewportGrid(size);
      expect(lines.vertical).toHaveLength(21);
      expect(lines.horizontal).toHaveLength(21);
      for (let index = 0; index <= 20; index++) {
        const x = (size.width * index) / 20;
        const y = (size.height * index) / 20;
        expect(lines.vertical[index].position).toBe(x);
        expect(lines.horizontal[index].position).toBe(y);
        const result = snapBoxToGuides({
          box: point(x + 0.25, y + 0.25),
          targets: [],
          canvasWidth: size.width,
          canvasHeight: size.height,
          grid: lines,
        });
        expect(result.x).toBeCloseTo(x, 10);
        expect(result.y).toBeCloseTo(y, 10);
        expect(result.guides).toHaveLength(2);
      }
    },
  );

  it("aligns a component edge without moving its center onto the line", () => {
    const result = snapBoxToGuides({
      box: { id: "moving", x: 96.5, y: 137, width: 40, height: 12 },
      targets: [],
      canvasWidth: 375,
      canvasHeight: 725,
      grid: createViewportGrid({ width: 375, height: 725 }),
    });
    expect(result.x).toBe(95);
    expect(
      result.guides.find((guide) => guide.orientation === "vertical"),
    ).toMatchObject({ position: 75, source: "grid", anchor: "start" });
  });

  it.each([0, 30, 90, -30])("uses rotated bounds at %s degrees", (rotation) => {
    const box = {
      id: "rotated",
      x: 0,
      y: 113,
      width: 40,
      height: 12,
      rotation,
    };
    const halfWidth = getSnapBounds(box).width / 2;
    const result = snapBoxToGuides({
      box: { ...box, x: 300 + halfWidth + 1 },
      targets: [],
      canvasWidth: viewport.width,
      canvasHeight: viewport.height,
      grid,
    });
    expect(result.x).toBeCloseTo(300 + halfWidth, 10);
  });

  it("translates a measured box while retaining its node origin", () => {
    const result = resolve(310, {
      box: {
        id: "offset",
        x: 310,
        y: 113,
        width: 40,
        height: 10,
        bounds: { x: 301, y: 108, width: 40, height: 10 },
      },
    });
    expect(result.x).toBe(309);
    expect(result.guides[0]).toMatchObject({ position: 300, anchor: "start" });
  });

  it.each([1, 0.75, 0.5, 0.25])(
    "uses visible CSS distance at scale %s",
    (stageScale) => {
      expect(resolve(300 + 5.9 / stageScale, { stageScale }).x).toBeCloseTo(
        300,
      );
      const outside = 300 + 8.1 / stageScale;
      expect(resolve(outside, { stageScale }).x).toBeCloseTo(outside);
    },
  );

  it("retains a target until the free position exceeds the release threshold", () => {
    const first = resolve(304);
    expect(first.x).toBe(300);
    expect(resolve(307, { previous: first.guides }).x).toBe(300);
    expect(resolve(309, { previous: first.guides }).x).toBe(309);
  });

  it("releases invalidated targets and limits attraction for dense viewports", () => {
    const previous = resolve(304).guides;
    expect(resolve(307, { previous, grid: undefined }).x).toBe(307);
    const size = { width: 100, height: 100 };
    const result = snapBoxToGuides({
      box: point(21.6, 21.6),
      targets: [],
      canvasWidth: 100,
      canvasHeight: 100,
      grid: createViewportGrid(size),
    });
    expect(result.x).toBe(21.6);
  });

  it("preserves blue object alignment on a distance tie with the grid", () => {
    const targets = [{ id: "object", x: 307, y: 113, width: 2, height: 2 }];
    const result = resolve(303, { targets });
    expect(result.x).toBe(306);
    expect(
      result.guides.find((guide) => guide.orientation === "vertical"),
    ).toMatchObject({ source: "component" });
    expect(resolve(1001).guides[0]).toMatchObject({
      position: 1000,
      source: "viewport",
    });
  });

  it("chooses the same result regardless of component ordering", () => {
    const targets = [
      { id: "a", x: 297, y: 113, width: 2, height: 2 },
      { id: "b", x: 303, y: 113, width: 2, height: 2 },
    ];
    expect(resolve(300, { targets, grid: undefined })).toEqual(
      resolve(300, { targets: [...targets].reverse(), grid: undefined }),
    );
  });

  it.each([0, -1, NaN])(
    "does not adjust with invalid scale %s",
    (stageScale) => {
      expect(resolve(304, { stageScale })).toEqual({
        x: 304,
        y: 113,
        guides: [],
      });
    },
  );
});
