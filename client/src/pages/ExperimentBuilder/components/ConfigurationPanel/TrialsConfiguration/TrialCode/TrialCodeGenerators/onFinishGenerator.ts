import { BranchCondition, RepeatCondition } from "../../../types";
import { generateBranchConditionsCode } from "./branchConditionsGenerator";
import { generateRepeatConditionsCode } from "./repeatConditionsGenerator";

/**
 * Generates the complete on_finish function code
 * Combines repeat conditions and branch conditions logic
 */
export function generateOnFinishCode(options: {
  branches?: (string | number)[];
  branchConditions?: BranchCondition[];
  repeatConditions?: RepeatCondition[];
  isInLoop?: boolean;
  getVarName: (baseName: string) => string;
}): string {
  const {
    branches,
    branchConditions,
    repeatConditions,
    isInLoop = false,
    getVarName,
  } = options;

  const hasBranches = branches && branches.length > 0;
  const hasRepeatConditions = repeatConditions && repeatConditions.length > 0;

  // If no branches and no repeat conditions, check if we need terminal logic
  if (!hasBranches && !hasRepeatConditions) {
    if (isInLoop) {
      // Terminal trial in loop - check if parent loop has branches
      return `on_finish: function(data) {
      // Este trial no tiene branches ni repeat conditions, verificar si el loop padre tiene branches
      if (typeof ${getVarName("HasBranches")} !== 'undefined' && ${getVarName("HasBranches")}) {
        // El loop tiene branches, activar branching del loop al terminar
        // Esto se manejará en el on_finish del loop
        ${getVarName("ShouldBranchOnFinish")} = true;
      } else if (!${getVarName("HasBranches")}) {
        // Ni el trial ni el loop tienen branches - trial terminal
        // Si llegamos aquí después de un branching global, terminar el experimento
        if (window.branchingActive) {
          jsPsych.abortExperiment('', {});
        }
      }
    },`;
    } else {
      // Terminal trial not in loop - check if global branching is active
      return `on_finish: function(data) {
      // Trial terminal - si llegamos aquí después de branching, terminar el experimento
      if (window.branchingActive) {
        jsPsych.abortExperiment('', {});
      }
    },`;
    }
  }

  // Generate code sections
  const repeatConditionsCode = generateRepeatConditionsCode(repeatConditions);
  const branchConditionsCode = hasBranches
    ? generateBranchConditionsCode({
        branches: branches!,
        branchConditions,
        isInLoop,
        getVarName,
      })
    : "";

  // Special case for loop trials without branches but with repeat conditions
  if (!hasBranches && hasRepeatConditions && isInLoop) {
    return `on_finish: function(data) {${repeatConditionsCode}
      // Este trial no tiene branches, verificar si el loop padre tiene branches
      if (typeof ${getVarName("HasBranches")} !== 'undefined' && ${getVarName("HasBranches")}) {
        // El loop tiene branches, activar branching del loop al terminar
        // Esto se manejará en el on_finish del loop
        ${getVarName("ShouldBranchOnFinish")} = true;
      } else if (!${getVarName("HasBranches")}) {
        // Ni el trial ni el loop tienen branches - trial terminal
        // Si llegamos aquí después de un branching global, terminar el experimento
        if (window.branchingActive) {
          jsPsych.abortExperiment('', {});
        }
      }
    },`;
  }

  // Combine both sections
  return `on_finish: function(data) {${repeatConditionsCode}${branchConditionsCode}
    },`;
}
