import type { Trial } from "../../ConfigurationPanel/types";
import type { TimelineItem } from "../../../contexts/TrialsContext";
import type {
  CanvasActionDependencies,
  CanvasActionScope,
} from "./types";

export function getScopeNames(scope: CanvasActionScope): string[] {
  const items =
    scope.kind === "root" ? scope.items : [...scope.rootItems, ...scope.items];
  return [...new Set(items.map((item) => item.name))];
}

export async function updateItemBranches(
  item: TimelineItem,
  branches: (string | number)[],
  dependencies: CanvasActionDependencies,
  newBranchTrial?: Trial,
) {
  if (item.type === "trial") {
    return newBranchTrial
      ? dependencies.updateTrial(item.id, { branches }, newBranchTrial)
      : dependencies.updateTrial(item.id, { branches });
  }
  return newBranchTrial
    ? dependencies.updateLoop(item.id, { branches }, newBranchTrial)
    : dependencies.updateLoop(item.id, { branches });
}

export async function getItemBranches(
  item: TimelineItem,
  dependencies: CanvasActionDependencies,
): Promise<(string | number)[] | null> {
  const fullItem =
    item.type === "trial"
      ? await dependencies.getTrial(item.id)
      : await dependencies.getLoop(item.id);
  return fullItem ? fullItem.branches ?? [] : null;
}
