import type { TimelineItem } from "../../../contexts/TrialsContext";
import type { CanvasActionDependencies, CanvasActionScope } from "./types";

export function getScopeNames(scope: CanvasActionScope): string[] {
  const items =
    scope.kind === "root" ? scope.items : [...scope.rootItems, ...scope.items];
  return [...new Set(items.map((item) => item.name))];
}

export async function updateItemBranches(
  item: Pick<TimelineItem, "type" | "id">,
  branches: (string | number)[],
  dependencies: CanvasActionDependencies,
) {
  if (item.type === "trial") {
    const source = await dependencies.getTrial(item.id);
    const previous = source?.defaultNextTrialId ?? null;
    const defaultNextTrialId =
      previous !== null &&
      branches.some((id) => String(id) === String(previous))
        ? previous
        : (branches[0] ?? null);
    const branchConditions = (source?.branchConditions ?? []).filter(
      (condition) =>
        condition.nextTrialId === "FINISH_EXPERIMENT" ||
        branches.some((id) => String(id) === String(condition.nextTrialId)),
    );
    return dependencies.updateTrial(item.id, {
      branches,
      defaultNextTrialId,
      branchConditions,
    });
  }
  throw new Error("Branch sources must be trials");
}

export async function getItemBranches(
  item: TimelineItem,
  dependencies: CanvasActionDependencies,
): Promise<(string | number)[] | null> {
  if (item.type !== "trial") throw new Error("Branch sources must be trials");
  const trial = await dependencies.getTrial(item.id);
  return trial ? (trial.branches ?? []) : null;
}
