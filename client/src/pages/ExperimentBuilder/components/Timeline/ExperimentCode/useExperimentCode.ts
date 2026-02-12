import { useEffect, useState } from "react";
import {
  fetchExperimentNameByID,
  useExperimentID,
} from "../../../hooks/useExperimentID";
import useTrials from "../../../hooks/useTrials";
import LocalConfiguration from "./LocalConfiguration";
import PublicConfiguration from "./PublicConfiguration";
import ExperimentBase from "./ExperimentBase";

export type UploadedFile = {
  url?: string;
  name?: string;
  type?: string;
};

export function useExperimentCode(uploadedFiles: UploadedFile[] = []) {
  const [experimentName, setExperimentName] = useState("Experiment");

  const experimentID = useExperimentID();

  useEffect(() => {
    if (experimentID) {
      fetchExperimentNameByID(experimentID).then(setExperimentName);
    }
  }, [experimentID]);

  // Función para obtener extensiones del experimento
  const fetchExtensions = async (): Promise<string> => {
    if (!experimentID) return "";

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/trials-extensions/${experimentID}`,
      );
      const data = await res.json();
      const { extensions = [] } = data;

      if (extensions.length > 0) {
        return `extensions: [${extensions.map((ext: string) => `{ type: ${ext} }`).join(", ")}],`;
      }
      return "";
    } catch (err) {
      console.error("Error loading extensions:", err);
      return "";
    }
  };

  const evaluateCondition = `// --- Branching logic functions (outside initJsPsych for timeline access) ---
    window.nextTrialId = null;
    window.skipRemaining = false;
    window.branchingActive = false;
    window.branchCustomParameters = null; // Store custom parameters for the next trial

    const evaluateCondition = (trialData, condition) => {
      // All rules in a condition must be true (AND logic)
      return condition.rules.every(rule => {
        // Construct column name from componentIdx and prop if column is empty
        // This handles dynamic plugins like ButtonResponseComponent_1_response
        let columnName = rule.column || "";
        if (!columnName && rule.componentIdx && rule.prop) {
          columnName = rule.componentIdx + '_' + rule.prop;
        } else if (!columnName && rule.prop) {
          columnName = rule.prop;
        }
        
        if (!columnName) {
          console.warn('No column name specified in rule:', rule);
          return false;
        }
        
        // Get value directly from the column
        const propValue = trialData[columnName];
        
        if (propValue === undefined) {
          console.warn('Column not found in trial data:', columnName);
          return false;
        }
        
        const compareValue = rule.value;
        
        // Handle array responses (multi-select or single-select returned as array)
        if (Array.isArray(propValue)) {
          const matches = propValue.includes(compareValue) || propValue.includes(String(compareValue));
          switch (rule.op) {
            case '==':
              return matches;
            case '!=':
              return !matches;
            default:
              return false;
          }
        }
        
        // Convert values for comparison (for non-array values)
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
    };
    
    const getNextTrialId = (lastTrialData) => {
      if (!lastTrialData || !lastTrialData.trials || !lastTrialData.trials[0]) {
        return null;
      }
      
      const trial = lastTrialData.trials[0];
      
      // Check if trial/loop has branches
      if (!Array.isArray(trial.branches) || trial.branches.length === 0) {
        return null;
      }
      
      // Check if there are conditions to evaluate
      const hasBranchConditions = Array.isArray(trial.branchConditions) && trial.branchConditions.length > 0;
      
      // Check if any condition has customParameters
      const hasCustomParameters = hasBranchConditions && 
        trial.branchConditions.flat().some(condition => 
          condition && condition.customParameters && 
          Object.keys(condition.customParameters).length > 0
        );
      
      // If there are no conditions AND no custom parameters, auto-branch to first branch
      if (!hasBranchConditions && !hasCustomParameters) {
        console.log('No conditions or custom parameters defined, auto-branching to first branch:', trial.branches[0]);
        return trial.branches[0];
      }
      
      // If there are no conditions but there ARE custom parameters, we can't auto-branch
      // We need to evaluate conditions to know which customParameters to use
      if (!hasBranchConditions && hasCustomParameters) {
        console.log('Custom parameters exist but no conditions, cannot auto-branch');
        return null;
      }
      
      // If there ARE conditions, evaluate them (regardless of how many branches there are)
      // branchConditions is an array of arrays, flatten it first
      const conditions = trial.branchConditions.flat();
      
      // Evaluate each condition (OR logic between conditions)
      for (const condition of conditions) {
        if (!condition || !condition.rules) {
          console.warn('Invalid condition structure:', condition);
          continue;
        }
        
        if (evaluateCondition(trial, condition)) {
          // Store custom parameters if they exist
          if (condition.customParameters) {
            window.branchCustomParameters = condition.customParameters;
          }
          return condition.nextTrialId;
        }
      }
      
      // No condition matched - do NOT branch (conditions were defined but none matched)
      return null;
    };`;

  const branchingEvaluation = `// Solo evaluar branching si el trial/loop tiene un trial_id o loop_id válido
      if ((!data.trial_id || data.trial_id === undefined) && (!data.loop_id || data.loop_id === undefined)) {
        return;
      }
      
      const lastTrialData = jsPsych.data.getLastTrialData();
      const trial = lastTrialData.trials ? lastTrialData.trials[0] : null;
      
      // Verificar si este trial/loop tiene branches
      if (!trial || !trial.branches || trial.branches.length === 0) {
        return; // No tiene branches, no hay nada que hacer
      }
      
      // IMPORTANTE: Si el trial está dentro de un loop (isInLoop = true),
      // NO activar el branching global. Los trials dentro de loops usan su propio
      // sistema de branching con variables locales (loopNextTrialId, etc.)
      if (trial.isInLoop === true) {
        return;
      }
      
      const nextTrialId = getNextTrialId(lastTrialData);
      
      if (nextTrialId) {
        // Check if nextTrialId is "FINISH_EXPERIMENT"
        if (nextTrialId === 'FINISH_EXPERIMENT') {
          console.log('🏁 [BRANCHING] Finishing experiment via branching');
          jsPsych.abortExperiment('Experiment finished by branching condition', {});
          return;
        }
        
        console.log('🎯 [BRANCHING] Setting global branch target:', nextTrialId);
        window.nextTrialId = nextTrialId;
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('🎯 [BRANCHING] Skip remaining activated');
      }`;

  const { getTrial, getLoopTimeline, getLoop } = useTrials();

  const { generateLocalExperiment } = LocalConfiguration({
    experimentID,
    evaluateCondition,
    fetchExtensions,
    branchingEvaluation,
    uploadedFiles,
    getTrial,
    getLoopTimeline,
    getLoop,
  });

  const { generateExperiment } = PublicConfiguration({
    experimentID,
    evaluateCondition,
    fetchExtensions,
    branchingEvaluation,
    uploadedFiles,
    experimentName,
    storage: undefined, // No usar storage del hook, siempre pasar como parámetro
    getTrial,
    getLoopTimeline,
    getLoop,
  });

  const { generatedBaseCode } = ExperimentBase({
    experimentID,
    uploadedFiles,
    getTrial,
    getLoopTimeline,
    getLoop,
  });

  return { generateLocalExperiment, generateExperiment, generatedBaseCode };
}
