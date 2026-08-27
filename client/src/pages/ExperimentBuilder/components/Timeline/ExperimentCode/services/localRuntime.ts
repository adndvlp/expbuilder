import { LocalExperimentCodeOptions } from "./localCodeTypes";
import {
  activateResumeRouteDecisionCode,
  resumeJumpStartupCode,
} from "./resumeJumpStartupCode";

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
    const _runtimeTrace = (type, payload) => {
      if (window.ExpBuilderRuntime) {
        window.ExpBuilderRuntime.emit(type, payload || {});
      }
    };
    const _runtimeError = (error, context) => {
      if (window.ExpBuilderRuntime) {
        window.ExpBuilderRuntime.reportError(error, context || {});
      }
    };
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
${activateResumeRouteDecisionCode()}

    _hideLoading();

    // Clean up stale jsPsych wrappers from previous runs (prevents stacking on restarts)
    document.querySelectorAll('.jspsych-content-wrapper').forEach(el => el.remove());

    const localOutbox = _createLocalOutbox('${experimentID}', trialSessionId);
    await localOutbox.initialize(0);

    ${customPreInitCode.local?.trim() ? `// --- User code (before initJsPsych) ---\n    ${customPreInitCode.local.trim()}\n\n    ` : ""}// __INIT_JSPSYCH_START__
    const jsPsych = initJsPsych({
           ${progressBar ? `show_progress_bar: true,` : ""}


    ${extensions}
    on_trial_start: function(trial) {
      const trialData = trial && trial.data ? trial.data : {};
      _runtimeTrace('trial-start', {
        builderId: trialData.builder_id ?? trialData.trial_id ?? null,
        trialType: trial && trial.type ? String(trial.type.info?.name || trial.type) : null
      });${localParams.on_trial_start?.trim() ? `\n      // --- User code (on_trial_start) ---\n      ${localParams.on_trial_start.trim()}` : ""}
    },

    on_data_update: function (data) {
      _runtimeTrace('trial-data', {
        builderId: data.builder_id ?? data.trial_id ?? data.loop_id ?? null,
        trialIndex: data.trial_index ?? null
      });
      if (data.builder_id !== undefined && data.builder_id !== null) {
        localStorage.setItem(
          'jsPsych_resumeTrial',
          JSON.stringify(_createResumeCheckpoint(data))
        );
      }
      // Enqueue data through the IndexedDB outbox for resilient delivery
      localOutbox.enqueue(data).then(() => {
        window.ExpBuilderNavigation.onTrialPersisted(data);
      }).catch(error => {
        _runtimeError(error, { source: 'trial-data-save' });
        console.error('Error in on_data_update:', error);
      });
      
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
    if (window.ExpBuilderNavigation.isTransitionPending()) {
      _runtimeTrace('experiment-finish-suppressed', { reason: 'jump' });
      return;
    }
    await localOutbox.waitForIdle();

    _showLoading('Saving your data\u2026');
    await new Promise(r => setTimeout(r, 0));

    _setLoadingMsg('Finishing up\u2026');

    try {
      const _stats = await localOutbox.stats();
      const completeResponse = await fetch("/api/complete-session/${experimentID}", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          sessionId: trialSessionId,
          expectedEventCount: _stats.total,
          lastSequence: _stats.lastSequence,
        }),
      });
      if (!completeResponse.ok) {
        throw new Error('Session completion failed: ' + completeResponse.status);
      }
    } catch (error) {
      _runtimeError(error, { source: 'session-completion' });
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

    window.ExpBuilderNavigation.clearTransientState();
    await localOutbox.clear();
    localStorage.removeItem('jsPsych_currentSessionId');
    localStorage.removeItem('jsPsych_participantNumber');
    _runtimeTrace('experiment-finish', {
      experimentID: '${experimentID}',
      sessionId: trialSessionId
    });
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
