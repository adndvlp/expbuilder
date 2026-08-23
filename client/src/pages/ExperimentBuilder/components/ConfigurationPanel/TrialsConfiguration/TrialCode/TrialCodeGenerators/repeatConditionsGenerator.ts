import { RepeatCondition } from "../../../types";

/**
 * Generates the code for evaluating repeat conditions in on_finish
 * These conditions allow restarting the experiment from a specific trial
 */
export function generateRepeatConditionsCode(
  repeatConditions?: RepeatCondition[],
): string {
  if (!repeatConditions || repeatConditions.length === 0) {
    return "";
  }

  return `
      // Evaluar repeat conditions (para reiniciar el experimento desde un trial específico)
      const repeatConditionsArray = ${JSON.stringify(repeatConditions)};
      
      const matchedRepeatCondition = repeatConditionsArray.find(
        condition => condition?.jumpToTrialId &&
          window.ExpBuilderBranching.evaluateCondition(data, condition)
      );
      if (matchedRepeatCondition) {
        window.ExpBuilderRuntime?.emit('repeat-decision', {
          sourceId: data.builder_id ?? data.trial_id ?? data.loop_id ?? null,
          conditionId: matchedRepeatCondition.id ?? null,
          targetId: matchedRepeatCondition.jumpToTrialId
        });
        window.ExpBuilderNavigation.requestJump(
          matchedRepeatCondition.jumpToTrialId,
          {
            sourceId: data.builder_id ?? data.trial_id ?? data.loop_id ?? null,
            conditionId: matchedRepeatCondition.id ?? null,
            sourceSessionId: trialSessionId
          },
          data,
          () => jsPsych.pauseExperiment()
        );
        return;
      }
      `;
}
