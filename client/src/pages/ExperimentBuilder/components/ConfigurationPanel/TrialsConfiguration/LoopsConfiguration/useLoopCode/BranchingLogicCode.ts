import { BranchCondition, LoopCondition, RepeatCondition } from "./types";
import { generateConditionalLoopFunction } from "./services/generateConditionalLoopFunction";
import { generateLoopRepeatConditionsCode } from "./services/generateLoopRepeatConditionsCode";
import {
  generateLoopExitBranchCode,
  generateLoopRuleDataPrelude,
} from "./services/generateLoopExitBranchCode";

type Props = {
  code: string;
  parentLoopIdSanitized: string | null;
  itemDefinitions: string;
  loopIdSanitized: string;
  id: string | undefined;
  hasBranchesLoop: boolean | undefined;
  itemWrappers: string;
  timelineRefs: string;
  repetitions: number;
  randomize: boolean;
  isConditionalLoop?: boolean | undefined;
  loopConditions?: LoopCondition[] | undefined;
  branches: (string | number)[] | undefined;
  branchConditions?: BranchCondition[] | undefined;
  repeatConditions?: RepeatCondition[] | undefined;
};

export default function BranchingLogicCode({
  code,
  parentLoopIdSanitized,
  itemDefinitions,
  loopIdSanitized,
  id,
  hasBranchesLoop,
  itemWrappers,
  timelineRefs,
  randomize,
  repetitions,
  isConditionalLoop,
  loopConditions,
  branches,
  branchConditions,
  repeatConditions,
}: Props) {
  const hasExitConditions = branchConditions && branchConditions.length > 0;
  const hasRepeatConditions = repeatConditions && repeatConditions.length > 0;
  const needsRuleData = hasExitConditions || hasRepeatConditions;
  code += `
    
    ${itemDefinitions}

// --- Branching logic variables for loop ${id || "main"} ---
let loop_${loopIdSanitized}_NextTrialId = null;
let loop_${loopIdSanitized}_SkipRemaining = false;
let loop_${loopIdSanitized}_BranchingActive = false;
let loop_${loopIdSanitized}_BranchCustomParameters = null; // Store custom parameters for branching within loops
let loop_${loopIdSanitized}_TargetExecuted = false; // Indicates if the target trial has already been executed in this iteration
let loop_${loopIdSanitized}_IterationComplete = false; // Indicates that the current iteration is complete
const loop_${loopIdSanitized}_HasBranches = ${hasBranchesLoop ? "true" : "false"};
let loop_${loopIdSanitized}_ShouldBranchOnFinish = false;

${itemWrappers}

const ${loopIdSanitized}_procedure = {
  timeline: [${timelineRefs}],
  timeline_variables: test_stimuli_${loopIdSanitized},
  repetitions: ${repetitions},
  randomize_order: ${randomize},
  ${generateConditionalLoopFunction(isConditionalLoop, loopConditions)}
  conditional_function: function() {
    const currentId = "${id}";

    // Check for a pending repeat/jump target before normal branching.
    const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
    if (jumpToTrial) {
      if (String(currentId) === String(jumpToTrial)) {
        localStorage.removeItem('jsPsych_jumpToTrial');
        return true;
      }
      return false;
    }
    
    // If skipRemaining is active (normal branching), check if this is the target loop
    if (window.skipRemaining) {
      if (String(currentId) === String(window.nextTrialId)) {
        // Found the target loop
        window.skipRemaining = false;
        window.nextTrialId = null;
        return true;
      }
      // Not the target, skip
      return false;
    }
    
    return true;
  },
  on_timeline_start: function() {
    // Reset the flags at the start of each loop iteration
    // This allows each repetition of the loop to work correctly
    loop_${loopIdSanitized}_NextTrialId = null;
    loop_${loopIdSanitized}_SkipRemaining = false;
    loop_${loopIdSanitized}_BranchingActive = false;
    loop_${loopIdSanitized}_BranchCustomParameters = null;
    loop_${loopIdSanitized}_TargetExecuted = false;
    loop_${loopIdSanitized}_IterationComplete = false;
    loop_${loopIdSanitized}_ShouldBranchOnFinish = false;
    
    // IMPORTANT: If the loop is conditional, also reset the GLOBAL branching
    // so that it regenerates during this loop iteration
    ${
      isConditionalLoop && loopConditions && loopConditions.length > 0
        ? `
    window.nextTrialId = null;
    window.skipRemaining = false;
    window.branchingActive = false;
    window.branchCustomParameters = null;
    console.log('Conditional loop iteration starting, reset global branching flags');
    `
        : ""
    }
  },
  on_timeline_finish: function() {
    // Reset the flags at the end of all loop repetitions
    loop_${loopIdSanitized}_NextTrialId = null;
    loop_${loopIdSanitized}_SkipRemaining = false;
    loop_${loopIdSanitized}_TargetExecuted = false;
    loop_${loopIdSanitized}_BranchingActive = false;
    loop_${loopIdSanitized}_BranchCustomParameters = null;
    ${needsRuleData ? generateLoopRuleDataPrelude(id) : ""}
    ${hasRepeatConditions ? generateLoopRepeatConditionsCode({ repeatConditions }) : ""}
    ${
      hasBranchesLoop
        ? `
    // Evaluate the loop exit branches when a terminal child completed
    if (loop_${loopIdSanitized}_ShouldBranchOnFinish && loop_${loopIdSanitized}_HasBranches) {
      ${generateLoopExitBranchCode({
        id,
        branches: branches ?? [],
        branchConditions,
        loopIdSanitized,
        parentLoopIdSanitized,
      })}
    }
    `
        : ""
    }
    ${
      !hasBranchesLoop && parentLoopIdSanitized
        ? `
    // This nested loop has no own branches: signal the parent loop to evaluate its exit branches
    if (loop_${parentLoopIdSanitized}_HasBranches) {
      loop_${parentLoopIdSanitized}_ShouldBranchOnFinish = true;
    }
    `
        : ""
    }
    // Reset all branching variables of the loop
    loop_${loopIdSanitized}_NextTrialId = null;
    loop_${loopIdSanitized}_SkipRemaining = false;
    loop_${loopIdSanitized}_BranchingActive = false;
    loop_${loopIdSanitized}_BranchCustomParameters = null;
    loop_${loopIdSanitized}_ShouldBranchOnFinish = false;
  },
`;
  return { code };
}
