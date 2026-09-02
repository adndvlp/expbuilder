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

export const branchingEvaluationRuntimeCode = `
      if ((data.trial_id !== undefined && data.trial_id !== null) ||
          (data.loop_id !== undefined && data.loop_id !== null)) {
        const lastTrialData = jsPsych.data.getLastTrialData();
        const trial = lastTrialData.trials ? lastTrialData.trials[0] : null;
        if (trial && trial.branches && trial.branches.length > 0 &&
            trial.isInLoop !== true) {
          const nextTrialId = getNextTrialId(lastTrialData);
          if (nextTrialId === 'FINISH_EXPERIMENT') {
            if (window.ExpBuilderRuntime) {
              window.ExpBuilderRuntime.emit('branch-decision', {
                sourceId: trial.builder_id ?? trial.trial_id ?? trial.loop_id,
                targetId: 'FINISH_EXPERIMENT',
                scope: 'global'
              });
            }
            jsPsych.abortExperiment(
              'Experiment finished by branching condition',
              {}
            );
            return;
          }
          if (nextTrialId !== null && nextTrialId !== undefined) {
            window.nextTrialId = nextTrialId;
            window.skipRemaining = true;
            window.branchingActive = true;
          }
        }
      }
  `;
