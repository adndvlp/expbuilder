import { ParamsOverrideCondition } from "../../../types";
import { generateParamsOverrideCode } from "./paramsOverrideGenerator";
import { generateBranchCustomParametersCode } from "./branchCustomParamsGenerator";

/**
 * Generates the complete on_start function code
 * Combines params override and branch custom parameters logic
 */
export function generateOnStartCode(options: {
  paramsOverride?: ParamsOverrideCondition[];
  isInLoop?: boolean;
  getVarName: (baseName: string) => string;
}): string {
  const { paramsOverride, isInLoop = false, getVarName } = options;

  const paramsOverrideCode = generateParamsOverrideCode(paramsOverride);
  const branchCustomParamsCode = generateBranchCustomParametersCode(
    isInLoop,
    getVarName
  );

  // If there's no content to generate, return empty string
  if (!paramsOverrideCode && !branchCustomParamsCode) {
    return "";
  }

  return `on_start: function(trial) {${paramsOverrideCode}
      // Then apply custom parameters from branching conditions (higher priority)${branchCustomParamsCode}
    },`;
}
