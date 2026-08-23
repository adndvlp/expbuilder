import type { Loop, Trial } from "../../ConfigurationPanel/types";
import { generateUniqueName } from "./generateUniqueName";
import { getScopeNames } from "./itemMutations";
import type {
  CanvasItemId,
  LoopSelection,
  ScopedActionInput,
  TrialSelection,
} from "./types";

type CreateScopedTrialInput = ScopedActionInput &
  TrialSelection & {
    trialType: string;
  };

type CreateScopedLoopInput = ScopedActionInput &
  LoopSelection & {
    itemIds: CanvasItemId[];
  };

function trialInput(input: CreateScopedTrialInput): Omit<Trial, "id"> {
  return {
    type: input.trialType,
    name: generateUniqueName(getScopeNames(input.scope)),
    plugin: "plugin-dynamic",
    parameters: {},
    trialCode: "",
    ...(input.scope.kind === "loop"
      ? { parentLoopId: String(input.scope.loopId) }
      : {}),
  };
}

export async function createScopedTrial(
  input: CreateScopedTrialInput,
): Promise<Trial | null> {
  const parentLoop =
    input.scope.kind === "loop"
      ? await input.dependencies.getLoop(input.scope.loopId)
      : null;
  if (input.scope.kind === "loop" && !parentLoop) return null;

  const trial = await input.dependencies.createTrial(trialInput(input));
  input.onSelectTrial?.(trial);
  return trial;
}

function baseLoopInput(name: string, itemIds: CanvasItemId[]) {
  return {
    name,
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    orderColumns: [],
    categoryColumn: "",
    categories: false,
    categoryData: [],
    trials: itemIds,
    code: "",
  } satisfies Omit<Loop, "id">;
}

export async function createScopedLoop(
  input: CreateScopedLoopInput,
): Promise<Loop | null> {
  if (input.scope.kind === "root") {
    const loopCount = input.scope.items.filter(
      (item) => item.type === "loop",
    ).length;
    const loop = await input.dependencies.createLoop(
      baseLoopInput(`Loop ${loopCount + 1}`, input.itemIds),
    );
    input.onSelectLoop?.(loop);
    return loop;
  }

  const parentLoop = await input.dependencies.getLoop(input.scope.loopId);
  if (!parentLoop) return null;
  const name = generateUniqueName(getScopeNames(input.scope), "Nested Loop 1");
  const loop = await input.dependencies.createLoop({
    ...baseLoopInput(name, input.itemIds),
    parentLoopId: String(input.scope.loopId),
  });
  input.onSelectLoop?.(loop);
  return loop;
}
