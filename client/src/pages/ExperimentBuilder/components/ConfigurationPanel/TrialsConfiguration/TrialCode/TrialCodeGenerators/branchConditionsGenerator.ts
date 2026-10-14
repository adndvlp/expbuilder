import { BranchCondition } from "../../../types";

/** Root and loop trials submit the same source-bound decision. */
export function generateBranchConditionsCode(options: {
  branches: (string | number)[];
  branchConditions?: BranchCondition[];
  isInLoop?: boolean;
  getVarName: (baseName: string) => string;
}): string {
  return `
      const branchDecision = window.ExpBuilderBranching.decide(
        data, ${JSON.stringify(options.branches)}, ${JSON.stringify(options.branchConditions ?? [])}
      );
      window.ExpBuilderNavigation?.requestBranch(data, branchDecision);
  `;
}
