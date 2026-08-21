import type { TimelineItem } from "../../../../contexts/TrialsContext";

const idKey = (id: string | number) => String(id);

export function getTerminalTrialIds(
  items: readonly TimelineItem[],
): Set<string | number> {
  const byId = new Map(items.map((item) => [idKey(item.id), item]));
  const referenced = new Set<string>();
  items.forEach((item) => {
    (item.branches ?? []).forEach((branchId) => {
      if (byId.has(idKey(branchId))) referenced.add(idKey(branchId));
    });
  });
  const mainItems = items.filter((item) => !referenced.has(idKey(item.id)));
  const finalMainItem = mainItems[mainItems.length - 1];
  const terminals = new Set<string | number>();
  if (!finalMainItem) return terminals;

  const visit = (item: TimelineItem, path: Set<string>) => {
    const key = idKey(item.id);
    if (path.has(key)) return;
    const nextPath = new Set(path).add(key);
    if (item.type === "trial") terminals.add(item.id);
    const internalTargets = (item.branches ?? [])
      .map((branchId) => byId.get(idKey(branchId)))
      .filter((target): target is TimelineItem => target !== undefined);
    if (internalTargets.length === 0) return;
    internalTargets.forEach((target) => visit(target, nextPath));
  };

  visit(finalMainItem, new Set());
  return terminals;
}

export function isTerminalTrial(
  items: readonly TimelineItem[],
  trialId: string | number,
) {
  return [...getTerminalTrialIds(items)].some(
    (terminalId) => idKey(terminalId) === idKey(trialId),
  );
}
