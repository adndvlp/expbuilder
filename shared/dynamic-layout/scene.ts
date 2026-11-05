import type { ViewportSize } from "./geometry";

/** Internal drawing coordinates, never part of an experiment's stored config. */
export const DESIGN_SIZE = Object.freeze({ width: 2560, height: 1450 });
export type Point = { x: number; y: number };
export type SceneFit = {
  scale: number;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
  rasterScale: number;
};

export function fitScene(host: ViewportSize, dpr = 1): SceneFit | null {
  if (
    ![host.width, host.height, dpr].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    return null;
  const scale = Math.min(
    host.width / DESIGN_SIZE.width,
    host.height / DESIGN_SIZE.height,
  );
  const displayWidth = DESIGN_SIZE.width * scale;
  const displayHeight = DESIGN_SIZE.height * scale;
  return {
    scale,
    displayWidth,
    displayHeight,
    rasterScale: scale * dpr,
    offsetX: (host.width - displayWidth) / 2,
    offsetY: (host.height - displayHeight) / 2,
  };
}

export function sceneToHost(point: Point, fit: SceneFit): Point {
  return {
    x: fit.offsetX + point.x * fit.scale,
    y: fit.offsetY + point.y * fit.scale,
  };
}

export function hostToScene(point: Point, fit: SceneFit): Point {
  return {
    x: (point.x - fit.offsetX) / fit.scale,
    y: (point.y - fit.offsetY) / fit.scale,
  };
}
