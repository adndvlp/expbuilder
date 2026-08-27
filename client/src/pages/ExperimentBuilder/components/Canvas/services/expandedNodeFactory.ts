import { getCanvasNodeDimensions } from "./canvasNodeGeometry";
import type {
  ExpandedCanvasNode,
  LayoutTimelineItem,
} from "./expandedLayoutTypes";
import { getScopedNodeId } from "./scopedNodeId";

export function createExpandedItemNode(
  nodes: ExpandedCanvasNode[],
  scopeId: string,
  item: LayoutTimelineItem,
  x: number,
  y: number,
  expanded: boolean,
) {
  const id = getScopedNodeId(scopeId, item.type, item.id);
  nodes.push({
    id,
    type: item.type,
    data: {
      scopeId,
      itemId: item.id,
      name: item.name,
      role: expanded ? "loop-marker" : "item",
      expanded,
    },
    position: { x, y },
    measured: getCanvasNodeDimensions(item.type, expanded),
    draggable: false,
  });
  return id;
}
