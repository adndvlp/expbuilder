import { BaseEdge, Position, type EdgeProps } from "reactflow";

type Point = {
  x: number;
  y: number;
};

type LoopRoutingEdgeData = {
  routeX?: number;
  routeY?: number;
};

const CONTROL_HORIZONTAL_OFFSET = 36;

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

function getRoundedOrthogonalPath(points: Point[], radius = 16) {
  if (points.length < 2) return "";
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
    path += ` L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`;
  }

  const last = points.at(-1)!;
  return `${path} L ${last.x} ${last.y}`;
}

function getRoutePoints({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  pathOptions,
  data,
}: EdgeProps<LoopRoutingEdgeData>): Point[] {
  const configuredOffset = pathOptions?.offset;
  const offset =
    typeof configuredOffset === "number" ? configuredOffset : 24;
  const controlOffset = Math.max(CONTROL_HORIZONTAL_OFFSET, offset);
  const source = { x: sourceX, y: sourceY };
  const target = { x: targetX, y: targetY };

  if (
    sourcePosition === Position.Left &&
    targetPosition === Position.Top
  ) {
    if (typeof data?.routeY === "number") {
      const approachX = sourceX - controlOffset;
      return [
        target,
        { x: targetX, y: data.routeY },
        { x: approachX, y: data.routeY },
        { x: approachX, y: sourceY },
        source,
      ];
    }
    if (sourceY < targetY - controlOffset) {
      return [
        target,
        { x: targetX, y: sourceY },
        source,
      ];
    }
    const approachX = sourceX - controlOffset;
    const routeY = Math.min(sourceY, targetY) - controlOffset;
    return [
      target,
      { x: targetX, y: routeY },
      { x: approachX, y: routeY },
      { x: approachX, y: sourceY },
      source,
    ];
  }

  if (
    sourcePosition === Position.Left &&
    targetPosition === Position.Right
  ) {
    const laneX = targetX + controlOffset;
    return [
      target,
      { x: laneX, y: targetY },
      { x: laneX, y: sourceY },
      source,
    ];
  }

  if (
    sourcePosition === Position.Bottom &&
    targetPosition === Position.Top
  ) {
    const laneX = data?.routeX ?? Math.max(sourceX, targetX) + offset;
    const topY = targetY - controlOffset;
    const bottomY = sourceY + controlOffset;
    return [
      target,
      { x: targetX, y: topY },
      { x: laneX, y: topY },
      { x: laneX, y: bottomY },
      { x: sourceX, y: bottomY },
      source,
    ];
  }

  if (
    sourcePosition === Position.Bottom &&
    targetPosition === Position.Left
  ) {
    if (targetY > sourceY + controlOffset) {
      return [
        target,
        { x: sourceX, y: targetY },
        source,
      ];
    }
    const approachX = targetX - controlOffset;
    const approachY = Math.max(sourceY, targetY) + controlOffset;
    return [
      target,
      { x: approachX, y: targetY },
      { x: approachX, y: approachY },
      { x: sourceX, y: approachY },
      source,
    ];
  }

  if (
    sourcePosition === Position.Right &&
    targetPosition === Position.Left
  ) {
    const laneX = sourceX + controlOffset;
    return [
      target,
      { x: laneX, y: targetY },
      { x: laneX, y: sourceY },
      source,
    ];
  }

  const laneX = data?.routeX ?? Math.max(sourceX, targetX) + offset;
  return [
    target,
    { x: laneX, y: targetY },
    { x: laneX, y: sourceY },
    source,
  ];
}

export default function LoopRoutingEdge(
  props: EdgeProps<LoopRoutingEdgeData>,
) {
  return (
    <BaseEdge
      id={props.id}
      path={getRoundedOrthogonalPath(getRoutePoints(props))}
      style={props.style}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
      interactionWidth={props.interactionWidth}
    />
  );
}
