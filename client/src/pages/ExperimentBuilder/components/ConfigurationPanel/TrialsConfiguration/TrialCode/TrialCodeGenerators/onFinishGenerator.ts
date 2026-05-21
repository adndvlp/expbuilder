import { BranchCondition, RepeatCondition } from "../../../types";
import { generateBranchConditionsCode } from "./branchConditionsGenerator";
import { generateRepeatConditionsCode } from "./repeatConditionsGenerator";

export function generateOnFinishCode(options: {
  branches?: (string | number)[];
  branchConditions?: BranchCondition[];
  repeatConditions?: RepeatCondition[];
  isInLoop?: boolean;
  getVarName: (baseName: string) => string;
  customOnFinish?: string;
}): string {
  const {
    branches,
    branchConditions,
    repeatConditions,
    isInLoop = false,
    getVarName,
    customOnFinish,
  } = options;

  const hasBranches = branches && branches.length > 0;
  const hasRepeatConditions = repeatConditions && repeatConditions.length > 0;
  const trimmedCustom = customOnFinish?.trim() || "";
  const customBlock = trimmedCustom
    ? `\n      // --- User Custom Code ---\n      ${trimmedCustom}\n`
    : "";

  if (!hasBranches && !hasRepeatConditions) {
    if (isInLoop) {
      return `on_finish: function(data) {${customBlock}
      if (typeof ${getVarName("HasBranches")} !== 'undefined' && ${getVarName("HasBranches")}) {
        ${getVarName("ShouldBranchOnFinish")} = true;
      } else if (!${getVarName("HasBranches")}) {
        if (window.branchingActive) {
          window.nextTrialId = '1778798102194';
          window.skipRemaining = true;
        }
      }
    },`;
    } else {
      return `on_finish: function(data) {${customBlock}
      if (window.branchingActive) {
        window.nextTrialId = '1778798102194';
        window.skipRemaining = true;
      }
    },`;
    }
  }

  const repeatConditionsCode = generateRepeatConditionsCode(repeatConditions);
  const branchConditionsCode = hasBranches
    ? generateBranchConditionsCode({ branches: branches!, branchConditions, isInLoop, getVarName })
    : "";

  if (!hasBranches && hasRepeatConditions && isInLoop) {
    return `on_finish: function(data) {${repeatConditionsCode}${customBlock}
      if (typeof ${getVarName("HasBranches")} !== 'undefined' && ${getVarName("HasBranches")}) {
        ${getVarName("ShouldBranchOnFinish")} = true;
      } else if (!${getVarName("HasBranches")}) {
        if (window.branchingActive) {
          window.nextTrialId = '1778798102194';
          window.skipRemaining = true;
        }
      }
    },`;
  }

  // customOnFinish runs between repeat conditions and branching
  return `on_finish: function(data) {${repeatConditionsCode}${customBlock}${branchConditionsCode}
    },`;
}
