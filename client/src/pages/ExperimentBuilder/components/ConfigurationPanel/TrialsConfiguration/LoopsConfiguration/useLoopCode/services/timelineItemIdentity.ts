import type { LoopData, TimelineItem } from "../types";

export const isLoopData = (item: TimelineItem): item is LoopData =>
  "isLoop" in item && item.isLoop === true;

export const getLoopId = (loop: LoopData): string | number | null =>
  loop.loopId || loop.id || null;

export const getTimelineItemId = (
  item: TimelineItem,
): string | number | null =>
  isLoopData(item) ? getLoopId(item) : (item.id ?? null);

export const getTimelineItemName = (item: TimelineItem): string => {
  if (!isLoopData(item)) return item.trialName;

  return item.loopName || item.name || String(getLoopId(item) ?? "Loop");
};

export const generateDescendantIdEntries = (
  items: TimelineItem[],
  sanitizeName: (name: string) => string,
): string =>
  items
    .flatMap((item) => {
      const itemId = getTimelineItemId(item);
      if (itemId === null) return [];
      if (!isLoopData(item)) return [JSON.stringify(itemId)];

      const nestedId = sanitizeName(String(itemId));
      return [
        JSON.stringify(itemId),
        `...loop_${nestedId}_DescendantIds`,
      ];
    })
    .join(", ");
