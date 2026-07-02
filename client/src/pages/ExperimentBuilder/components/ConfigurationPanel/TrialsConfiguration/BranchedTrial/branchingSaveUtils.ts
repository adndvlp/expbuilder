import { BranchCondition, RepeatCondition } from "../../types";
import { includesId } from "../../../../utils/branchGraphUtils";
import { Condition } from "./types";

type BuildBranchingSaveUpdatesParams = {
  conditions: Condition[];
  existingBranches?: (string | number)[];
  isBranchTarget: (trialId: string | number) => boolean;
};

export type BranchingSaveUpdates = {
  branches?: (string | number)[];
  branchConditions: BranchCondition[];
  repeatConditions: RepeatCondition[];
};

export function buildBranchingSaveUpdates({
  conditions,
  existingBranches = [],
  isBranchTarget,
}: BuildBranchingSaveUpdatesParams): BranchingSaveUpdates {
  const branchConditions: BranchCondition[] = [];
  const repeatConditions: RepeatCondition[] = [];
  const nextBranches = [...existingBranches];
  let addedBranchTarget = false;

  conditions.forEach((condition) => {
    if (!condition.nextTrialId) return;

    if (isBranchTarget(condition.nextTrialId)) {
      if (!includesId(nextBranches, condition.nextTrialId)) {
        nextBranches.push(condition.nextTrialId);
        addedBranchTarget = true;
      }

      branchConditions.push({
        id: condition.id,
        rules: condition.rules,
        nextTrialId: condition.nextTrialId,
        customParameters: condition.customParameters,
      });
      return;
    }

    repeatConditions.push({
      id: condition.id,
      rules: condition.rules,
      jumpToTrialId: condition.nextTrialId,
    });
  });

  return {
    ...(addedBranchTarget ? { branches: nextBranches } : {}),
    branchConditions,
    repeatConditions,
  };
}
