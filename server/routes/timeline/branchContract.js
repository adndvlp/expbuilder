import { findLoop, findTrial } from "./graph/identity.js";

export class BranchContractError extends Error {
  constructor(message, code) {
    super(message);
    this.status = 400;
    this.code = code;
  }
}

export function assertLoopHasNoBranching(loop) {
  for (const field of ["branches", "branchConditions"]) {
    if (Object.hasOwn(loop, field)) {
      throw new BranchContractError(
        `Loops cannot have ${field}; branching belongs to trials`,
        "BRANCH_SOURCE_NOT_TRIAL",
      );
    }
  }
}

function assertTrialTarget(doc, targetId) {
  if (targetId != null && findLoop(doc, targetId)) {
    throw new BranchContractError(
      `Branch target ${targetId} is a loop; branches must target trials`,
      "BRANCH_TARGET_NOT_TRIAL",
    );
  }
}

export function assertTrialBranching(doc, trial) {
  for (const field of ["branches", "branchConditions"]) {
    if (trial[field] != null && !Array.isArray(trial[field])) {
      throw new BranchContractError(
        `${field} must be an array`,
        "BRANCH_INVALID",
      );
    }
  }
  for (const targetId of trial.branches ?? []) assertTrialTarget(doc, targetId);
  for (const condition of trial.branchConditions ?? []) {
    assertTrialTarget(doc, condition?.nextTrialId);
  }
}

// Preserve the existing stale-canvas policy: prune deleted targets. A loop
// target is a contract violation and must be rejected before any mutation.
export function normalizeTrialBranching(doc, trial) {
  assertTrialBranching(doc, trial);
  const normalized = { ...trial };
  if (Object.hasOwn(trial, "branches")) {
    normalized.branches = (trial.branches ?? []).filter((id) =>
      findTrial(doc, id),
    );
  }
  if (Object.hasOwn(trial, "branchConditions")) {
    normalized.branchConditions = (trial.branchConditions ?? []).filter(
      (condition) =>
        condition?.nextTrialId == null || findTrial(doc, condition.nextTrialId),
    );
  }
  return normalized;
}

export function assertTimelineBranching(doc, timeline) {
  for (const item of timeline) {
    if (item.type === "loop" || findLoop(doc, item.id)) {
      assertLoopHasNoBranching(item);
    } else {
      assertTrialBranching(doc, item);
    }
  }
}
