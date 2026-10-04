import type { MovingAnchor, SnapBox, SnapBounds } from "./types";

export function getSnapBounds(box: SnapBox): SnapBounds {
  if (box.bounds) return box.bounds;
  const radians = ((box.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = cos * box.width + sin * box.height;
  const height = sin * box.width + cos * box.height;
  return { x: box.x - width / 2, y: box.y - height / 2, width, height };
}

export function translateSnapBox(
  box: SnapBox,
  dx: number,
  dy: number,
): SnapBox {
  return {
    ...box,
    x: box.x + dx,
    y: box.y + dy,
    ...(box.bounds && {
      bounds: { ...box.bounds, x: box.bounds.x + dx, y: box.bounds.y + dy },
    }),
  };
}

export function movingAnchors(box: SnapBox, axis: "x" | "y"): MovingAnchor[] {
  const bounds = getSnapBounds(box);
  const start = bounds[axis];
  const length = bounds[axis === "x" ? "width" : "height"];
  return [
    { value: start, key: "start" },
    { value: start + length / 2, key: "center" },
    { value: start + length, key: "end" },
  ];
}
