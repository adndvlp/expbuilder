import { BranchCondition, RepeatCondition } from "./types";

type Props = {
  code: string;
  hasBranchesLoop: boolean | undefined;
  branches: (string | number)[] | undefined;
  branchConditions: BranchCondition[] | undefined;
  repeatConditions?: RepeatCondition[] | undefined;
  id: string | undefined;
  loopIdSanitized: string;
  parentLoopIdSanitized?: string | null;
  isMergePoint?: boolean;
};

const activateBranch = (parentLoopIdSanitized?: string | null) =>
  parentLoopIdSanitized
    ? `
    loop_${parentLoopIdSanitized}_NextTrialId = branchDecision.targetId;
    loop_${parentLoopIdSanitized}_SkipRemaining = true;
    loop_${parentLoopIdSanitized}_BranchingActive = true;
    loop_${parentLoopIdSanitized}_BranchCustomParameters = branchDecision.customParameters;`
    : `
    window.nextTrialId = branchDecision.targetId;
    window.skipRemaining = true;
    window.branchingActive = true;
    window.branchCustomParameters = branchDecision.customParameters;`;

const resolveTerminalBranch = (isMergePoint: boolean) =>
  isMergePoint
    ? `
    window.nextTrialId = null;
    window.skipRemaining = false;
    window.branchingActive = false;
    window.branchCustomParameters = null;`
    : `
    jsPsych.abortExperiment('', {});`;

function BranchesCode({
  code,
  hasBranchesLoop,
  branches = [],
  branchConditions = [],
  repeatConditions = [],
  loopIdSanitized,
  parentLoopIdSanitized,
  isMergePoint = false,
  id,
}: Props) {
  const loopId = JSON.stringify(id ?? null);
  const repeatCode = repeatConditions.length
    ? `
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
        sourceId: ${loopId},
        conditionId: matchedRepeatCondition.id ?? null,
        sourceSessionId: trialSessionId
      },
      loopLastData,
      () => jsPsych.pauseExperiment()
    );
    return;
  }`
    : "";

  const branchCode = hasBranchesLoop
    ? `
  if (!loop_${loopIdSanitized}_ShouldBranchOnFinish &&
      !loop_${loopIdSanitized}_BranchingActive) {
    const branchDecision = window.ExpBuilderBranching.decide(
      loopLastData,
      ${JSON.stringify(branches)},
      ${JSON.stringify(branchConditions)}
    );
    window.ExpBuilderRuntime?.emit('branch-decision', {
      sourceType: 'loop',
      sourceId: ${loopId},
      targetId: branchDecision.targetId,
      conditionId: branchDecision.conditionId,
      usedDefault: branchDecision.usedDefault
    });
    if (branchDecision.targetId !== null) {${activateBranch(parentLoopIdSanitized)}
    }
  }`
    : `
  if (window.branchingActive && !loop_${loopIdSanitized}_BranchingActive) {${resolveTerminalBranch(isMergePoint)}
  }`;

  return {
    code: `${code}
  on_finish: function(data) {
  const loopRows = jsPsych.data.get().filter({loop_id: ${loopId}}).values();
  const loopLastData = loopRows[loopRows.length - 1] || data || {};${repeatCode}${branchCode}
  },`,
  };
}

export default BranchesCode;
