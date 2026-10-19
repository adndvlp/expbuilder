import { BranchCondition } from "../../../types";

/** Root and loop trials submit the same source-bound decision. */
export function generateBranchConditionsCode(options: {
  branches: (string | number)[];
  branchConditions?: BranchCondition[];
  defaultNextTrialId?: string | number | null;
  isInLoop?: boolean;
  getVarName: (baseName: string) => string;
}): string {
  return `
      const branchDecision = window.ExpBuilderBranching.decide(
        data, ${JSON.stringify(options.branches)}, ${JSON.stringify(options.branchConditions ?? [])}, ${JSON.stringify(options.defaultNextTrialId ?? null)}
      );
      window.ExpBuilderNavigation?.requestBranch(data, branchDecision);
  `;
}
