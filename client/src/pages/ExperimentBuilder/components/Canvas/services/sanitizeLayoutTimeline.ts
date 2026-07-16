import type {
  LayoutItemId,
  LayoutTimelineItem,
} from "./expandedLayoutTypes";

const itemKey = (id: LayoutItemId) => String(id);

export function sanitizeLayoutTimeline(
  timeline: readonly LayoutTimelineItem[],
): LayoutTimelineItem[] {
  const items: LayoutTimelineItem[] = [];
  const byId = new Map<string, LayoutTimelineItem>();

  timeline.forEach((item) => {
    const key = itemKey(item.id);
    if (byId.has(key)) return;
    const copy = { ...item };
    items.push(copy);
    byId.set(key, copy);
  });

  const state = new Map<string, "visiting" | "visited">();
  const safeBranches = new Map<string, LayoutItemId[]>();

  const visit = (item: LayoutTimelineItem) => {
    const key = itemKey(item.id);
    state.set(key, "visiting");
    const branches: LayoutItemId[] = [];

    (item.branches ?? []).forEach((branchId) => {
      const branchKey = itemKey(branchId);
      const target = byId.get(branchKey);
      if (!target || state.get(branchKey) === "visiting") return;
      if (!state.has(branchKey)) visit(target);
      branches.push(target.id);
    });

    safeBranches.set(key, branches);
    state.set(key, "visited");
  };

  items.forEach((item) => {
    if (!state.has(itemKey(item.id))) visit(item);
  });

  return items.map((item) => ({
    ...item,
    branches:
      item.branches === undefined ? undefined : safeBranches.get(itemKey(item.id)),
    trials: item.trials === undefined ? undefined : [...item.trials],
  }));
}

export function getMainLayoutItems(
  timeline: readonly LayoutTimelineItem[],
): LayoutTimelineItem[] {
  const branchIds = new Set(
    timeline.flatMap((item) => (item.branches ?? []).map(itemKey)),
  );
  const loopTrialIds = new Set(
    timeline
      .filter((item) => item.type === "loop")
      .flatMap((item) => (item.trials ?? []).map(itemKey)),
  );

  return timeline.filter(
    (item) =>
      !branchIds.has(itemKey(item.id)) &&
      !(item.type === "trial" && loopTrialIds.has(itemKey(item.id))),
  );
}

export function getBranchTerminalItems(
  timeline: readonly LayoutTimelineItem[],
  source: LayoutTimelineItem,
): LayoutTimelineItem[] {
  const byId = new Map(timeline.map((item) => [itemKey(item.id), item]));
  const visited = new Set<string>([itemKey(source.id)]);
  const terminals: LayoutTimelineItem[] = [];

  const walk = (id: LayoutItemId) => {
    const key = itemKey(id);
    if (visited.has(key)) return;
    visited.add(key);
    const item = byId.get(key);
    if (!item) return;
    const branches = (item.branches ?? []).filter((branchId) =>
      byId.has(itemKey(branchId)),
    );
    if (branches.length === 0) {
      terminals.push(item);
      return;
    }
    branches.forEach(walk);
  };

  (source.branches ?? []).forEach(walk);
  return terminals;
}
