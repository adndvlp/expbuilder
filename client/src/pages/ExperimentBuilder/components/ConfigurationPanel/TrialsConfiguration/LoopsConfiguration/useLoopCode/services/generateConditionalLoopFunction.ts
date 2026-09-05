import type { LoopCondition } from "../types";

export function generateConditionalLoopFunction(
  isConditionalLoop: boolean | undefined,
  loopConditions: LoopCondition[] | undefined,
): string {
  if (!isConditionalLoop || !loopConditions?.length) return "";

  return `loop_function: function(data) {
    const loopConditions = ${JSON.stringify(loopConditions)};
    const loopRows = data.values();
    const matchedCondition = loopConditions.find(condition =>
      window.ExpBuilderBranching.evaluateReferencedCondition(loopRows, condition)
    );
    const shouldRepeat = Boolean(matchedCondition);
    window.ExpBuilderRuntime?.emit('conditional-loop-decision', {
      conditionId: matchedCondition?.id ?? null,
      shouldRepeat
    });
    return shouldRepeat;
  },`;
}
