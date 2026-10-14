import type { RepeatCondition } from "../types";

type Options = {
  id: string | undefined;
  repeatConditions?: RepeatCondition[];
};

export function generateLoopRepeatLifecycle({
  id,
  repeatConditions = [],
}: Options): string {
  if (!repeatConditions.length) return "";
  const loopId = JSON.stringify(id ?? null);
  const repeatCode = `
  const repeatConditions = ${JSON.stringify(repeatConditions)};
  const matchedRepeatCondition = repeatConditions.find(
    condition => condition?.jumpToTrialId &&
      window.ExpBuilderBranching.evaluateCondition(loopLastData, condition)
  );
  if (matchedRepeatCondition) {
    window.ExpBuilderRuntime?.emit('repeat-decision', {
      sourceId: ${loopId},
      conditionId: matchedRepeatCondition.id ?? null,
      targetId: matchedRepeatCondition.jumpToTrialId
    });
    window.ExpBuilderNavigation.requestJump(
      matchedRepeatCondition.jumpToTrialId,
      {
        sourceId: loopLastData.builder_id ?? loopLastData.trial_id ?? ${loopId},
        conditionId: matchedRepeatCondition.id ?? null,
        sourceSessionId: trialSessionId
      },
      loopLastData,
      () => jsPsych.pauseExperiment()
    );
    return;
  }`;

  return `
  on_timeline_finish: function() {
    const loopRows = jsPsych.data.get().filter({loop_id: ${loopId}}).values();
    const loopLastData = loopRows[loopRows.length - 1] || {};${repeatCode}
  },`;
}
