import type { BranchConditionsTemplateOptions } from "./types";

export function generateLoopBranchConditionsCode({
  branches,
  branchConditions,
  getVarName,
}: BranchConditionsTemplateOptions): string {
  return `
      const branchDecision = window.ExpBuilderBranching.decide(
        data,
        ${JSON.stringify(branches)},
        ${JSON.stringify(branchConditions ?? [])}
      );
      const nextTrialId = branchDecision.targetId;
      if (nextTrialId !== null && nextTrialId !== undefined) {
        ${getVarName("NextTrialId")} = nextTrialId;
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
        ${getVarName("BranchCustomParameters")} =
          branchDecision.customParameters;
        if (window.ExpBuilderRuntime) {
          window.ExpBuilderRuntime.emit('branch-decision', {
            sourceId: data.builder_id ?? data.trial_id ?? data.loop_id ?? null,
            targetId: nextTrialId,
            conditionId: branchDecision.conditionId,
            usedDefault: branchDecision.usedDefault,
            scope: 'loop'
          });
        }
      }
  `;
}
