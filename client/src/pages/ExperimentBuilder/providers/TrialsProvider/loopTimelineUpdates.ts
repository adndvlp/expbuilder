import type { Loop } from "../../components/ConfigurationPanel/types";
import type {
  NewBranchItem,
  TimelineItem,
} from "../../contexts/TrialsContext";

type ItemId = string | number;

export type LoopTimelineChanges = {
  name?: string;
  branches?: ItemId[];
  trials?: ItemId[];
};

const idsMatch = (left: ItemId, right: ItemId) =>
  String(left) === String(right);

const arraysMatch = (
  left: ItemId[] | undefined,
  right: ItemId[] | undefined,
) =>
  (left?.length ?? 0) === (right?.length ?? 0) &&
  (left ?? []).every((value, index) =>
    idsMatch(value, (right ?? [])[index]),
  );

const hasOwn = (value: object, key: keyof LoopTimelineChanges) =>
  Object.prototype.hasOwnProperty.call(value, key);

const isItemIdArray = (value: unknown): value is ItemId[] =>
  Array.isArray(value) &&
  value.every(
    (item) => typeof item === "string" || typeof item === "number",
  );

export function getLoopTimelineChanges(
  loop: Partial<Loop>,
): LoopTimelineChanges | null {
  const changes: LoopTimelineChanges = {};
  if (hasOwn(loop, "name") && typeof loop.name === "string") {
    changes.name = loop.name;
  }
  if (hasOwn(loop, "branches") && isItemIdArray(loop.branches)) {
    changes.branches = loop.branches;
  }
  if (hasOwn(loop, "trials") && isItemIdArray(loop.trials)) {
    changes.trials = loop.trials;
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

export function getLoopTimelineFieldChanges(
  fieldName: string,
  value: unknown,
): LoopTimelineChanges | null {
  if (fieldName === "name" && typeof value === "string") {
    return { name: value };
  }
  if (fieldName === "branches" && isItemIdArray(value)) {
    return { branches: value };
  }
  if (fieldName === "trials" && isItemIdArray(value)) {
    return { trials: value };
  }
  return null;
}

export function getLoopTimelineSnapshot(loop: Loop): LoopTimelineChanges {
  return {
    name: loop.name,
    branches: loop.branches ?? [],
    trials: loop.trials ?? [],
  };
}

function toBranchItem(item: NewBranchItem): TimelineItem {
  const type =
    item.plugin !== undefined
      ? "trial"
      : item.trials !== undefined
        ? "loop"
        : "trial";
  return {
    id: item.id,
    type,
    name: item.name,
    branches: item.branches ?? [],
    ...(type === "loop" ? { trials: item.trials ?? [] } : {}),
  };
}

export function updateLoopTimeline(
  items: TimelineItem[],
  id: ItemId,
  changes: LoopTimelineChanges,
  newBranchItem?: NewBranchItem,
) {
  let targetFound = false;
  let changed = false;
  const updated = items.map((item) => {
    if (item.type !== "loop" || !idsMatch(item.id, id)) return item;
    targetFound = true;
    const name = hasOwn(changes, "name") ? changes.name! : item.name;
    const branches = hasOwn(changes, "branches")
      ? changes.branches
      : item.branches;
    const trials = hasOwn(changes, "trials") ? changes.trials : item.trials;
    if (
      name === item.name &&
      arraysMatch(item.branches, branches) &&
      arraysMatch(item.trials, trials)
    ) {
      return item;
    }
    changed = true;
    return { ...item, name, branches, trials };
  });
  if (!targetFound) return items;

  const branchIds = changes.branches ?? [];
  const existingIds = new Set(updated.map((item) => String(item.id)));
  const missingIds = branchIds.filter(
    (branchId) => !existingIds.has(String(branchId)),
  );
  if (missingIds.length === 0) return changed ? updated : items;

  return [
    ...updated,
    ...missingIds.map((branchId): TimelineItem => {
      if (newBranchItem && idsMatch(newBranchItem.id, branchId)) {
        return toBranchItem(newBranchItem);
      }
      return {
        id: branchId,
        type: "trial",
        name: "Loading...",
        branches: [],
      };
    }),
  ];
}
