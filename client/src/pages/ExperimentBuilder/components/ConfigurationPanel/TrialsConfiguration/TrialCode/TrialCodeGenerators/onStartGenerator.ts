import { ParamsOverrideCondition } from "../../../types";
import { generateParamsOverrideCode } from "./paramsOverrideGenerator";
import { generateBranchCustomParametersCode } from "./branchCustomParamsGenerator";

export function generateOnStartCode(options: {
  paramsOverride?: ParamsOverrideCondition[];
  isInLoop?: boolean;
  getVarName: (baseName: string) => string;
  customOnStart?: string;
}): string {
  const { paramsOverride, isInLoop = false, getVarName, customOnStart } = options;

  const paramsOverrideCode = generateParamsOverrideCode(paramsOverride);
  const branchCustomParamsCode = generateBranchCustomParametersCode(isInLoop, getVarName);
  const trimmedCustom = customOnStart?.trim() || "";

  /* v8 ignore start -- branch custom parameter generation always returns a loop or window-scoped block. */
  if (!paramsOverrideCode && !branchCustomParamsCode && !trimmedCustom) {
    return "";
  }
  /* v8 ignore stop */

  const customBlock = trimmedCustom
    ? `\n      // --- User Custom Code ---\n      ${trimmedCustom}`
    : "";

  return `on_start: function(trial) {${paramsOverrideCode}
      // Then apply custom parameters from branching conditions (higher priority)${branchCustomParamsCode}${customBlock}
    },`;
}
