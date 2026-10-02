import type { TimelineItem } from "../../../contexts/TrialsContext";
import { getItemBranches, updateItemBranches } from "./itemMutations";
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

type MovePlacement = "branch-edge" | "implicit-order";
type TrialTimelineItem = Extract<TimelineItem, { type: "trial" }>;

async function detachFromCurrentParent(input: MoveScopedItemInput) {
  const itemKey = String(input.item.id);
  const currentParent = input.scope.items.find(
    (item) =>
      item.type === "trial" &&
      item.branches?.some((branchId) => String(branchId) === itemKey),
  );
  if (!currentParent) return;

  const movedItem = input.scope.items.find(
    (item) => String(item.id) === itemKey,
  );
  const nextBranches = (currentParent.branches ?? []).filter(
    (id) => String(id) !== itemKey,
  );
  for (const childId of movedItem?.branches ?? []) {
    if (!nextBranches.some((id) => String(id) === String(childId)))
      nextBranches.push(childId);
  }
  await updateItemBranches(currentParent, nextBranches, input.dependencies);
}

async function updateMovedItem(
  input: MoveScopedItemInput,
  branches: CanvasItemId[],
) {
  await input.dependencies.updateTrial(input.item.id, { branches });
}

async function attachAsBranch(
  input: MoveScopedItemInput,
  destination: TrialTimelineItem,
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
  destination: TrialTimelineItem,
): Promise<MovePlacement> {
  const destinationBranches = await getItemBranches(
    destination,
    input.dependencies,
  );
  if (!destinationBranches) return "branch-edge";
  const destinationIsBranchTarget = input.scope.items.some(
    (item) =>
      item.type === "trial" &&
      item.branches?.some(
        (branchId) => String(branchId) === String(destination.id),
      ),
  );
  const parentLoop =
    input.scope.kind === "loop"
      ? await input.dependencies.getLoop(input.scope.loopId)
      : null;
  const destinationIsDirectLoopChild = Boolean(
    parentLoop?.trials?.some(
      (itemId) => String(itemId) === String(destination.id),
    ),
  );
  const usesImplicitOrder =
    destinationBranches.length === 0 &&
    (input.scope.kind === "root"
      ? !destinationIsBranchTarget
      : destinationIsDirectLoopChild);
  if (usesImplicitOrder) {
    await updateMovedItem(input, []);
    return "implicit-order";
  }
  await updateMovedItem(input, destinationBranches);
  await updateItemBranches(destination, [input.item.id], input.dependencies);
  return "branch-edge";
}

function reorderRootItems(input: MoveScopedItemInput) {
  const itemKey = String(input.item.id);
  const nextItems = input.scope.items.filter(
    (item) => String(item.id) !== itemKey,
  );
  const destinationIndex = nextItems.findIndex(
    (item) => String(item.id) === String(input.destinationId),
  );
  const movedItem: TimelineItem = {
    ...input.item,
    type: "trial",
    branches: [],
  };
  if (destinationIndex < 0) nextItems.push(movedItem);
  else nextItems.splice(destinationIndex + 1, 0, movedItem);
  return nextItems;
}

async function updateLoopDirectChildren(
  input: MoveScopedItemInput,
  placement: MovePlacement,
) {
  if (input.scope.kind !== "loop") return;
  const parentLoop = await input.dependencies.getLoop(input.scope.loopId);
  if (!parentLoop?.trials) return;
  const trials = parentLoop.trials.filter(
    (id) => String(id) !== String(input.item.id),
  );
  if (placement === "implicit-order") {
    const destinationIndex = trials.findIndex(
      (id) => String(id) === String(input.destinationId),
    );
    if (destinationIndex < 0) return;
    trials.splice(destinationIndex + 1, 0, input.item.id);
  }

  await input.dependencies.updateLoop(input.scope.loopId, { trials });
  // The membership update already places the trial in this scope. Reassigning
  // its parent would append it again and undo the saved sequential position.
  if (placement === "implicit-order") return;
  await input.dependencies.updateTrial(input.item.id, {
    parentLoopId: String(input.scope.loopId),
  });
}

export async function moveScopedItem(
  input: MoveScopedItemInput,
): Promise<CanvasMoveResult> {
  const destination = input.scope.items.find(
    (item) => String(item.id) === String(input.destinationId),
  );
  if (!destination) return { status: "destination-not-found" };
  const source = input.scope.items.find(
    (item) => String(item.id) === String(input.item.id),
  );
  if (
    input.item.type !== "trial" ||
    source?.type === "loop" ||
    destination.type !== "trial"
  ) {
    throw new Error("Only trials can be moved or used as move destinations");
  }

  await detachFromCurrentParent(input);
  let placement: MovePlacement = "branch-edge";
  if (input.addAsBranch) await attachAsBranch(input, destination);
  else placement = await attachSequentially(input, destination);

  if (input.scope.kind === "root") {
    await input.dependencies.updateTimeline(reorderRootItems(input));
  } else {
    await updateLoopDirectChildren(input, placement);
  }
  return { status: "moved" };
}
