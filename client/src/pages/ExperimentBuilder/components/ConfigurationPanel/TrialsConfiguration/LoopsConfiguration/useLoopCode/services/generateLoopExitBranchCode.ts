import type { BranchCondition } from "../types";

type ExitProps = {
  id: string | undefined;
  branches: (string | number)[];
  branchConditions: BranchCondition[] | undefined;
  loopIdSanitized: string;
  parentLoopIdSanitized?: string | null;
};

/**
 * Data-access prelude shared by the loop exit branching and the loop
 * repeat/jump blocks. It is emitted once inside on_timeline_finish whenever
 * there are conditions to evaluate.
 *
 * Child trials inherit the loop's `loop_id` data property, so all rows
 * produced inside the loop can be collected with a single filter. Each rule
 * reads the LAST row of its source trial (rule.trialId); rules without a
 * trialId fall back to the last row of the loop (backward compatible).
 */
export function generateLoopRuleDataPrelude(id: string | undefined): string {
  return `
    // Data rows produced inside this loop (child trials inherit loop_id)
    const loopDataRows = jsPsych.data.get().filter({loop_id: "${id}"}).values();

    // Data for a rule: last row of the rule's source trial (or last row of the loop)
    const getRuleTrialData = (trialId) => {
      if (trialId === undefined || trialId === null || trialId === "") {
        return loopDataRows[loopDataRows.length - 1];
      }
      for (let i = loopDataRows.length - 1; i >= 0; i--) {
        if (String(loopDataRows[i].trial_id) === String(trialId)) {
          return loopDataRows[i];
        }
      }
      return null;
    };

    // Evaluate a single rule against a trial data row (dynamic-plugin aware)
    const matchesLoopRule = (rule, ruleData) => {
      let propValue;

      // Parse column name to extract component info for dynamic plugins
      // Format: "componentName_propertyName" or "componentName_questionName" for surveys
      // If column is empty, construct it from componentIdx and prop
      let columnName = rule.column || "";
      if (!columnName && rule.componentIdx && rule.prop) {
        columnName = rule.componentIdx + '_' + rule.prop;
      } else if (!columnName && rule.prop) {
        columnName = rule.prop;
      }
      const parts = columnName.split("_");

      // Check if this looks like a dynamic plugin column (has underscore)
      if (parts.length >= 2) {
        // Last part is the property or question name
        const propertyOrQuestion = parts[parts.length - 1];
        // Everything before the last underscore is the component name
        const componentName = parts.slice(0, -1).join("_");

        // First, try direct access with the full columnName (e.g., "ButtonResponseComponent_1_response")
        if (ruleData[columnName] !== undefined) {
          propValue = ruleData[columnName];
        } else {
          // If not found, try componentName_response format and check if it's an object (SurveyComponent case)
          const responseKey = componentName + '_response';
          const responseData = ruleData[responseKey];

          // If response data exists and is an object (SurveyComponent case)
          if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
            // This is likely a survey response - check if property is a question name
            if (responseData[propertyOrQuestion] !== undefined) {
              propValue = responseData[propertyOrQuestion];
            } else {
              return false;
            }
          } else {
            return false;
          }
        }
      } else {
        // Normal plugin structure - direct property access
        propValue = ruleData[columnName];
      }

      const compareValue = rule.value;

      // Handle array responses (multi-select or single-select returned as array)
      if (Array.isArray(propValue)) {
        switch (rule.op) {
          case '==':
            return propValue.includes(compareValue) || propValue.includes(String(compareValue));
          case '!=':
            return !propValue.includes(compareValue) && !propValue.includes(String(compareValue));
          default:
            return false;
        }
      }

      // Convert values for comparison
      const numPropValue = parseFloat(propValue);
      const numCompareValue = parseFloat(compareValue);
      const isNumeric = !isNaN(numPropValue) && !isNaN(numCompareValue);

      switch (rule.op) {
        case '==':
          return isNumeric ? numPropValue === numCompareValue : propValue == compareValue;
        case '!=':
          return isNumeric ? numPropValue !== numCompareValue : propValue != compareValue;
        case '>':
          return isNumeric && numPropValue > numCompareValue;
        case '<':
          return isNumeric && numPropValue < numCompareValue;
        case '>=':
          return isNumeric && numPropValue >= numCompareValue;
        case '<=':
          return isNumeric && numPropValue <= numCompareValue;
        default:
          return false;
      }
    };
  `;
}

/**
 * Loop exit branching block, evaluated once when the loop finishes.
 *
 * Semantics (agreed with the user):
 * - Conditions are OR-ed, rules within a condition are AND-ed.
 * - On match: navigate to condition.nextTrialId and apply its
 *   customParameters on the target.
 * - On no match (or no conditions): default to branches[0].
 * - Root loops write window.*; nested loops write loop_{parent}_* so the
 *   parent scope performs the navigation.
 */
export function generateLoopExitBranchCode({
  id,
  branches,
  branchConditions,
  loopIdSanitized,
  parentLoopIdSanitized,
}: ExitProps): string {
  const hasConditions = branchConditions && branchConditions.length > 0;

  const activationCode = parentLoopIdSanitized
    ? `
        // This is a nested loop - activate parent loop branching
        loop_${parentLoopIdSanitized}_NextTrialId = exitTargetId;
        loop_${parentLoopIdSanitized}_SkipRemaining = true;
        loop_${parentLoopIdSanitized}_BranchingActive = true;
        if (exitCustomParameters) {
          loop_${parentLoopIdSanitized}_BranchCustomParameters = exitCustomParameters;
        }
        console.log('Loop ${id} finished: activating parent loop exit branch to', exitTargetId);`
    : `
        // This is a root loop - activate global branching
        window.nextTrialId = exitTargetId;
        window.skipRemaining = true;
        window.branchingActive = true;
        if (exitCustomParameters) {
          window.branchCustomParameters = exitCustomParameters;
        }
        console.log('Loop ${id} finished: exit branching to', exitTargetId);`;

  return `
    const exitBranches = [${branches.map((b) => (typeof b === "string" ? `"${b}"` : b))}];
    let exitTargetId = null;
    let exitCustomParameters = null;
    ${
      hasConditions
        ? `
    // Evaluate loop exit branch conditions (OR logic between conditions)
    const exitBranchConditions = ${JSON.stringify(branchConditions)}.flat();
    for (const condition of exitBranchConditions) {
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

      if (allRulesMatch) {
        console.log('Loop ${id} exit: condition matched, target:', condition.nextTrialId);
        exitTargetId = condition.nextTrialId;
        if (condition.customParameters) {
          exitCustomParameters = condition.customParameters;
        }
        break;
      }
    }
    `
        : ""
    }
    // No condition matched (or none defined): default to the first branch
    if (!exitTargetId && exitBranches.length > 0) {
      exitTargetId = exitBranches[0];
    }

    if (exitTargetId) {${activationCode}
    }
  `;
}
