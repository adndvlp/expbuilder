import type { CanvasCubic, CanvasPoint } from "./expandedLayoutTypes";
import type { CurveObstacle } from "./navigationCurve";
import { findObstaclePath } from "./navigationVisibilityPath";

const direction = (from: CanvasPoint, to: CanvasPoint): CanvasPoint => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};

// One shared tangent/handle at each join gives continuous derivatives. The
// first and last tangents retain the bottom -> top connector direction.
function smoothPath(points: CanvasPoint[]) {
  const lengths = points
    .slice(1)
    .map((point, i) =>
      Math.hypot(point.x - points[i].x, point.y - points[i].y),
    );
  const handles = points.map((_, i) =>
    Math.min(
      64,
      (lengths[i - 1] ?? Infinity) * 0.35,
      (lengths[i] ?? Infinity) * 0.35,
    ),
  );
  const tangents = points.map((point, i) => {
    if (i === 0 || i === points.length - 1) return { x: 0, y: 1 };
    const incoming = direction(points[i - 1], point),
      outgoing = direction(point, points[i + 1]);
    const x = incoming.x + outgoing.x,
      y = incoming.y + outgoing.y,
      length = Math.hypot(x, y);
    return length > 1e-7
      ? { x: x / length, y: y / length }
      : { x: -incoming.y, y: incoming.x };
  });
  const curveAt = (scale: number): CanvasCubic[] =>
    points.slice(1).map((end, i) => ({
      start: points[i],
      end,
      control1: {
        x: points[i].x + tangents[i].x * handles[i] * scale,
        y: points[i].y + tangents[i].y * handles[i] * scale,
      },
      control2: {
        x: end.x - tangents[i + 1].x * handles[i + 1] * scale,
        y: end.y - tangents[i + 1].y * handles[i + 1] * scale,
      },
    }));
  return { curveAt, maxHandle: Math.max(...handles) };
}

export function findObstacleCurve(
  start: CanvasPoint,
  end: CanvasPoint,
  boxes: CurveObstacle[],
  isClear: (curve: CanvasCubic[]) => boolean,
): CanvasCubic[] | null {
  const path = findObstaclePath(start, end, boxes);
  if (!path) return null;
  const { curveAt, maxHandle } = smoothPath(path.points);
  const preferred = curveAt(1);
  if (isClear(preferred)) return preferred;

  // The visibility path has geometric clearance. Bound the displacement of
  // its control points by that clearance before increasing the smoothing.
  let lower = Math.min(1, path.clearance / (8 * maxHandle)),
    upper = 1;
  let result = curveAt(lower);
  if (!isClear(result)) return null;
  for (let i = 0; i < 8; i++) {
    const scale = (lower + upper) / 2,
      candidate = curveAt(scale);
    if (isClear(candidate)) {
      lower = scale;
      result = candidate;
    } else upper = scale;
  }
  return result;
}
