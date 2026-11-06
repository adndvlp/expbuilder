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
      on_finish: publicFinishHandler = async function() {
        if (publicFinished) return;
        if (publicFinishInFlight) return publicFinishInFlight;
        publicFinishInFlight = (async () => {
        if (window.ExpBuilderNavigation.isTransitionPending()) {
          window.ExpBuilderRuntime?.emit(
            'experiment-finish-suppressed',
            { reason: 'branching' }
          );
          return;
        }
        publicClosing = true;
        _showLoading('Saving your data\u2026');
        await new Promise(resolve => setTimeout(resolve, 0));
        try {
          await _completePublicSession();
        } catch (error) {
          _publicPersistenceError(error);
          return;
        }

        if (_publicSessionState.lifecycle === 'expired') {
          document.getElementById('expbuilder-retry-save')?.remove();
          window.ExpBuilderNavigation.clearTransientState();
          _showPublicRecoveryComplete(); publicFinished = true;
          return;
        }
        _setLoadingMsg('Finishing up\u2026');
        
        try {
          await sessionRef.update({
            connected: false,
            finished: true,
            needsFinalization: false,
            sessionProtocolVersion: 2,
            finalizationProcessed: true,
            state: 'completed',
            finishedAt: window.firebase.database.ServerValue.TIMESTAMP,
            lastUpdate: window.firebase.database.ServerValue.TIMESTAMP
          });
          // Cancel only after the durable completed state was confirmed.
          await sessionRef.onDisconnect().cancel();
        } catch (error) {
          _publicPersistenceError(error);
          return;
        }

        document.getElementById('expbuilder-retry-save')?.remove();

        window.ExpBuilderNavigation.clearTransientState();
        localStorage.removeItem(_publicStorageKeys.sessionId);
        localStorage.removeItem(_publicStorageKeys.participant);
        sessionStorage.removeItem(_publicStorageKeys.captchaPassed);

        publicFinished = true;
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
        })();
        try { await publicFinishInFlight; } finally { publicFinishInFlight = null; }
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

    if (['completed', 'expired'].includes(_publicSessionState.lifecycle)) {
      await publicFinishHandler();
    } else {
      ${baseCode}
    }

})();
`;
}
