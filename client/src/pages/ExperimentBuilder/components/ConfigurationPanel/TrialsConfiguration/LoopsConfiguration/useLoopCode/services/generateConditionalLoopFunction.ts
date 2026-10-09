import type { LoopCondition } from "../types";

export function generateConditionalLoopFunction(
  isConditionalLoop: boolean | undefined,
  loopConditions: LoopCondition[] | undefined,
  loopId?: string,
): string {
  if (!isConditionalLoop || !loopConditions?.length) return "";

  return `loop_function: function(data) {
    const loopConditions = ${JSON.stringify(loopConditions)};
    const loopRows = window.ExpBuilderNavigation?.loopResults(${JSON.stringify(loopId)}) ?? data.values();
    const matchedCondition = loopConditions.find(condition =>
      window.ExpBuilderBranching.evaluateReferencedCondition(loopRows, condition)
    );
    const shouldRepeat = Boolean(matchedCondition);
    window.ExpBuilderNavigation?.finishLoopCycle(${JSON.stringify(loopId)}, shouldRepeat);
    window.ExpBuilderRuntime?.emit('conditional-loop-decision', {
      conditionId: matchedCondition?.id ?? null,
      shouldRepeat
    });
    return shouldRepeat;
  },`;
}
