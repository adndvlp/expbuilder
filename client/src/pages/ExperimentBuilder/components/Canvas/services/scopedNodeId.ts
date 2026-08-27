import type { LayoutItemId, LayoutTimelineItem } from "./expandedLayoutTypes";

export const getScopedNodeId = (
  scopeId: string,
  type: LayoutTimelineItem["type"],
  itemId: LayoutItemId,
) =>
  `${encodeURIComponent(scopeId)}::${type}::${encodeURIComponent(String(itemId))}`;
