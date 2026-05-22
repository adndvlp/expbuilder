import { BranchCondition, RepeatCondition } from "./types";

type Props = {
  code: string;
  hasBranchesLoop: boolean | undefined;
  branches: (string | number)[] | undefined;
  branchConditions: BranchCondition[] | undefined;
  repeatConditions?: RepeatCondition[] | undefined;
  id: string | undefined;
  loopIdSanitized: string;
};

function BranchesCode({
  code,
  hasBranchesLoop,
  branches,
  branchConditions,
  repeatConditions,
  loopIdSanitized,
  id,
}: Props) {
  // Branching logic for the loop (same as trials)
  const hasBranches = hasBranchesLoop;
  const hasMultipleBranches = branches && branches.length > 1;
  const hasBranchConditions = branchConditions && branchConditions.length > 0;
  const hasRepeatConditions = repeatConditions && repeatConditions.length > 0;

  if (hasBranches || hasRepeatConditions) {
    // If it has branches or repeat conditions, generate full on_finish
    if (hasRepeatConditions) {
      // Generate on_finish with evaluation of repeat conditions
      code += `
  on_finish: function(data) {
    // Evaluate repeat conditions (to restart the experiment from a specific trial)
    const repeatConditionsArray = ${JSON.stringify(repeatConditions)};
    
    let shouldRepeat = false;
    for (const condition of repeatConditionsArray) {
      if (!condition || !condition.rules) {
        continue;
      }
      
      // Get the last trial data from the loop
      const loopData = jsPsych.data.get().filter({loop_id: "${id}"}).values();
      if (loopData.length === 0) continue;
      
      const lastTrialData = loopData[loopData.length - 1];
      
      // All rules in a condition must be true (AND logic)
      const allRulesMatch = condition.rules.every(rule => {
        // Construct column name from componentIdx and prop if column is empty
        let columnName = rule.column || "";
        if (!columnName && rule.componentIdx && rule.prop) {
          columnName = rule.componentIdx + '_' + rule.prop;
        } else if (!columnName && rule.prop) {
          columnName = rule.prop;
        }
        
        const propValue = lastTrialData[columnName];
        const compareValue = rule.value;
        
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
      });
      
      if (allRulesMatch && condition.jumpToTrialId) {
        console.log('Loop repeat condition matched! Jumping to trial:', condition.jumpToTrialId);
        // Save the target trial in localStorage
        localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));
        shouldRepeat = true;
        break;
      }
    }
    
    if (shouldRepeat) {
      // Clear the jsPsych container (jspsych-container is the display_element)
      const container = document.getElementById('jspsych-container');
      if (container) {
        // Clear all content from the container
        container.innerHTML = '';
      }
      // Restart the timeline
      setTimeout(() => {
        jsPsych.run(timeline);
      }, 100);
      return;
    }
    
    ${
      hasBranches
        ? hasMultipleBranches && hasBranchConditions
          ? `
    // Evaluate loop conditions for branching
    // Only if it was NOT activated from an internal trial (ShouldBranchOnFinish or BranchingActive)
    if (!loop_${loopIdSanitized}_ShouldBranchOnFinish && !loop_${loopIdSanitized}_BranchingActive) {
      const branches = [${branches.map((b) => (typeof b === "string" ? `"${b}"` : b))}];
      const branchConditions = ${JSON.stringify(branchConditions)};
      
      // TODO: Implement condition evaluation if necessary
      // For now, follow the first branch
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop on_finish: branching to', branches[0]);
      }
    }
    `
          : `
    // Automatic branching to the first branch of the loop
    // Only if it was NOT activated from an internal trial (ShouldBranchOnFinish or BranchingActive)
    if (!loop_${loopIdSanitized}_ShouldBranchOnFinish && !loop_${loopIdSanitized}_BranchingActive) {
      const branches = [${branches?.map((b) => (typeof b === "string" ? `"${b}"` : b)) ?? []}];
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop on_finish: branching to', branches[0]);
      }
    }
    `
        : `
    // This loop has no branches, it is a terminal loop
    // If we get here after branching, end the experiment
    if (window.branchingActive) {
      jsPsych.abortExperiment('', {});
    }
    `
    }
  },`;
    } else if (hasBranches) {
      // If it has branches but NO repeat conditions
      if (!hasMultipleBranches || !hasBranchConditions) {
        // If there is only one branch OR there are no conditions, automatically follow the first branch
        code += `
  on_finish: function(data) {
    // Automatic branching to the first branch of the loop
    // Only if it was NOT activated from an internal trial (ShouldBranchOnFinish or BranchingActive)
    if (!loop_${loopIdSanitized}_ShouldBranchOnFinish && !loop_${loopIdSanitized}_BranchingActive) {
      const branches = [${branches?.map((b) => (typeof b === "string" ? `"${b}"` : b)) ?? []}];
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop on_finish: branching to', branches[0]);
      }
    }
  },`;
      } else {
        // If there are multiple branches AND conditions, we need to evaluate them
        code += `
  on_finish: function(data) {
    // Evaluate loop conditions for branching
    // Only if it was NOT activated from an internal trial (ShouldBranchOnFinish or BranchingActive)
    if (!loop_${loopIdSanitized}_ShouldBranchOnFinish && !loop_${loopIdSanitized}_BranchingActive) {
      const branches = [${branches.map((b) => (typeof b === "string" ? `"${b}"` : b))}];
      const branchConditions = ${JSON.stringify(branchConditions)};
      
      // TODO: Implement condition evaluation if necessary
      // For now, follow the first branch
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop on_finish: branching to', branches[0]);
      }
    }
  },`;
      }
    }
  } else {
    // Terminal loop: has no branches or repeat conditions
    code += `
  on_finish: function(data) {
    // This loop has no branches or repeat conditions, it is a terminal loop
    // If we get here after branching, end the experiment
    if (window.branchingActive) {
      jsPsych.abortExperiment('', {});
    }
  },`;
  }
  return { code };
}

export default BranchesCode;
