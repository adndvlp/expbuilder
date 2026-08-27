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
  const { isInLoop = false } = options;

  return isInLoop
    ? generateLoopBranchConditionsCode(options)
    : generateGlobalBranchConditionsCode(options);
}
