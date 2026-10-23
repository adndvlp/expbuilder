import type {
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
} from "./expandedLayoutTypes";

import { findNavigationCurve } from "./navigationCurve";

const bounds = (node: ExpandedCanvasNode, padding = 18) => ({
  left: node.position.x - padding,
  right: node.position.x + node.measured.width + padding,
  top: node.position.y - padding,
  bottom: node.position.y + node.measured.height + padding,
});

export function routeNavigationEdges(layout: ExpandedCanvasLayout) {
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  const occupiedLanes: { side: string; top: number; bottom: number }[] = [];
  const span = (edge: ExpandedCanvasLayout["edges"][number]) => {
    const source = nodes.get(edge.source)!,
      target = nodes.get(edge.target)!;
    return Math.abs(
      target.position.y - source.position.y - source.measured.height,
    );
  };
  // Reserve the inner lanes for local returns before routing larger bypasses.
  for (const edge of [...layout.edges].sort(
    (a, b) => span(a) - span(b) || a.id.localeCompare(b.id),
  )) {
    if (edge.data.kind !== "flow") continue;
    const source = nodes.get(edge.source)!,
      target = nodes.get(edge.target)!;
    const start = {
      x: source.position.x + source.measured.width / 2,
      y: source.position.y + source.measured.height,
    };
    const end = {
      x: target.position.x + target.measured.width / 2,
      y: target.position.y,
    };
    const boxes = layout.nodes.map((node) =>
      bounds(
        node,
        node.id === source.id || node.id === target.id
          ? 0
          : node.type === "loop"
            ? 18
            : 12,
      ),
    );
    const returning = edge.data.isReturn || end.y <= start.y;
    const top = Math.min(start.y, end.y) - 48;
    const bottom = Math.max(start.y, end.y) + 48;
    const nearby = boxes.filter(
      (box) => box.bottom >= top && box.top <= bottom,
    );
    const right = Math.max(start.x, end.x, ...nearby.map((box) => box.right));
    const left = Math.min(start.x, end.x, ...nearby.map((box) => box.left));
    const exteriorLanes = (["right", "left"] as const).map((side) => {
      const occupied = occupiedLanes.filter(
        (lane) => lane.side === side && lane.bottom > top && lane.top < bottom,
      ).length;
      const offset = 72 + occupied * 32;
      return { side, x: side === "right" ? right + offset : left - offset };
    });
    const route = findNavigationCurve(
      start,
      end,
      boxes,
      exteriorLanes,
      Boolean(returning || edge.data.isShortcut),
    );
    edge.data.curve = route.curve;
    if (route.side) {
      occupiedLanes.push({ side: route.side, top, bottom });
    }
  }
}
