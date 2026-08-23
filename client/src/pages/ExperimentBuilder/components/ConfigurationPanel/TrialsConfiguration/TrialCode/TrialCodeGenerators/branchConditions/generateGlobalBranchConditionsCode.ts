import type { BranchConditionsTemplateOptions } from "./types";

export function generateGlobalBranchConditionsCode({
  branches,
  branchConditions,
}: BranchConditionsTemplateOptions): string {
  return `
      const branchDecision = window.ExpBuilderBranching.decide(
        data,
        ${JSON.stringify(branches)},
        ${JSON.stringify(branchConditions ?? [])}
      );
      const nextTrialId = branchDecision.targetId;
      if (nextTrialId !== null && nextTrialId !== undefined) {
        window.nextTrialId = nextTrialId;
        window.skipRemaining = true;
        window.branchingActive = true;
        window.branchCustomParameters = branchDecision.customParameters;
        if (window.ExpBuilderRuntime) {
          window.ExpBuilderRuntime.emit('branch-decision', {
            sourceId: data.builder_id ?? data.trial_id ?? data.loop_id ?? null,
            targetId: nextTrialId,
            conditionId: branchDecision.conditionId,
            usedDefault: branchDecision.usedDefault,
            scope: 'global'
          });
        }
      }
  `;
}
