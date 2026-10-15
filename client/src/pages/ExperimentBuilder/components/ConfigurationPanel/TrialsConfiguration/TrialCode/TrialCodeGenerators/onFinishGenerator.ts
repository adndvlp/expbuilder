import { BranchCondition } from "../../../types";
import { generateBranchConditionsCode } from "./branchConditionsGenerator";

export function generateOnFinishCode(options: {
  branches?: (string | number)[];
  branchConditions?: BranchCondition[];
  defaultNextTrialId?: string | number | null;
  isInLoop?: boolean;
  isMergePoint?: boolean;
  getVarName: (baseName: string) => string;
  customOnFinish?: string;
}): string {
  const customBlock = options.customOnFinish?.trim() ?? "";
  return `on_finish: function(data) {
    ${customBlock}
    ${generateBranchConditionsCode({ ...options, branches: options.branches ?? [] })}
  },`;
}
