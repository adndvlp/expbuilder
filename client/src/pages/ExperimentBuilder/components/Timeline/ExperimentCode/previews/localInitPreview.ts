export function getLocalInitJsPsychPreview(
  experimentID: string | undefined,
  progressBar: boolean,
): string {
  const eid = experimentID ?? "[experimentID]";
  return `// __INIT_JSPSYCH_START__
const jsPsych = initJsPsych({
  ${progressBar ? "show_progress_bar: true," : "// show_progress_bar: false,"}

  // extensions: [...],  // loaded from experiment config

  on_data_update: function(data) {
    const savePromise = fetch("/api/append-result/${eid}", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({
        sessionId: trialSessionId,
        response: data,
      }),
    })
    .then(res => {
      if (!res.ok) console.error('Error saving trial data:', res.statusText);
      return res;
    })
    .catch(error => {
      console.error('Error in on_data_update:', error);
    })
    .finally(() => {
      const index = pendingDataSaves.indexOf(savePromise);
      if (index > -1) pendingDataSaves.splice(index, 1);
    });

    pendingDataSaves.push(savePromise);

    // Resume system: preserve last trial state for resume
    if (data.builder_id !== undefined && data.builder_id !== null) {
      localStorage.setItem('jsPsych_resumeTrial', JSON.stringify({
        branches: data.branches || [],
        branchConditions: data.branchConditions || [],
        trialData: data
      }));
    }

    // Track in-progress via socket
    if (data.trial_index === 0 && socket) {
      socket.emit('update-session-state', {
        experimentID: '${eid}',
        sessionId: trialSessionId,
        state: 'in-progress'
      });
    }

    // [branching evaluation injected here]
  },

  on_finish: async function() {
    // Repeat/jump: reload to execute pending jump
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

    _showSuccess();
  },
  // [customCode extra options injected here if set in Extra Options]
});
// __INIT_JSPSYCH_END__`;
}
