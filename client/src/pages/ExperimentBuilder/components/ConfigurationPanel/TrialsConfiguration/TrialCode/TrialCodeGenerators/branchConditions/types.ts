import type { BranchCondition } from "../../../../types";

export interface BranchConditionsTemplateOptions {
  branches: (string | number)[];
  branchConditions?: BranchCondition[];
  getVarName: (baseName: string) => string;
}
