import { expect, it } from "vitest";
import {
  DESIGN_SIZE,
  fitScene,
  hostToScene,
  sceneToHost,
} from "../../../../shared/dynamic-layout/scene";

it.each([
  { width: 2560, height: 1450, expectedScale: 1, x: 0, y: 0 },
  { width: 1280, height: 725, expectedScale: 0.5, x: 0, y: 0 },
  { width: 390, height: 844, expectedScale: 0.15234375, x: 0, y: 311.55078125 },
  {
    width: 3840,
    height: 2160,
    expectedScale: 2160 / 1450,
    x: 13.241379310344655,
    y: 0,
  },
])(
  "fits the complete composition in $width × $height",
  ({ width, height, expectedScale, x, y }) => {
    const fit = fitScene({ width, height }, 3)!;
    expect(fit.scale).toBeCloseTo(expectedScale, 10);
    expect(fit.offsetX).toBeCloseTo(x, 10);
    expect(fit.offsetY).toBeCloseTo(y, 10);
    expect(fit.displayWidth).toBeLessThanOrEqual(width + 1e-9);
    expect(fit.displayHeight).toBeLessThanOrEqual(height + 1e-9);
    expect(fit.rasterScale).toBeCloseTo(expectedScale * 3, 10);
    for (const point of [
      { x: 0, y: 0 },
      { x: 1280, y: 725 },
      { x: 2560, y: 1450 },
    ]) {
      const visible = sceneToHost(point, fit);
      const restored = hostToScene(visible, fit);
      expect(restored.x).toBeCloseTo(point.x, 8);
      expect(restored.y).toBeCloseTo(point.y, 8);
    }
  },
);

it.each([0, -1, NaN, Infinity])(
  "does not fit an unmeasured or invalid host dimension %s",
  (width) => {
    expect(fitScene({ width, height: 844 })).toBeNull();
    expect(fitScene({ width: 390, height: width })).toBeNull();
  },
);

it("keeps base dimensions immutable and distinguishes letterbox points", () => {
  expect(Object.isFrozen(DESIGN_SIZE)).toBe(true);
  const fit = fitScene({ width: 390, height: 844 })!;
  expect(hostToScene({ x: 195, y: 20 }, fit).y).toBeLessThan(0);
  expect(sceneToHost({ x: 1280, y: 725 }, fit)).toEqual({ x: 195, y: 422 });
});
