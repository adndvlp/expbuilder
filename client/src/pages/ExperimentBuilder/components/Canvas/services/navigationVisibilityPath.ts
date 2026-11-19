import type { CanvasPoint } from "./expandedLayoutTypes";
import type { CurveObstacle } from "./navigationCurve";

const EPSILON = 1e-7;
const distance = (a: CanvasPoint, b: CanvasPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const inside = (p: CanvasPoint, b: CurveObstacle) =>
  p.x > b.left + EPSILON &&
  p.x < b.right - EPSILON &&
  p.y > b.top + EPSILON &&
  p.y < b.bottom - EPSILON;

// Intersect the segment with the open rectangle. Following a planning box's
// boundary is allowed; the planning clearance keeps it outside the real node.
function crossesBox(a: CanvasPoint, b: CanvasPoint, box: CurveObstacle) {
  let enter = 0,
    exit = 1;
  for (const [origin, delta, low, high] of [
    [a.x, b.x - a.x, box.left, box.right],
    [a.y, b.y - a.y, box.top, box.bottom],
  ]) {
    if (Math.abs(delta) < EPSILON) {
      if (origin <= low + EPSILON || origin >= high - EPSILON) return false;
    } else {
      const t1 = (low - origin) / delta,
        t2 = (high - origin) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      exit = Math.min(exit, Math.max(t1, t2));
    }
  }
  return exit - enter > EPSILON;
}

function portEscape(
  point: CanvasPoint,
  direction: 1 | -1,
  boxes: CurveObstacle[],
) {
  let length = 24;
  for (const box of boxes) {
    if (point.x <= box.left || point.x >= box.right) continue;
    if (direction === 1) {
      if (box.top <= point.y && box.bottom > point.y) return null;
      if (box.top > point.y) length = Math.min(length, (box.top - point.y) / 3);
    } else {
      if (box.top < point.y && box.bottom >= point.y) return null;
      if (box.bottom < point.y)
        length = Math.min(length, (point.y - box.bottom) / 3);
    }
  }
  return length > EPSILON
    ? { x: point.x, y: point.y + direction * length }
    : null;
}

function planningClearance(
  start: CanvasPoint,
  end: CanvasPoint,
  boxes: CurveObstacle[],
) {
  let clearance = 8;
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i];
    for (const point of [start, end]) {
      clearance = Math.min(
        clearance,
        Math.hypot(
          Math.max(a.left - point.x, point.x - a.right, 0),
          Math.max(a.top - point.y, point.y - a.bottom, 0),
        ) / 4,
      );
    }
    for (const b of boxes.slice(i + 1)) {
      const gap = Math.hypot(
        Math.max(a.left - b.right, b.left - a.right, 0),
        Math.max(a.top - b.bottom, b.top - a.bottom, 0),
      );
      if (gap > EPSILON) clearance = Math.min(clearance, gap / 4);
    }
  }
  return clearance;
}

function shortestPath(points: CanvasPoint[], boxes: CurveObstacle[]) {
  const costs = points.map(() => Infinity),
    hops = points.map(() => Infinity);
  const previous = points.map(() => -1),
    visited = new Set<number>();
  costs[0] = hops[0] = 0;
  while (visited.size < points.length) {
    let current = -1;
    for (let i = 0; i < points.length; i++) {
      if (
        !visited.has(i) &&
        (current < 0 ||
          costs[i] < costs[current] ||
          (costs[i] === costs[current] && hops[i] < hops[current]))
      )
        current = i;
    }
    if (current < 0 || !Number.isFinite(costs[current])) return null;
    if (current === 1) {
      const path: CanvasPoint[] = [];
      for (let at = 1; at !== -1; at = previous[at]) path.unshift(points[at]);
      return path;
    }
    visited.add(current);
    for (let next = 0; next < points.length; next++) {
      if (
        visited.has(next) ||
        boxes.some((box) => crossesBox(points[current], points[next], box))
      )
        continue;
      const cost = costs[current] + distance(points[current], points[next]);
      if (
        cost < costs[next] - EPSILON ||
        (Math.abs(cost - costs[next]) <= EPSILON &&
          hops[current] + 1 < hops[next])
      ) {
        costs[next] = cost;
        hops[next] = hops[current] + 1;
        previous[next] = current;
      }
    }
  }
  return null;
}

export function findObstaclePath(
  start: CanvasPoint,
  end: CanvasPoint,
  boxes: CurveObstacle[],
) {
  const first = portEscape(start, 1, boxes),
    last = portEscape(end, -1, boxes);
  if (!first || !last) return null;
  const clearance = planningClearance(first, last, boxes);
  if (clearance <= EPSILON) return null;
  const planningBoxes = boxes.map((box) => ({
    left: box.left - clearance,
    right: box.right + clearance,
    top: box.top - clearance,
    bottom: box.bottom + clearance,
  }));
  const points = [first, last],
    seen = new Set(points.map((p) => JSON.stringify(p)));
  for (const box of planningBoxes) {
    for (const x of [box.left, box.right])
      for (const y of [box.top, box.bottom]) {
        const point = { x, y },
          key = JSON.stringify(point);
        if (!seen.has(key) && !planningBoxes.some((b) => inside(point, b))) {
          points.push(point);
          seen.add(key);
        }
      }
  }
  const path = shortestPath(points, planningBoxes);
  return path ? { points: [start, ...path, end], clearance } : null;
}
