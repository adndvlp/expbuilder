import type { TimelineItem } from "../../../contexts/TrialsContext";
import type { CanvasActionDependencies, CanvasActionScope } from "./types";

export function getScopeNames(scope: CanvasActionScope): string[] {
  const items =
    scope.kind === "root" ? scope.items : [...scope.rootItems, ...scope.items];
  return [...new Set(items.map((item) => item.name))];
}

export async function updateItemBranches(
  item: TimelineItem,
  branches: (string | number)[],
  dependencies: CanvasActionDependencies,
) {
  if (item.type === "trial") {
    return dependencies.updateTrial(item.id, { branches });
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
