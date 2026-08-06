import type { RepeatCondition } from "../types";

type Props = {
  repeatConditions: RepeatCondition[];
};

/**
 * Loop repeat/jump conditions, evaluated once when the loop finishes
 * (on_timeline_finish). On match, the experiment restarts and every
 * timeline item skips itself (via its conditional_function) until the jump
 * target is reached.
 *
 * Assumes the rule-data prelude (loopDataRows/getRuleTrialData/
 * matchesLoopRule) is already in scope.
 */
export function generateLoopRepeatConditionsCode({
  repeatConditions,
}: Props): string {
  return `
    // Evaluate repeat conditions (to restart the experiment from a specific trial)
    const repeatConditionsArray = ${JSON.stringify(repeatConditions)};

    let shouldRepeat = false;
    for (const condition of repeatConditionsArray) {
      if (!condition || !condition.rules) {
        continue;
      }

      // All rules in a condition must be true (AND logic)
      const allRulesMatch = condition.rules.every(rule => {
        const ruleData = getRuleTrialData(rule.trialId);
        if (!ruleData) {
          return false;
        }
        return matchesLoopRule(rule, ruleData);
      });

      if (allRulesMatch && condition.jumpToTrialId) {
        console.log('Loop repeat condition matched! Jumping to trial:', condition.jumpToTrialId);
        localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));
        shouldRepeat = true;
        break;
      }
    }

    if (shouldRepeat) {
      document.getElementById('jspsych-container').innerHTML = '';
      setTimeout(() => {
        jsPsych.run(timeline);
      }, 100);
      return;
    }
  `;
}
