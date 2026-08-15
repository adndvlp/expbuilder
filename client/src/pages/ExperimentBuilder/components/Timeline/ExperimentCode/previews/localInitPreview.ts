function injectUserCode(userCode: string | undefined): string {
  const trimmed = userCode?.trim() ?? "";
  if (!trimmed) return "";
  return `\n    // --- User code ---\n    ${trimmed}`;
}

export function getPreInitLocalPreview(
  _eid: string,
  userCode?: string,
): string {
  const userBlock = userCode?.trim()
    ? `\n// --- Your code (runs here, before initJsPsych) ---\n${userCode.trim()}\n`
    : "\n// (your code will run here)\n";
  return `// ── Inside async IIFE — after session/socket setup ──────────────────────────

_hideLoading();

// Builder: IndexedDB outbox uses the persisted server count when resuming
const localOutbox = _createLocalOutbox(experimentID, trialSessionId);
await localOutbox.initialize(persistedEventCount);

// Builder: clean up stale jsPsych wrappers
document.querySelectorAll('.jspsych-content-wrapper').forEach(el => el.remove());
${userBlock}
// ── initJsPsych starts below ─────────────────────────────────────────────────
const jsPsych = initJsPsych({
  // on_data_update, on_finish … (configured in initJsPsych tab)
});

// jsPsych.run(timeline);  ← runs after initJsPsych`;
}

export function getLocalOnDataUpdatePreview(
  eid: string,
  userCode?: string,
): string {
  return `on_data_update: function(data) {
    if (data.builder_id !== undefined && data.builder_id !== null) {
      localStorage.setItem(_sessionKeys.resumeTrial, JSON.stringify({
        branches: data.branches || [],
        branchConditions: data.branchConditions || [],
        trialData: data
      }));
    }

    localOutbox.enqueue(data).catch(error => {
      console.error('Result remains safe in IndexedDB:', error);
    });

    if (data.trial_index === 0 && socket) {
      socket.emit('update-session-state', {
        experimentID: '${eid}',
        sessionId: trialSessionId,
        state: 'in-progress'
      });
    }

    // [branching evaluation injected here]${injectUserCode(userCode)}
  },`;
}

export function getLocalOnFinishPreview(
  eid: string,
  userCode?: string,
): string {
  return `on_finish: async function() {
    _showLoading('Saving your data…');
    await new Promise(r => setTimeout(r, 0));

    _setLoadingMsg('Finishing up…');

    const stats = await localOutbox.waitForIdle();
    if (stats.pending !== 0 || stats.acknowledged !== stats.total) {
      _setLoadingMsg('Data is safe on this device. Reconnecting to save…');
      return;
    }
    const completeResponse = await fetch("/api/complete-session/${eid}", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({
        sessionId: trialSessionId,
        expectedEventCount: stats.total,
        lastSequence: stats.lastSequence
      }),
    });
    let completeBody = null;
    try { completeBody = await completeResponse.json(); } catch (_error) {}
    if (
      !completeResponse.ok ||
      !completeBody ||
      completeBody.success !== true ||
      completeBody.storedEventCount !== stats.total ||
      completeBody.lastSequence !== stats.lastSequence
    ) {
      _setLoadingMsg('Data is safe on this device. Reconnecting to save…');
      return;
    }

    if (socket) {
      socket.emit('update-session-state', {
        experimentID: '${eid}',
        sessionId: trialSessionId,
        state: 'completed'
      });
    }

    await localOutbox.clear();
    _clearSessionIdentity();
    _showSuccess();${injectUserCode(userCode)}
  },`;
}

export function getLocalInitJsPsychPreview(
  experimentID: string | undefined,
  progressBar: boolean,
): string {
  const eid = experimentID ?? "[experimentID]";
  return `// __INIT_JSPSYCH_START__
const jsPsych = initJsPsych({
  ${progressBar ? "show_progress_bar: true," : "// show_progress_bar: false,"}

  // extensions: [...],  // loaded from experiment config

  ${getLocalOnDataUpdatePreview(eid)}

  ${getLocalOnFinishPreview(eid)}
  // [customCode extra options injected here if set in Extra Options]
});
// __INIT_JSPSYCH_END__`;
}
