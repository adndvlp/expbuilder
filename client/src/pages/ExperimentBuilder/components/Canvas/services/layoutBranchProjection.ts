import type { GraphBranchEdge } from "../../../modules/experiment-graph/types";
import type { LayoutItemId, LayoutTimelineItem } from "./expandedLayoutTypes";

const idKey = (id: LayoutItemId) => String(id);
export const layoutConnectionKey = (
  source: LayoutItemId,
  target: LayoutItemId,
) => JSON.stringify([idKey(source), idKey(target)]);

// Adjacency here positions visible blocks. It never becomes a loop's branches.
export function projectLayoutBranches(
  timeline: readonly LayoutTimelineItem[],
  ownerId: string | null,
  edges: readonly GraphBranchEdge[],
  scopeParents: Readonly<Record<string, string | null>>,
  rawTimeline: readonly LayoutTimelineItem[] = timeline,
) {
  const items = new Map(timeline.map((item) => [idKey(item.id), item]));
  const targetsBySource = new Map<string, LayoutItemId[]>(
    timeline.map((item) => [idKey(item.id), [...(item.branches ?? [])]]),
  );
  const canonicalPairs = new Set<string>();
  const outgoingSources = new Set<string>();

  const visibleItem = (itemId: LayoutItemId, itemOwnerId: string | null) => {
    if (itemOwnerId === ownerId) {
      const item = items.get(idKey(itemId));
      return item?.type === "trial" ? item : undefined;
    }
    const visited = new Set<string>();
    let ancestor = itemOwnerId;
    while (ancestor !== null && !visited.has(ancestor)) {
      visited.add(ancestor);
      const item = items.get(idKey(ancestor));
      if (item?.type === "loop") return item;
      ancestor = scopeParents[ancestor] ?? null;
    }
    return undefined;
  };

  // Keep the authored ordering when some targets project to containers.
  rawTimeline.forEach((item) => {
    if (item.type !== "trial") return;
    const ordered: LayoutItemId[] = [];
    (item.branches ?? []).forEach((targetId) => {
      const canonical = edges.find(
        (edge) =>
          edge.sourceOwnerId === ownerId &&
          idKey(edge.sourceId) === idKey(item.id) &&
          idKey(edge.targetId) === idKey(targetId),
      );
      const target = canonical
        ? visibleItem(targetId, canonical.targetOwnerId)
        : items.get(idKey(targetId));
      const localTargets = targetsBySource.get(idKey(item.id)) ?? [];
      if (
        !target ||
        (!canonical &&
          !localTargets.some((id) => idKey(id) === idKey(target.id)))
      )
        return;
      if (!ordered.some((id) => idKey(id) === idKey(target.id)))
        ordered.push(target.id);
    });
    targetsBySource.set(idKey(item.id), ordered);
  });

  edges.forEach((edge) => {
    const source = visibleItem(edge.sourceId, edge.sourceOwnerId);
    const target = visibleItem(edge.targetId, edge.targetOwnerId);
    if (!source || source.id === target?.id) return;
    outgoingSources.add(idKey(source.id));
    if (!target) return;
    const targets = targetsBySource.get(idKey(source.id))!;
    if (!targets.some((id) => idKey(id) === idKey(target.id)))
      targets.push(target.id);
    canonicalPairs.add(layoutConnectionKey(source.id, target.id));
  });
  return { targetsBySource, canonicalPairs, outgoingSources };
}
