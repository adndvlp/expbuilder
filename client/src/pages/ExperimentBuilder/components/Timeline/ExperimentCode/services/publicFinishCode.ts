import { PublicExperimentCodeOptions } from "./publicCodeTypes";

export function publicFinishCode(options: PublicExperimentCodeOptions): string {
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
      on_finish: async function() {
        // Si hay un repeat/jump pendiente, recargar para ejecutarlo
        if (localStorage.getItem('jsPsych_jumpToTrial')) {
          if (pendingBatchSaves.length > 0) await Promise.allSettled(pendingBatchSaves);
          sessionStorage.setItem('jsPsych_jumpReload', '1');
          window.location.reload();
          return;
        }

        _showLoading('Saving your data\u2026');
        await new Promise(r => setTimeout(r, 0));
        
        // Limpiar datos de retoma ya que el experimento terminó correctamente
        localStorage.removeItem('jsPsych_resumeTrial');
        localStorage.removeItem('jsPsych_currentSessionId');
        localStorage.removeItem('jsPsych_participantNumber');
        sessionStorage.removeItem('jsPsych_captchaPassed');

        if (BATCH_CONFIG.useIndexedDB) {
          // --- CON IndexedDB: Enviar datos acumulados ---
          
          // Esperar cualquier batch pendiente
          if (pendingBatchSaves.length > 0) {
            _setLoadingMsg('Uploading batches\u2026');
            await Promise.allSettled(pendingBatchSaves);
          }

          const allTrials = await TrialDB.getAll();
          
          if (allTrials.length > 0) {
            if (BATCH_CONFIG.size === 0) {
              try {
                _setLoadingMsg('Uploading data\u2026');
                await sendCompleteExperiment(allTrials);
                await TrialDB.clear();
              } catch (error) {
                console.error('Error sending complete experiment:', error);
                _setLoadingMsg('Error saving data. Please contact support.');
                return;
              }
            } else {
              BATCH_CONFIG.currentBatchNumber++;
              _setLoadingMsg('Sending final batch\u2026');
              await sendBatchConcatenated(allTrials, BATCH_CONFIG.currentBatchNumber);
              await TrialDB.clear();
              
              if (pendingBatchSaves.length > 0) {
                _setLoadingMsg('Finishing upload\u2026');
                await Promise.allSettled(pendingBatchSaves);
              }
            }
          }
        }
        
        // Cancelar el onDisconnect para evitar que marque como abandoned
        sessionRef.onDisconnect().cancel();

        _setLoadingMsg('Finishing up\u2026');
        
        try {
          const needsBackendFinalization = !(BATCH_CONFIG.useIndexedDB && BATCH_CONFIG.size === 0);
          
          await sessionRef.update({
            connected: false,
            finished: true,
            needsFinalization: needsBackendFinalization,
            state: 'completed',
            finishedAt: window.firebase.database.ServerValue.TIMESTAMP,
            lastUpdate: window.firebase.database.ServerValue.TIMESTAMP
          });
        } catch (error) {
          console.error('Error marking session as finished:', error);
        }

        // --- Recruitment platform redirect ---
        ${
          recruitmentConfig.platform === "prolific"
            ? `
        if (_prolificPID && '${recruitmentConfig.prolificCompletionCode}') {
          _setLoadingMsg('Redirecting to Prolific\u2026');
          await new Promise(r => setTimeout(r, 300));
          window.location.href = 'https://app.prolific.com/submissions/complete?cc=${recruitmentConfig.prolificCompletionCode}';
        } else {
          // No Prolific URL params — testing mode or direct access
          _showSuccess();
        }
        `
            : ""
        }
        ${
          recruitmentConfig.platform === "mturk"
            ? `
        if (_mturkTurkSubmitTo && _mturkAssignmentID && !_mturkIsPreview) {
          _setLoadingMsg('Submitting to MTurk\u2026');
          const _mturkForm = document.createElement('form');
          _mturkForm.method = 'POST';
          _mturkForm.action = _mturkTurkSubmitTo + '/mturk/externalSubmit';
          _mturkForm.innerHTML = '<input name="assignmentId" value="' + _mturkAssignmentID + '">';
          document.body.appendChild(_mturkForm);
          _mturkForm.submit();
        } else {
          _showSuccess();
        }
        `
            : ""
        }
        ${recruitmentConfig.platform === "none" ? `_showSuccess();` : ""}${publicParams.on_finish?.trim() ? `\n        // --- User code (on_finish) ---\n        ${publicParams.on_finish.trim()}` : ""}
      }${(() => {
        const BUILDER_PARAMS = [
          "on_trial_start",
          "on_data_update",
          "on_finish",
        ];
        const FUNCTION_PARAMS: Record<string, string> = {
          on_trial_finish: "function(data) {\n        ${code}\n      }",
          on_interaction_data_update:
            "function(data) {\n        ${code}\n      }",
          on_close: "function() {\n        ${code}\n      }",
        };
        const extraPairs = Object.entries(publicParams)
          .filter(([k, v]) => !BUILDER_PARAMS.includes(k) && v?.trim())
          .map(([k, v]) => {
            const trimmed = v.trim();
            const fn = FUNCTION_PARAMS[k];
            return fn
              ? `      ${k}: ${fn.replace("${code}", trimmed)}`
              : `      ${k}: ${trimmed}`;
          })
          .join(",\n");
        return extraPairs
          ? `,\n\n      // --- User-added initJsPsych params ---\n${extraPairs}`
          : "";
      })()}
    });
    // __INIT_JSPSYCH_END__

    // Uncomment to see the json results after finishing a session experiment
    // jsPsych.data.displayData('csv');

    ${
      recruitmentConfig.platform === "prolific" ||
      recruitmentConfig.platform === "mturk"
        ? `
    // Add platform IDs to all trials automatically (after initJsPsych)
    jsPsych.data.addProperties({
      prolific_pid: _prolificPID || "",
      prolific_study_id: _prolificStudyID || "",
      prolific_session_id: _prolificSessionID || "",
      mturk_worker_id: _mturkWorkerID || "",
      mturk_assignment_id: _mturkAssignmentID || "",
      mturk_hit_id: _mturkHitID || "",
    });
    `
        : ""
    }

    ${baseCode}

})();
`;
}
