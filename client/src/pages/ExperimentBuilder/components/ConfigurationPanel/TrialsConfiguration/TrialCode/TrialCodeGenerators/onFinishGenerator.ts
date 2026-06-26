import { BranchCondition, RepeatCondition } from "../../../types";
import { generateBranchConditionsCode } from "./branchConditionsGenerator";
import { generateRepeatConditionsCode } from "./repeatConditionsGenerator";

export function generateOnFinishCode(options: {
  branches?: (string | number)[];
  branchConditions?: BranchCondition[];
  repeatConditions?: RepeatCondition[];
  isInLoop?: boolean;
  isMergePoint?: boolean;
  getVarName: (baseName: string) => string;
  customOnFinish?: string;
}): string {
  const {
    branches,
    branchConditions,
    repeatConditions,
    isInLoop = false,
    isMergePoint = false,
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
    if (isMergePoint) {
      if (isInLoop) {
        return `on_finish: function(data) {${customBlock}
      // This terminal branch target is shared by multiple parents.
      // Clear loop-scoped branch state so the loop continues normally.
      ${getVarName("NextTrialId")} = null;
      ${getVarName("SkipRemaining")} = false;
      ${getVarName("TargetExecuted")} = false;
      ${getVarName("BranchingActive")} = false;
      ${getVarName("BranchCustomParameters")} = null;
      ${getVarName("ShouldBranchOnFinish")} = false;
    },`;
      }

      return `on_finish: function(data) {${customBlock}
      if (window.branchingActive) {
        window.nextTrialId = null;
        window.skipRemaining = false;
        window.branchingActive = false;
        window.branchCustomParameters = null;
      }
    },`;
    }

    if (isInLoop) {
      return `on_finish: function(data) {${customBlock}
      if (typeof ${getVarName("HasBranches")} !== 'undefined' && ${getVarName("HasBranches")}) {
        ${getVarName("ShouldBranchOnFinish")} = true;
      } else if (!${getVarName("HasBranches")}) {
        if (window.branchingActive) {
          jsPsych.abortExperiment('', {});
        }
      }
    },`;
    } else {
      return `on_finish: function(data) {${customBlock}
      if (window.branchingActive) {
        jsPsych.abortExperiment('', {});
      }
    },`;
    }
  }

  const repeatConditionsCode = generateRepeatConditionsCode(repeatConditions);
  const branchConditionsCode = hasBranches
    ? generateBranchConditionsCode({ branches: branches!, branchConditions, isInLoop, getVarName })
    : "";

  if (!hasBranches && hasRepeatConditions && isInLoop) {
    if (isMergePoint) {
      return `on_finish: function(data) {${repeatConditionsCode}${customBlock}
      // This terminal branch target is shared by multiple parents.
      // Clear loop-scoped branch state so the loop continues normally.
      ${getVarName("NextTrialId")} = null;
      ${getVarName("SkipRemaining")} = false;
      ${getVarName("TargetExecuted")} = false;
      ${getVarName("BranchingActive")} = false;
      ${getVarName("BranchCustomParameters")} = null;
      ${getVarName("ShouldBranchOnFinish")} = false;
    },`;
    }

    return `on_finish: function(data) {${repeatConditionsCode}${customBlock}
      if (typeof ${getVarName("HasBranches")} !== 'undefined' && ${getVarName("HasBranches")}) {
        ${getVarName("ShouldBranchOnFinish")} = true;
      } else if (!${getVarName("HasBranches")}) {
        if (window.branchingActive) {
          jsPsych.abortExperiment('', {});
        }
      }
    },`;
  }

  if (!hasBranches && hasRepeatConditions && isMergePoint && !isInLoop) {
    return `on_finish: function(data) {${repeatConditionsCode}${customBlock}
      if (window.branchingActive) {
        window.nextTrialId = null;
        window.skipRemaining = false;
        window.branchingActive = false;
        window.branchCustomParameters = null;
      }
    },`;
  }

  // customOnFinish runs between repeat conditions and branching
  return `on_finish: function(data) {${repeatConditionsCode}${customBlock}${branchConditionsCode}
    },`;
}
