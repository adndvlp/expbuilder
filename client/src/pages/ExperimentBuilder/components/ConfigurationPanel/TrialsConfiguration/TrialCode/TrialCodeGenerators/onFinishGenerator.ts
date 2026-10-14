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
  const { branches, branchConditions, repeatConditions, isMergePoint = false, customOnFinish } = options;
  const customBlock = customOnFinish?.trim()
    ? `\n      // --- User Custom Code ---\n      ${customOnFinish.trim()}\n` : "";
  const branchCode = branches?.length
    ? generateBranchConditionsCode({ ...options, branches, branchConditions })
    : `window.ExpBuilderNavigation?.completeTrial(data, ${isMergePoint});`;
  return `on_finish: function(data) {
    ${generateRepeatConditionsCode(repeatConditions)}${customBlock}
    ${branchCode}
  },`;
}
