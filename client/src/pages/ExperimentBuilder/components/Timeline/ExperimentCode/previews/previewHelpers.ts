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

// Builder: track pending saves
const pendingDataSaves = [];

// Builder: clean up stale jsPsych wrappers
document.querySelectorAll('.jspsych-content-wrapper').forEach(el => el.remove());
${userBlock}
// ── initJsPsych starts below ─────────────────────────────────────────────────
const jsPsych = initJsPsych({
  // on_data_update, on_finish … (configured in initJsPsych tab)
});

// jsPsych.run(timeline);  ← runs after initJsPsych`;
}

export function getPreInitPublicPreview(
  _eid: string,
  userCode?: string,
): string {
  const userBlock = userCode?.trim()
    ? `\n// --- Your code (runs here, before initJsPsych) ---\n${userCode.trim()}\n`
    : "\n// (your code will run here)\n";
  return `// ── Inside async IIFE — after Firebase/session setup ────────────────────────

// Builder: track pending batch saves
const pendingBatchSaves = [];

// Builder: clean up stale jsPsych wrappers
document.querySelectorAll('.jspsych-content-wrapper').forEach(el => el.remove());

// Builder: URL params (Prolific / MTurk)
const _urlParams = new URLSearchParams(window.location.search);
const _prolificPID = _urlParams.get('PROLIFIC_PID');
const _mturkWorkerID = _urlParams.get('workerId');
// … (other recruitment params available)
${userBlock}
// ── initJsPsych starts below ─────────────────────────────────────────────────
const jsPsych = initJsPsych({
  // on_trial_start, on_data_update, on_finish … (configured in initJsPsych tab)
});

// jsPsych.run(timeline);  ← runs after initJsPsych`;
}

// Per-param preview helpers — used by GlobalCustomCode split-view right panels

export function getLocalOnDataUpdatePreview(
  eid: string,
  userCode?: string,
): string {
  return `on_data_update: function(data) {
    const savePromise = fetch("/api/append-result/${eid}", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({ sessionId: trialSessionId, response: data }),
    })
    .then(res => { if (!res.ok) console.error('Error saving trial data:', res.statusText); return res; })
    .catch(error => { console.error('Error in on_data_update:', error); })
    .finally(() => {
      const index = pendingDataSaves.indexOf(savePromise);
      if (index > -1) pendingDataSaves.splice(index, 1);
    });

    pendingDataSaves.push(savePromise);

    if (data.builder_id !== undefined && data.builder_id !== null) {
      localStorage.setItem('jsPsych_resumeTrial', JSON.stringify({
        branches: data.branches || [],
        branchConditions: data.branchConditions || [],
        trialData: data
      }));
    }

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
    if (localStorage.getItem('jsPsych_jumpToTrial')) {
      if (pendingDataSaves.length > 0) await Promise.allSettled(pendingDataSaves);
      sessionStorage.setItem('jsPsych_jumpReload', '1');
      window.location.reload();
      return;
    }

    _showLoading('Saving your data…');
    await new Promise(r => setTimeout(r, 0));

    localStorage.removeItem('jsPsych_resumeTrial');
    localStorage.removeItem('jsPsych_currentSessionId');
    localStorage.removeItem('jsPsych_participantNumber');

    if (pendingDataSaves.length > 0) {
      _setLoadingMsg('Uploading data…');
      await Promise.allSettled(pendingDataSaves);
    }

    _setLoadingMsg('Finishing up…');

    if (socket) {
      socket.emit('update-session-state', {
        experimentID: '${eid}',
        sessionId: trialSessionId,
        state: 'completed'
      });
    }

    await fetch("/api/complete-session/${eid}", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({ sessionId: trialSessionId }),
    });

    _showSuccess();${injectUserCode(userCode)}
  },`;
}

export function getPublicOnTrialStartPreview(userCode?: string): string {
  return `on_trial_start: function(trial) {
    const lastTrialData = jsPsych.data.get();
    if (lastTrialData && trial.data) {
      trial.data.prev_response = lastTrialData.response;
    }${injectUserCode(userCode)}
  },`;
}

export function getPublicOnDataUpdatePreview(
  eid: string,
  userCode?: string,
): string {
  return `on_data_update: async function(data) {
    data.clientTimestamp = Date.now();
    data.sessionId = trialSessionId;
    data.experimentID = '${eid}';

    if (data.trial_index === 0) {
      sessionRef.update({ state: 'in-progress', lastUpdate: firebase.database.ServerValue.TIMESTAMP });
    }

    if (data.builder_id !== undefined && data.builder_id !== null) {
      localStorage.setItem('jsPsych_resumeTrial', JSON.stringify({
        branches: data.branches || [],
        branchConditions: data.branchConditions || [],
        trialData: data
      }));
    }

    if (BATCH_CONFIG.useIndexedDB) {
      await TrialDB.add(data);
      if (BATCH_CONFIG.size > 0) {
        const pendingCount = await TrialDB.count();
        if (pendingCount >= BATCH_CONFIG.size) {
          const batch = await TrialDB.getN(BATCH_CONFIG.size);
          BATCH_CONFIG.currentBatchNumber++;
          await sendBatchConcatenated(batch, BATCH_CONFIG.currentBatchNumber);
          await TrialDB.deleteN(BATCH_CONFIG.size);
        }
      }
    } else {
      await fetch("[DATA_API_URL]", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentID: '${eid}', sessionId: trialSessionId, data }),
      });
    }

    // [branching evaluation injected here]${injectUserCode(userCode)}
  },`;
}

export function getPublicOnFinishPreview(
  _eid: string,
  userCode?: string,
): string {
  return `on_finish: async function() {
    if (localStorage.getItem('jsPsych_jumpToTrial')) {
      if (pendingBatchSaves.length > 0) await Promise.allSettled(pendingBatchSaves);
      sessionStorage.setItem('jsPsych_jumpReload', '1');
      window.location.reload();
      return;
    }

    _showLoading('Saving your data…');
    await new Promise(r => setTimeout(r, 0));

    localStorage.removeItem('jsPsych_resumeTrial');
    localStorage.removeItem('jsPsych_currentSessionId');
    localStorage.removeItem('jsPsych_participantNumber');

    if (BATCH_CONFIG.useIndexedDB) {
      if (pendingBatchSaves.length > 0) await Promise.allSettled(pendingBatchSaves);
      const allTrials = await TrialDB.getAll();
      if (allTrials.length > 0) {
        if (BATCH_CONFIG.size === 0) {
          await sendCompleteExperiment(allTrials);
        } else {
          BATCH_CONFIG.currentBatchNumber++;
          await sendBatchConcatenated(allTrials, BATCH_CONFIG.currentBatchNumber);
        }
        await TrialDB.clear();
      }
    }

    sessionRef.onDisconnect().cancel();
    _setLoadingMsg('Finishing up…');

    await sessionRef.update({
      connected: false,
      finished: true,
      state: 'completed',
      finishedAt: firebase.database.ServerValue.TIMESTAMP,
    });

    // [recruitment redirect: Prolific / MTurk / none → _showSuccess()]
    _showSuccess();${injectUserCode(userCode)}
  },`;
}
