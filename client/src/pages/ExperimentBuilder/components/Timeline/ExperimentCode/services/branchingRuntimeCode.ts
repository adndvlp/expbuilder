export const evaluateConditionRuntimeCode = `
    window.nextTrialId = null;
    window.skipRemaining = false;
    window.branchingActive = false;
    window.branchCustomParameters = null;

    const evaluateCondition = window.ExpBuilderBranching.evaluateCondition;
    const getNextTrialId = (lastTrialData) => {
      if (!lastTrialData || !lastTrialData.trials || !lastTrialData.trials[0]) {
        return null;
      }
      const trial = lastTrialData.trials[0];
      const decision = window.ExpBuilderBranching.decide(
        trial,
        trial.branches || [],
        trial.branchConditions || []
      );
      window.branchCustomParameters = decision.customParameters;
      return decision.targetId;
    };
  `;

// Navigation is decided once in the source trial's on_finish callback.
export const branchingEvaluationRuntimeCode = "";
