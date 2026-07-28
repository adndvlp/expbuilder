import type { Trial } from "../../components/ConfigurationPanel/types";
import type { TimelineItem } from "../../contexts/TrialsContext";

const idsMatch = (
  left: string | number,
  right: string | number,
) => String(left) === String(right);

const arraysMatch = (
  left: Array<string | number> = [],
  right: Array<string | number> = [],
) =>
  left.length === right.length &&
  left.every((value, index) => idsMatch(value, right[index]));

export function updateTrialMetadata(
  items: TimelineItem[],
  id: string | number,
  trial: Trial,
) {
  let changed = false;
  const next = items.map((item) => {
    if (item.type !== "trial" || !idsMatch(item.id, id)) return item;
    const branches = trial.branches ?? [];
    if (item.name === trial.name && arraysMatch(item.branches, branches)) {
      return item;
    }
    changed = true;
    return { ...item, name: trial.name, branches };
  });
  return changed ? next : items;
}

export function updateTrialWithBranches(
  items: TimelineItem[],
  id: string | number,
  trial: Trial,
  newBranchTrial?: Trial,
) {
  const updated = updateTrialMetadata(items, id, trial);
  const targetExists = items.some(
    (item) => item.type === "trial" && idsMatch(item.id, id),
  );
  if (!targetExists || !trial.branches?.length) return updated;

  const existingIds = new Set(updated.map((item) => String(item.id)));
  const missing = trial.branches.filter(
    (branchId) => !existingIds.has(String(branchId)),
  );
  if (missing.length === 0) return updated;

  return [
    ...updated,
    ...missing.map<TimelineItem>((branchId) => {
      if (newBranchTrial && idsMatch(newBranchTrial.id, branchId)) {
        return {
          id: newBranchTrial.id,
          type: "trial",
          name: newBranchTrial.name,
          branches: newBranchTrial.branches ?? [],
        };
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

export function removeTrialFromTimeline(
  items: TimelineItem[],
  id: string | number,
) {
  const trial = items.find(
    (item) => item.type === "trial" && idsMatch(item.id, id),
  );
  if (!trial) return items;
  const children = trial.branches ?? [];

  return items
    .filter((item) => !idsMatch(item.id, id))
    .map((item) => {
      if (!item.branches?.some((branchId) => idsMatch(branchId, id))) {
        return item;
      }
      const branches = item.branches.filter(
        (branchId) => !idsMatch(branchId, id),
      );
      for (const childId of children) {
        if (!branches.some((branchId) => idsMatch(branchId, childId))) {
          branches.push(childId);
        }
      }
      return { ...item, branches };
    });
}
