export function getPublicInitJsPsychPreview(
  experimentID: string | undefined,
  progressBar: boolean,
): string {
  const eid = experimentID ?? "[experimentID]";
  return `// __INIT_JSPSYCH_START__
const jsPsych = initJsPsych({
  ${progressBar ? "show_progress_bar: true," : "// show_progress_bar: false,"}

  on_trial_start: function(trial) {
    const lastTrialData = jsPsych.data.get();
    if (lastTrialData && trial.data) {
      trial.data.prev_response = lastTrialData.response;
    }
  },

  // extensions: [...],  // loaded from experiment config

  on_data_update: async function(data) {
    data.clientTimestamp = Date.now();
    data.sessionId = trialSessionId;
    data.experimentID = '${eid}';

    // Track in-progress via Firebase
    if (data.trial_index === 0) {
      sessionRef.update({ state: 'in-progress', lastUpdate: firebase.database.ServerValue.TIMESTAMP });
    }

    // Resume system
    if (data.builder_id !== undefined && data.builder_id !== null) {
      localStorage.setItem('jsPsych_resumeTrial', JSON.stringify({
        branches: data.branches || [],
        branchConditions: data.branchConditions || [],
        trialData: data
      }));
    }

    // IndexedDB batching (batchSize configured in Firestore)
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
      // No IndexedDB: send trial-by-trial to Firebase
      await fetch("[DATA_API_URL]", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentID: '${eid}', sessionId: trialSessionId, data }),
      });
    }

    // [branching evaluation injected here]
  },

  on_finish: async function() {
    // Repeat/jump: reload to execute pending jump
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

    // Flush remaining IndexedDB trials
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
    _showSuccess();
  },
});
// __INIT_JSPSYCH_END__`;
}
