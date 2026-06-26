export type BranchGraphItem = {
  id: string | number;
  type?: "trial" | "loop" | string;
  name?: string;
  branches?: (string | number)[];
  trials?: (string | number)[];
};

export function idsEqual(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  return String(a) === String(b);
}

export function itemIdKey(id: string | number): string {
  return String(id);
}

export function findGraphItem<T extends BranchGraphItem>(
  items: T[],
  id: string | number,
): T | undefined {
  return items.find((item) => idsEqual(item.id, id));
}

export function includesId(
  ids: (string | number)[] | undefined,
  id: string | number,
): boolean {
  return Boolean(ids?.some((candidate) => idsEqual(candidate, id)));
}

export function appendUniqueId<T extends string | number>(
  ids: T[] | undefined,
  id: T,
): T[] {
  const current = ids || [];
  return includesId(current, id) ? current : [...current, id];
}

export function removeId<T extends string | number>(
  ids: T[] | undefined,
  id: string | number,
): T[] {
  return (ids || []).filter((candidate) => !idsEqual(candidate, id));
}

export function getIncomingParentMap<T extends BranchGraphItem>(
  items: T[],
): Map<string, (string | number)[]> {
  const parentMap = new Map<string, (string | number)[]>();

  items.forEach((item) => {
    (item.branches || []).forEach((branchId) => {
      const key = itemIdKey(branchId);
      const parents = parentMap.get(key) || [];
      if (!includesId(parents, item.id)) {
        parents.push(item.id);
      }
      parentMap.set(key, parents);
    });
  });

  return parentMap;
}

export function getMergePointIds<T extends BranchGraphItem>(
  items: T[],
): Set<string> {
  const parentMap = getIncomingParentMap(items);
  const mergeIds = new Set<string>();

  parentMap.forEach((parents, itemId) => {
    if (parents.length > 1) {
      mergeIds.add(itemId);
    }
  });

  return mergeIds;
}

export function isMergePoint(
  mergePointIds: Set<string>,
  id: string | number,
): boolean {
  return mergePointIds.has(itemIdKey(id));
}

export function collectBranchIds<T extends BranchGraphItem>(
  items: T[],
): Set<string> {
  const branchIds = new Set<string>();

  items.forEach((item) => {
    (item.branches || []).forEach((branchId) => {
      branchIds.add(itemIdKey(branchId));
    });
  });

  return branchIds;
}

export function getNextSequentialItem<T extends BranchGraphItem>(
  items: T[],
  id: string | number,
  excludedIds: Set<string> = new Set(),
): T | undefined {
  const index = items.findIndex((item) => idsEqual(item.id, id));
  if (index === -1) return undefined;

  for (let i = index + 1; i < items.length; i += 1) {
    if (!excludedIds.has(itemIdKey(items[i].id))) {
      return items[i];
    }
  }

  return undefined;
}

export function reachesItem<T extends BranchGraphItem>(
  items: T[],
  sourceId: string | number,
  targetId: string | number,
  visited = new Set<string>(),
): boolean {
  const sourceKey = itemIdKey(sourceId);
  if (visited.has(sourceKey)) return false;
  visited.add(sourceKey);

  const sourceItem = findGraphItem(items, sourceId);
  if (!sourceItem?.branches?.length) return false;

  if (sourceItem.branches.some((branchId) => idsEqual(branchId, targetId))) {
    return true;
  }

  return sourceItem.branches.some((branchId) =>
    reachesItem(items, branchId, targetId, visited),
  );
}

export function isForwardSameScopeTarget<T extends BranchGraphItem>(
  items: T[],
  sourceId: string | number,
  targetId: string | number,
): boolean {
  const sourceIndex = items.findIndex((item) => idsEqual(item.id, sourceId));
  const targetIndex = items.findIndex((item) => idsEqual(item.id, targetId));

  return sourceIndex !== -1 && targetIndex !== -1 && targetIndex > sourceIndex;
}
