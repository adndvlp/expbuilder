import {
  findLoop,
  findTrial,
  idsMatch,
  getItemOwnerId,
  getLoopAncestry,
} from "./graph/identity.js";

export class BranchContractError extends Error {
  constructor(message, code = "BRANCH_INVALID") {
    super(message);
    this.status = 400;
    this.code = code;
  }
}
const fail = (message) => {
  throw new BranchContractError(message);
};

export function assertLoopHasNoBranching(loop) {
  for (const field of [
    "branches",
    "branchConditions",
    "defaultNextTrialId",
    "repeatConditions",
  ]) {
    if (Object.hasOwn(loop, field))
      throw new BranchContractError(
        `Loops cannot have ${field}; branching belongs to trials`,
        "BRANCH_SOURCE_NOT_TRIAL",
      );
  }
}
function assertTrialTarget(doc, id) {
  if (id === "FINISH_EXPERIMENT") return;
  if (findLoop(doc, id))
    throw new BranchContractError(
      `Branch target ${id} is a loop; branches must target trials`,
      "BRANCH_TARGET_NOT_TRIAL",
    );
  if (!findTrial(doc, id)) fail(`Branch target ${id} does not exist`);
}
export function assertTrialBranching(doc, trial) {
  if (Object.hasOwn(trial, "repeatConditions"))
    fail("Unsupported navigation field");
  if (
    !Array.isArray(trial.branches) ||
    !Array.isArray(trial.branchConditions) ||
    !Object.hasOwn(trial, "defaultNextTrialId")
  )
    fail("Explicit trial branching is required");
  if (new Set(trial.branches.map(String)).size !== trial.branches.length)
    fail("Duplicate branch destination");
  for (const id of trial.branches) {
    if (id === "FINISH_EXPERIMENT")
      fail("Experiment completion is not a trial edge");
    assertTrialTarget(doc, id);
  }
  const assertConnected = (id) => {
    assertTrialTarget(doc, id);
    if (
      id !== "FINISH_EXPERIMENT" &&
      !trial.branches.some((target) => idsMatch(target, id))
    ) {
      fail(`Branch destination ${id} has no configured edge`);
    }
  };
  if (trial.defaultNextTrialId !== null)
    assertConnected(trial.defaultNextTrialId);
  for (const condition of trial.branchConditions) {
    if (
      !condition ||
      Array.isArray(condition) ||
      !Array.isArray(condition.rules) ||
      condition.nextTrialId == null
    ) {
      fail("A branch condition requires rules and a destination");
    }
    assertConnected(condition.nextTrialId);
  }
}
export function normalizeTrialBranching(doc, trial) {
  assertTrialBranching(doc, trial);
  return { ...trial };
}
export function assertScopeEntry(doc, scope, scopeId) {
  if (!Object.hasOwn(scope, "entryItemId"))
    fail("An explicit scope entry is required");
  if (
    scope.entryItemId != null &&
    getItemOwnerId(doc, scope.entryItemId) !== scopeId
  ) {
    fail(`Scope entry ${scope.entryItemId} does not belong to its scope`);
  }
}
export function assertExperimentNavigation(doc) {
  if (
    !Array.isArray(doc.trials) ||
    !Array.isArray(doc.loops) ||
    !Array.isArray(doc.timeline)
  ) {
    fail("Experiment items must be arrays");
  }
  const placements = new Set();
  for (const [owner, ids] of [
    [null, doc.timeline.map((item) => item.id)],
    ...doc.loops.map((loop) => [String(loop.id), loop.trials]),
  ]) {
    if (!Array.isArray(ids)) fail("Loop members must be an array");
    for (const id of ids) {
      if (placements.has(String(id)) || getItemOwnerId(doc, id) !== owner)
        fail("Invalid item ownership");
      placements.add(String(id));
    }
  }
  for (const item of [...doc.trials, ...doc.loops]) {
    if (!placements.has(String(item.id)))
      fail("An item must belong to exactly one scope");
  }
  assertScopeEntry(doc, doc, null);
  for (const trial of doc.trials) assertTrialBranching(doc, trial);
  for (const loop of doc.loops) {
    try {
      getLoopAncestry(doc, loop.id);
    } catch (error) {
      fail(error.message);
    }
    assertLoopHasNoBranching(loop);
    assertScopeEntry(doc, loop, String(loop.id));
    assertLoopContinuation(doc, loop);
  }
}
export function assertTimelineBranching(doc, timeline) {
  for (const item of timeline) {
    if (item.type === "loop" || findLoop(doc, item.id))
      assertLoopHasNoBranching(item);
    else assertTrialBranching(doc, { ...findTrial(doc, item.id), ...item });
  }
}

export function assertLoopContinuation(doc, loop) {
  if (!Object.hasOwn(loop, "nextItemId"))
    fail("An explicit loop continuation is required");
  if (
    loop.nextItemId != null &&
    getItemOwnerId(doc, loop.nextItemId) !== getItemOwnerId(doc, loop.id)
  ) {
    fail("A structural continuation must belong to the parent scope");
  }
}
