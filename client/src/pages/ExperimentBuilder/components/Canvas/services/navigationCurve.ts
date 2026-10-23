import type { CanvasCubic, CanvasPoint } from "./expandedLayoutTypes";

export type CurveObstacle = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};
const mix = (a: CanvasPoint, b: CanvasPoint, t = 0.5): CanvasPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const getNavigationPath = (
  curve: readonly CanvasCubic[],
  source?: CanvasPoint,
  target?: CanvasPoint,
) =>
  curve
    .map((segment, index) => {
      let { start, control1, control2, end } = segment;
      // React Flow anchors at the outer edge of each handle, not its center.
      if (index === 0 && source) {
        control1 = {
          x: control1.x + source.x - start.x,
          y: control1.y + source.y - start.y,
        };
        start = source;
      }
      if (index === curve.length - 1 && target) {
        control2 = {
          x: control2.x + target.x - end.x,
          y: control2.y + target.y - end.y,
        };
        end = target;
      }
      const point = (value: CanvasPoint) => `${value.x},${value.y}`;
      return `${index ? "" : `M ${point(start)} `}C ${point(control1)} ${point(control2)} ${point(end)}`;
    })
    .join(" ");

export const getCurvePoints = (curve: readonly CanvasCubic[]) =>
  curve.flatMap((segment) => [
    segment.start,
    segment.control1,
    segment.control2,
    segment.end,
  ]);

function split(curve: CanvasCubic): [CanvasCubic, CanvasCubic] {
  const a = mix(curve.start, curve.control1),
    b = mix(curve.control1, curve.control2),
    c = mix(curve.control2, curve.end);
  const d = mix(a, b),
    e = mix(b, c),
    middle = mix(d, e);
  return [
    { start: curve.start, control1: a, control2: d, end: middle },
    { start: middle, control1: e, control2: c, end: curve.end },
  ];
}

function clearsBox(curve: CanvasCubic, box: CurveObstacle, depth = 0): boolean {
  const points = getCurvePoints([curve]);
  const left = Math.min(...points.map((point) => point.x)),
    right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y)),
    bottom = Math.max(...points.map((point) => point.y));
  if (
    right <= box.left ||
    left >= box.right ||
    bottom <= box.top ||
    top >= box.bottom
  )
    return true;
  // Conservative subdivision, capped at 12 levels and 0.5 canvas units.
  if (depth === 12 || (right - left <= 0.5 && bottom - top <= 0.5))
    return false;
  return split(curve).every((part) => clearsBox(part, box, depth + 1));
}

export const curveIsClear = (curve: CanvasCubic[], boxes: CurveObstacle[]) =>
  curve.every((segment) => boxes.every((box) => clearsBox(segment, box)));

export function directCurve(
  start: CanvasPoint,
  end: CanvasPoint,
): CanvasCubic[] {
  const bow = Math.max(12, (end.y - start.y) / 2);
  return [
    {
      start,
      control1: { x: start.x, y: start.y + bow },
      control2: { x: end.x, y: end.y - bow },
      end,
    },
  ];
}

export function sideCurve(
  start: CanvasPoint,
  end: CanvasPoint,
  lane: number,
  amplitude = 48,
): CanvasCubic[] {
  const middle = { x: lane, y: (start.y + end.y) / 2 };
  const bow =
    end.y > start.y ? Math.min(amplitude, (end.y - start.y) / 4) : amplitude;
  return [
    {
      start,
      control1: { x: start.x, y: start.y + bow },
      control2: { x: lane, y: start.y + bow },
      end: middle,
    },
    {
      start: middle,
      control1: { x: lane, y: end.y - bow },
      control2: { x: end.x, y: end.y - bow },
      end,
    },
  ];
}

type CurveLane = { side: "left" | "right"; x: number };

// The same two joined cubics as the approved HTML. Search only their geometric
// parameters: tangent amplitude and exterior lane. A collision never switches
// the edge to an orthogonal path.
export function findNavigationCurve(
  start: CanvasPoint,
  end: CanvasPoint,
  boxes: CurveObstacle[],
  lanes: CurveLane[],
  exterior: boolean,
): { curve: CanvasCubic[]; side: CurveLane["side"] | null } {
  const direct = directCurve(start, end);
  if (!exterior && end.y > start.y && curveIsClear(direct, boxes))
    return { curve: direct, side: null };
  const nominal = end.y > start.y ? Math.min(90, (end.y - start.y) / 4) : 48;
  const amplitudes = [
    ...new Set(
      [1, 0.5, 0.25, 1.5, 2].map((factor) =>
        Math.max(12, Math.min(180, nominal * factor)),
      ),
    ),
  ];
  // Expand away from the endpoints, not along a fixed number of graph rows.
  // Every candidate is checked against the same obstacle geometry.
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidates = lanes
      .flatMap(({ side, x }) => {
        const anchor =
          side === "right"
            ? Math.max(start.x, end.x)
            : Math.min(start.x, end.x);
        const lane = anchor + (x - anchor) * 2 ** attempt;
        for (const amplitude of amplitudes) {
          const curve = sideCurve(start, end, lane, amplitude);
          if (curveIsClear(curve, boxes))
            return [
              {
                curve,
                side,
                cost: Math.abs(lane - start.x) + Math.abs(lane - end.x),
              },
            ];
        }
        return [];
      })
      .sort((a, b) => a.cost - b.cost);
    if (candidates.length) return candidates[0];
  }
  throw new Error("Canvas curve cannot be routed outside node bounds");
}
