import type { GeometryEdge } from "./canvasLayoutBounds";

type SignatureNode = {
  id: string;
  position: { x: number; y: number };
};

type SignatureEdge = GeometryEdge & {
  id: string;
  source: string;
  target: string;
};

export const getCanvasLayoutSignature = (
  nodes: SignatureNode[],
  edges: SignatureEdge[],
) =>
  [
    ...nodes.map((node) => `${node.id}:${node.position.x}:${node.position.y}`),
    ...edges.map(
      (edge) =>
        `${edge.id}:${edge.source}:${edge.target}:${JSON.stringify(edge.data?.curve ?? [])}:${edge.data?.routeX ?? ""}:${edge.data?.routeTopY ?? ""}:${edge.data?.routeBottomY ?? ""}`,
    ),
  ].join("|");
