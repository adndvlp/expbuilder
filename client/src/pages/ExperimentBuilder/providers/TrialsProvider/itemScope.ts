import type {
  LoopTimelineCache,
  TimelineItem,
} from "../../contexts/TrialsContext";

export type TimelineItemLocation = {
  item: TimelineItem;
  parentLoopId: string | number | null;
};

const idsMatch = (
  left: string | number,
  right: string | number,
) => String(left) === String(right);

export function findTimelineItemLocation(
  id: string | number,
  timeline: TimelineItem[],
  loopTimelineCache: LoopTimelineCache,
): TimelineItemLocation | undefined {
  const rootItem = timeline.find((item) => idsMatch(item.id, id));
  if (rootItem) return { item: rootItem, parentLoopId: null };

  for (const [parentLoopId, entry] of Object.entries(loopTimelineCache)) {
    const item = entry.items.find((candidate) => idsMatch(candidate.id, id));
    if (item) {
      return {
        item,
        parentLoopId: item.parentLoopId ?? parentLoopId,
      };
    }
  }

  return undefined;
}
