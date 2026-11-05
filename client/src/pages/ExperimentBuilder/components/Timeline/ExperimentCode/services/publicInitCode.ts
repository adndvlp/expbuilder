import { PublicExperimentCodeOptions } from "./publicCodeTypes";

export function publicInitCode(options: PublicExperimentCodeOptions): string {
  const {
    DATA_API_URL,
    FIREBASE_DATABASE_URL,
    experimentID,
    useStorage,
    batchConfig,
    recruitmentConfig,
    captchaConfig,
    sessionNameTokens,
    sessionNameSeparator,
    currentUid,
    evaluateCondition,
    branchingEvaluation,
    customPreInitCode,
    publicParams,
    extensions,
    progressBar,
    baseCode,
  } = options;
  void [
    DATA_API_URL,
    FIREBASE_DATABASE_URL,
    experimentID,
    useStorage,
    batchConfig,
    recruitmentConfig,
    captchaConfig,
    sessionNameTokens,
    sessionNameSeparator,
    currentUid,
    evaluateCondition,
    branchingEvaluation,
    customPreInitCode,
    publicParams,
    extensions,
    progressBar,
    baseCode,
  ];
  return `
    // Clean up stale jsPsych wrappers from previous runs (prevents stacking on restarts)
    document.querySelectorAll('.jspsych-content-wrapper').forEach(el => el.remove());

    ${customPreInitCode.public?.trim() ? `// --- User code (before initJsPsych) ---\n    ${customPreInitCode.public.trim()}\n\n    ` : ""}// __INIT_JSPSYCH_START__
    const jsPsych = initJsPsych({
      ${progressBar ? `show_progress_bar: true,` : ""}


      on_trial_start: function(trial) {
        window.ExpBuilderNavigation.checkpointTrialStart(trial?.data ?? {});
        const lastTrialData = jsPsych.data.get()
        if (lastTrialData && trial.data) {
        trial.data.prev_response = lastTrialData.response;
        }${publicParams.on_trial_start?.trim() ? `\n        // --- User code (on_trial_start) ---\n        ${publicParams.on_trial_start.trim()}` : ""}
      },

      ${extensions}

      on_data_update: async function (data) {
        const persistenceToken = window.ExpBuilderPersistence.start();
        if (!window.ExpBuilderNavigation.isTransitionPending()) {
          jsPsych.pauseExperiment();
          publicOwnsPause = true;
        }
        let backed = false;
        let queued = false;
        try {
          data.clientTimestamp = Date.now();
          data.sessionId = trialSessionId;
          data.experimentID = "${experimentID}";
          const checkpoint = data.builder_id !== undefined && data.builder_id !== null
            ? _createResumeCheckpoint(data) : null;
          if (data.trial_index === 0) {
            sessionRef.update({ state: 'in-progress', lastUpdate: window.firebase.database.ServerValue.TIMESTAMP })
              .catch(error => console.error('Error updating state:', error));
          }
          const persistence = _persistPublicResponse(data, checkpoint);
          queued = true;
          await persistence;
          backed = true;
          ${branchingEvaluation}${publicParams.on_data_update?.trim() ? `\n        // --- User code (on_data_update) ---\n        ${publicParams.on_data_update.trim()}` : ""}
        } catch (error) {
          if (!queued) publicPreparationError = error;
          _publicPersistenceError(error);
        } finally {
          window.ExpBuilderPersistence.finish(persistenceToken);
          if (backed) _resumePublicAfterBackup();
        }
        if (backed && BATCH_CONFIG.useIndexedDB && BATCH_CONFIG.size > 0) {
          try { await _flushPublicBatches(); }
          catch (error) {
            console.error('Batch retained for retry:', error);
            window.ExpBuilderRuntime?.reportError(error, { source: 'public-batch' });
          }
        }
      },
`;
}
