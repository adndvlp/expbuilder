import { LocalExperimentCodeOptions } from "./localCodeTypes";
import { resumeJumpStartupCode } from "./resumeJumpStartupCode";

export function buildLocalRuntime({
  experimentID,
  evaluateCondition,
  branchingEvaluation,
  baseCode,
  customCode,
  customPreInitCode,
  extensions,
  localParams,
  progressBar,
}: LocalExperimentCodeOptions) {
  return `
  (async () => {
${resumeJumpStartupCode()}

    // Esperar a que Socket.IO esté listo
    await waitForSocket();
    socket = io();
    
    _setLoadingMsg('Creating session\u2026');
    if (isResuming) {
      const storedPN = localStorage.getItem('jsPsych_participantNumber');
      participantNumber = Number(storedPN);
    } else {
      participantNumber = await saveSession(trialSessionId);
    }

    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      alert("The participant number is not assigned. Please, wait.");
      throw new Error("participantNumber not assigned");
    }

    if (!isResuming && _sessionNameHasDynamic()) {
      const _finalId = _generateSessionName(participantNumber);
      if (_finalId && _finalId !== trialSessionId) {
        trialSessionId = await _renameSessionIfNeeded(trialSessionId, _finalId);
      }
    }

    window.JSPSYCH_SESSION_ID = trialSessionId;

    // Guardar sessionId en localStorage para futuras retomas
    localStorage.setItem('jsPsych_currentSessionId', trialSessionId);
    localStorage.setItem('jsPsych_participantNumber', participantNumber.toString());

    // Conectar sesión con el servidor via WebSocket
    socket.emit('join-experiment', {
      experimentID: '${experimentID}',
      sessionId: trialSessionId,
      state: isResuming ? 'resumed' : 'initiated',
      metadata: metadata
    });

    ${evaluateCondition}

    _hideLoading();

    // Track pending data saves to ensure all complete before finishing
    const pendingDataSaves = [];

    // Clean up stale jsPsych wrappers from previous runs (prevents stacking on restarts)
    document.querySelectorAll('.jspsych-content-wrapper').forEach(el => el.remove());

    ${customPreInitCode.local?.trim() ? `// --- User code (before initJsPsych) ---\n    ${customPreInitCode.local.trim()}\n\n    ` : ""}// __INIT_JSPSYCH_START__
    const jsPsych = initJsPsych({
           ${progressBar ? `show_progress_bar: true,` : ""}


    ${extensions}
    ${localParams.on_trial_start?.trim() ? `on_trial_start: function(trial) {\n      // --- User code (on_trial_start) ---\n      ${localParams.on_trial_start.trim()}\n    },` : ""}

    on_data_update: function (data) {
      if (data.builder_id !== undefined && data.builder_id !== null) {
        localStorage.setItem('jsPsych_resumeTrial', JSON.stringify({
          branches: data.branches || [],
          branchConditions: data.branchConditions || [],
          trialData: data
        }));
      }
      // Create and track the promise for this data save
      const savePromise = fetch("/api/append-result/${experimentID}", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          sessionId: trialSessionId,
          response: data,
        }),
      })
      .catch(error => {
        console.error('Error in on_data_update:', error);
      })
      .finally(() => {
        // Remove from pending once complete
        const index = pendingDataSaves.indexOf(savePromise);
        if (index > -1) {
          pendingDataSaves.splice(index, 1);
        }
      });
      
      pendingDataSaves.push(savePromise);
      
      // Actualizar estado a 'in-progress' en la primera actualización
      if (data.trial_index === 0 && socket) {
        socket.emit('update-session-state', {
          experimentID: '${experimentID}',
          sessionId: trialSessionId,
          state: 'in-progress'
        });
      }
      
      ${branchingEvaluation}${localParams.on_data_update?.trim() ? `\n\n      // --- User code (on_data_update) ---\n      ${localParams.on_data_update.trim()}` : ""}
    },

  on_finish: async function() {
    if (pendingDataSaves.length > 0) {
      await Promise.allSettled(pendingDataSaves);
    }

    _showLoading('Saving your data\u2026');
    await new Promise(r => setTimeout(r, 0));

    _setLoadingMsg('Finishing up\u2026');

    try {
      const completeResponse = await fetch("/api/complete-session/${experimentID}", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          sessionId: trialSessionId,
        }),
      });
      if (!completeResponse.ok) {
        throw new Error('Session completion failed: ' + completeResponse.status);
      }
    } catch (error) {
      console.error('Error completing session:', error);
      _setLoadingMsg('Error saving data. Please contact support.');
      return;
    }

    if (socket) {
      socket.emit('update-session-state', {
        experimentID: '${experimentID}',
        sessionId: trialSessionId,
        state: 'completed'
      });
    }

    localStorage.removeItem('jsPsych_resumeTrial');
    localStorage.removeItem('jsPsych_currentSessionId');
    localStorage.removeItem('jsPsych_participantNumber');
    _showSuccess();${localParams.on_finish?.trim() ? `\n    // --- User code (on_finish) ---\n    ${localParams.on_finish.trim()}` : ""}
  }${(() => {
    const BUILDER_PARAMS = ["on_trial_start", "on_data_update", "on_finish"];
    const FUNCTION_PARAMS: Record<string, string> = {
      on_trial_finish: "function(data) {\n  ${code}\n}",
      on_interaction_data_update: "function(data) {\n  ${code}\n}",
      on_close: "function() {\n  ${code}\n}",
    };
    const extraPairs = Object.entries(localParams)
      .filter(([k, v]) => !BUILDER_PARAMS.includes(k) && v?.trim())
      .map(([k, v]) => {
        const trimmed = v.trim();
        const fn = FUNCTION_PARAMS[k];
        return fn
          ? `  ${k}: ${fn.replace("${code}", trimmed)}`
          : `  ${k}: ${trimmed}`;
      })
      .join(",\n");
    const extraBlock = extraPairs
      ? `,\n\n  // --- User-added initJsPsych params ---\n${extraPairs}`
      : "";
    const customBlock = customCode?.trim()
      ? `,\n\n  // --- Global Custom Code (initJsPsych options) ---\n  ${customCode}`
      : "";
    return extraBlock + customBlock;
  })()}
});
    // __INIT_JSPSYCH_END__

${baseCode}

})();
`;
}
