import type { Trial } from "../../ConfigurationPanel/types";
import type { TimelineItem } from "../../../contexts/TrialsContext";
import { generateUniqueName } from "../utils/trialUtils";
import {
  getItemBranches,
  getScopeNames,
  propagateLoopCsv,
  refreshScope,
  updateItemBranches,
} from "./itemMutations";
import type {
  CanvasItemId,
  ScopedActionInput,
  TrialSelection,
} from "./types";

type ScopedBranchInput = ScopedActionInput &
  TrialSelection & {
    parentId: CanvasItemId;
  };

function getParentItem(input: ScopedBranchInput) {
  return input.scope.items.find((item) => item.id === input.parentId);
}

function createTrialInput(
  name: string,
  input: ScopedBranchInput,
  branches?: CanvasItemId[],
): Omit<Trial, "id"> {
  return {
    type: "Trial",
    name,
    plugin: "plugin-dynamic",
    parameters: {},
    trialCode: "",
    ...(input.scope.kind === "loop"
      ? { parentLoopId: String(input.scope.loopId) }
      : {}),
    ...(branches ? { branches } : {}),
  };
}

async function finishLoopTrial(input: ScopedBranchInput, trial: Trial) {
  if (input.scope.kind === "loop") {
    await propagateLoopCsv(input.scope, trial, input.dependencies);
  }
}

export async function addScopedBranchTrial(
  input: ScopedBranchInput,
): Promise<Trial | null> {
  const parentItem = getParentItem(input);
  if (!parentItem) return null;

  const name = generateUniqueName(getScopeNames(input.scope));
  const trial = await input.dependencies.createTrial(
    createTrialInput(name, input),
  );
  await finishLoopTrial(input, trial);

  const parentBranches = await getItemBranches(parentItem, input.dependencies);
  if (!parentBranches) return null;
  await updateItemBranches(
    parentItem,
    [...parentBranches, trial.id],
    input.dependencies,
    trial,
  );

  input.onSelectTrial?.(trial);
  await refreshScope(input.scope);
  return trial;
}

function reorderRootItems(
  items: TimelineItem[],
  parentId: CanvasItemId,
  trial: Trial,
) {
  const nextItems = items
    .map((item) =>
      item.id === parentId ? { ...item, branches: [trial.id] } : item,
    )
    .filter((item) => item.id !== trial.id);
  const parentIndex = nextItems.findIndex((item) => item.id === parentId);
  const insertIndex = parentIndex >= 0 ? parentIndex + 1 : nextItems.length;
  nextItems.splice(insertIndex, 0, {
    id: trial.id,
    type: "trial",
    name: trial.name,
    branches: trial.branches ?? [],
  });
  return nextItems;
}

export async function addScopedParentTrial(
  input: ScopedBranchInput,
): Promise<Trial | null> {
  const parentItem = getParentItem(input);
  if (!parentItem) return null;

  const parentBranches =
    (await getItemBranches(parentItem, input.dependencies)) ?? [];
  const name = generateUniqueName(getScopeNames(input.scope));
  const trial = await input.dependencies.createTrial(
    createTrialInput(name, input, parentBranches),
  );
  await finishLoopTrial(input, trial);
  await updateItemBranches(
    parentItem,
    [trial.id],
    input.dependencies,
    trial,
  );

  if (input.scope.kind === "root") {
    await input.dependencies.updateTimeline(
      reorderRootItems(input.scope.items, input.parentId, trial),
    );
  }

  input.onSelectTrial?.(trial);
  await refreshScope(input.scope);
  return trial;
}
