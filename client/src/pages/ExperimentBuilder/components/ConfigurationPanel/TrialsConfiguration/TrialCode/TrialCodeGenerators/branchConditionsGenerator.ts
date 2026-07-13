import { BranchCondition } from "../../../types";
import { generateGlobalBranchConditionsCode } from "./branchConditions/generateGlobalBranchConditionsCode";
import { generateLoopBranchConditionsCode } from "./branchConditions/generateLoopBranchConditionsCode";

/**
 * Generates the code for evaluating branch conditions in on_finish
 * Supports both loop-scoped and window-scoped branching
 */
export function generateBranchConditionsCode(options: {
  branches: (string | number)[];
  branchConditions?: BranchCondition[];
  isInLoop?: boolean;
  getVarName: (baseName: string) => string;
}): string {
  const { branches, branchConditions, isInLoop = false, getVarName } = options;

  const hasBranchConditions = branchConditions && branchConditions.length > 0;

  if (!hasBranchConditions) {
    // No conditions - branch automatically to the first branch
    if (isInLoop) {
      return `
      // Branching automático al primer branch (dentro del loop)
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      if (branches.length > 0) {
        console.log('🔄 [LOOP BRANCH] Auto-branching to first branch:', branches[0]);
        ${getVarName("NextTrialId")} = branches[0];
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
      }
      `;
    } else {
      return `
      // Branching automático al primer branch (global)
      console.log('🔄 [GLOBAL BRANCH] Auto-branching to first branch:', ${typeof branches[0] === "string" ? `"${branches[0]}"` : branches[0]});
      window.nextTrialId = ${typeof branches[0] === "string" ? `"${branches[0]}"` : branches[0]};
      window.skipRemaining = true;
      window.branchingActive = true;
      `;
    }
  }

  // Has conditions - evaluate them
  return isInLoop
    ? generateLoopBranchConditionsCode(options)
    : generateGlobalBranchConditionsCode(options);
}
