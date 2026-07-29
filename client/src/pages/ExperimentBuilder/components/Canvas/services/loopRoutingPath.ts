type Point = {
  x: number;
  y: number;
};

export type LoopCircuitPointInput = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  routeX?: number;
  routeTopY?: number;
  routeBottomY?: number;
};

const distance = (from: Point, to: Point) =>
  Math.hypot(to.x - from.x, to.y - from.y);

function toward(from: Point, to: Point, amount: number): Point {
  const total = distance(from, to);
  if (total === 0) return from;
  const ratio = amount / total;
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function getRoundedPath(points: Point[], radius = 16) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const cornerRadius = Math.min(
      radius,
      distance(previous, corner) / 2,
      distance(corner, next) / 2,
    );
    const entry = toward(corner, previous, cornerRadius);
    const exit = toward(corner, next, cornerRadius);
    path += ` L ${entry.x} ${entry.y}`;
    path += ` Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`;
  }
  const last = points[points.length - 1]!;
  return `${path} L ${last.x} ${last.y}`;
}

export function getLoopCircuitPoints({
  sourceX,
  sourceY,
  targetX,
  targetY,
  routeX,
  routeTopY,
  routeBottomY,
}: LoopCircuitPointInput): Point[] {
  const rightX = routeX ?? Math.max(sourceX, targetX) + 44;
  const topY = routeTopY ?? Math.min(sourceY, targetY) - 44;
  const bottomY =
    routeBottomY ?? Math.max(sourceY, targetY) + 44;
  return [
    { x: targetX, y: targetY },
    { x: targetX, y: topY },
    { x: rightX, y: topY },
    { x: rightX, y: bottomY },
    { x: sourceX, y: bottomY },
    { x: sourceX, y: sourceY },
  ];
}

export const getLoopCircuitPath = (input: LoopCircuitPointInput) =>
  getRoundedPath(getLoopCircuitPoints(input));
