import type { TimelineItem } from "../../../contexts/TrialsContext";
import {
  getItemBranches,
  refreshScope,
  updateItemBranches,
} from "./itemMutations";
import type {
  CanvasItemId,
  CanvasItemToMove,
  CanvasMoveResult,
  ScopedActionInput,
} from "./types";

type MoveScopedItemInput = ScopedActionInput & {
  item: CanvasItemToMove;
  destinationId: CanvasItemId;
  addAsBranch: boolean;
};

async function detachFromCurrentParent(input: MoveScopedItemInput) {
  const currentParent = input.scope.items.find((item) =>
    item.branches?.includes(input.item.id),
  );
  if (!currentParent) return;

  const movedItem = input.scope.items.find(
    (item) => item.id === input.item.id,
  );
  const nextBranches = (currentParent.branches ?? []).filter(
    (id) => id !== input.item.id,
  );
  for (const childId of movedItem?.branches ?? []) {
    if (!nextBranches.includes(childId)) nextBranches.push(childId);
  }
  await updateItemBranches(
    currentParent,
    nextBranches,
    input.dependencies,
  );
}

async function updateMovedItem(
  input: MoveScopedItemInput,
  branches: CanvasItemId[],
) {
  if (input.item.type === "trial") {
    await input.dependencies.updateTrial(input.item.id, { branches });
  } else {
    await input.dependencies.updateLoop(input.item.id, { branches });
  }
}

async function attachAsBranch(
  input: MoveScopedItemInput,
  destination: TimelineItem,
) {
  await updateMovedItem(input, []);
  const destinationBranches = await getItemBranches(
    destination,
    input.dependencies,
  );
  if (destinationBranches) {
    const nextBranches = destinationBranches.filter(
      (branchId) => String(branchId) !== String(input.item.id),
    );
    nextBranches.push(input.item.id);
    await updateItemBranches(destination, nextBranches, input.dependencies);
  }
}

async function attachSequentially(
  input: MoveScopedItemInput,
  destination: TimelineItem,
) {
  const destinationBranches = await getItemBranches(
    destination,
    input.dependencies,
  );
  if (!destinationBranches) return;
  await updateMovedItem(input, destinationBranches);
  await updateItemBranches(destination, [input.item.id], input.dependencies);
}

function reorderRootItems(input: MoveScopedItemInput) {
  const nextItems = input.scope.items.filter(
    (item) => item.id !== input.item.id,
  );
  const destinationIndex = nextItems.findIndex(
    (item) => item.id === input.destinationId,
  );
  const movedItem: TimelineItem = { ...input.item, branches: [] };
  if (destinationIndex < 0) nextItems.push(movedItem);
  else nextItems.splice(destinationIndex + 1, 0, movedItem);
  return nextItems;
}

async function updateLoopDirectChildren(input: MoveScopedItemInput) {
  if (input.scope.kind !== "loop") return;
  const parentLoop = await input.dependencies.getLoop(input.scope.loopId);
  if (!parentLoop?.trials) return;
  const trials = parentLoop.trials.filter((id) => id !== input.item.id);
  if (trials.length === parentLoop.trials.length) return;

  await input.dependencies.updateLoop(input.scope.loopId, { trials });
  if (input.item.type === "trial") {
    await input.dependencies.updateTrial(input.item.id, {
      parentLoopId: String(input.scope.loopId),
    });
  } else {
    await input.dependencies.updateLoop(input.item.id, {
      parentLoopId: String(input.scope.loopId),
    });
  }
}

export async function moveScopedItem(
  input: MoveScopedItemInput,
): Promise<CanvasMoveResult> {
  const destination = input.scope.items.find(
    (item) => item.id === input.destinationId,
  );
  if (!destination) return { status: "destination-not-found" };

  await detachFromCurrentParent(input);
  if (input.addAsBranch) await attachAsBranch(input, destination);
  else await attachSequentially(input, destination);

  if (input.scope.kind === "root") {
    await input.dependencies.updateTimeline(reorderRootItems(input));
  } else {
    await updateLoopDirectChildren(input);
  }
  await refreshScope(input.scope);
  return { status: "moved" };
}
