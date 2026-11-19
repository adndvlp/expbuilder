import type {
  CanvasRoutingNode,
  ExpandedCanvasEdge,
} from "../services/expandedLayoutTypes";
import { routeNavigationEdges } from "../services/navigationRouting";
import { directCurve } from "../services/navigationCurve";
export function routeBoundaryEdges(
  nodes: CanvasRoutingNode[],
  edges: Pick<ExpandedCanvasEdge, "id" | "source" | "target" | "data">[],
) {
  const routable: typeof edges = [];
  for (const edge of edges) {
    const source = nodes.find((n) => n.id === edge.source),
      target = nodes.find((n) => n.id === edge.target);
    if (!source || !target) continue;
    const start = {
        x: source.position.x + source.measured.width / 2,
        y: source.position.y + source.measured.height,
      },
      end = {
        x: target.position.x + target.measured.width / 2,
        y: target.position.y,
      };
    const covered = nodes.some((n) => {
      const padding =
        n === source || n === target ? 0 : n.type === "loop" ? 18 : 12;
      return [start, end].some(
        (p) =>
          p.x > n.position.x - padding &&
          p.x < n.position.x + n.measured.width + padding &&
          p.y > n.position.y - padding &&
          p.y < n.position.y + n.measured.height + padding,
      );
    });
    if (covered) edge.data.curve = directCurve(start, end);
    else routable.push(edge);
  }
  routeNavigationEdges({ nodes, edges: routable, exitIds: [] });
}
