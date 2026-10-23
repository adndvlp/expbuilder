import type { CanvasPoint, CanvasCubic } from "./expandedLayoutTypes";
import { getCanvasNodeDimensions } from "./canvasNodeGeometry";
import { getCurvePoints } from "./navigationCurve";

export type CanvasBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type GeometryNode = {
  position: CanvasPoint;
  type?: string;
  measured?: { width: number; height: number };
  data?: { expanded?: boolean };
};
export type GeometryEdge = {
  id?: string;
  data?: {
    curve?: CanvasCubic[];
    routeX?: number;
    routeTopY?: number;
    routeBottomY?: number;
  };
};

export function getCanvasLayoutBounds(
  nodes: GeometryNode[],
  edges: GeometryEdge[],
): CanvasBounds | undefined {
  if (!nodes.length) return;
  const points: CanvasPoint[] = nodes.flatMap((node) => {
    const size =
      node.measured ??
      getCanvasNodeDimensions(
        node.type === "loop" ? "loop" : "trial",
        Boolean(node.data?.expanded),
      );
    return [
      { x: node.position.x - 12, y: node.position.y - 12 },
      {
        x: node.position.x + size.width + 12,
        y: node.position.y + size.height + 40,
      },
    ];
  });
  for (const edge of edges) {
    // Include the measured handle anchors and arrowheads around the planned curve.
    for (const point of getCurvePoints(edge.data?.curve ?? [])) {
      points.push(
        { x: point.x - 16, y: point.y - 16 },
        { x: point.x + 16, y: point.y + 16 },
      );
    }
    const { routeX, routeTopY, routeBottomY } = edge.data ?? {};
    if (
      routeX !== undefined &&
      routeTopY !== undefined &&
      routeBottomY !== undefined
    )
      points.push({ x: routeX, y: routeTopY }, { x: routeX, y: routeBottomY });
  }
  const x = Math.min(...points.map((point) => point.x)),
    y = Math.min(...points.map((point) => point.y));
  return {
    x,
    y,
    width: Math.max(...points.map((point) => point.x)) - x,
    height: Math.max(...points.map((point) => point.y)) - y,
  };
}
