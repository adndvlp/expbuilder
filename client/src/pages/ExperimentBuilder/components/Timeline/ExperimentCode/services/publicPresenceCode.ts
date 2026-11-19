import type { PublicExperimentCodeOptions } from './publicCodeTypes';

export function publicPresenceCode({ experimentID }: PublicExperimentCodeOptions): string {
  return `
    let _publicConnected = false, _publicRuntimeReady = false, _publicReconnecting = null;
    let sessionRef = null, _publicRetryResume = () => {};
    function _publicWriterPermission() { return { ..._publicWriter }; }
    function _adoptPublicClosure(result) {
      if (['resume_required', 'session_in_use'].includes(result.decision)) {
        _publicConnected = false;
        if (_publicRuntimeReady) jsPsych.pauseExperiment();
      }
      if (!['expired', 'completed'].includes(result.lifecycle)) return false;
      _publicSessionState = { ..._publicSessionState, ...result };
      _publicConnected = false;
      if (_publicRuntimeReady) {
        publicRecoveryMode = true; publicClosing = true; jsPsych.pauseExperiment();
        setTimeout(() => publicFinishHandler(), 0);
      }
      return true;
    }
    async function _connectPublicSession(renew = false) {
      _publicConnected = false;
      if (renew) _publicSessionState = await createSession('resumeSession', true);
      if (_adoptPublicClosure(_publicSessionState)) return;
      if (_publicSessionState.decision !== 'resume_allowed') throw new Error('Session cannot resume: ' + _publicSessionState.decision);
      const connection = _publicSessionState.connection;
      _publicWriter.connectionGeneration = connection.generation;
      sessionRef = db.ref('session_connections/${experimentID}/' + trialSessionId + '/' + _publicWriter.connectionId);
      const presence = { generation: connection.generation, token: _publicWriter.writeToken,
        changedAt: window.firebase.database.ServerValue.TIMESTAMP };
      // Registration must finish before making the connection visible.
      await sessionRef.onDisconnect().set({ ...presence, connected: false });
      if (connection.phase !== 'active') await sessionRef.set({ ...presence, connected: true });
      const activated = await createSession('activateConnection');
      if (_adoptPublicClosure(activated)) return;
      if (activated.decision !== 'resume_allowed' || activated.connection?.phase !== 'active') throw new Error('Connection was not confirmed');
      _publicSessionState = activated;
      _publicConnected = true;
    }
    async function _retryPublicPresence() {
      if (publicClosing) return;
      await _connectPublicSession(true);
      if (!_publicConnected) return;
      await _drainPublicResponses();
      if (BATCH_CONFIG.useIndexedDB) await _flushPublicBatches();
      _hideLoading(); _publicRetryResume();
    }
    function _observePublicConnection() {
      _publicRuntimeReady = true;
      const resume = jsPsych.resumeExperiment.bind(jsPsych);
      let waitingToResume = false, first = true;
      jsPsych.resumeExperiment = () => {
        if (_publicConnected && !publicClosing) { waitingToResume = false; resume(); }
        else waitingToResume = true;
      };
      _publicRetryResume = () => { if (waitingToResume) jsPsych.resumeExperiment(); };
      db.ref('.info/connected').on('value', snapshot => {
        if (first) { first = false; if (snapshot.val() === true) return; }
        if (snapshot.val() !== true) {
          if (publicClosing) return;
          _publicConnected = false; jsPsych.pauseExperiment(); waitingToResume = true;
          _showLoading('Connection lost. Waiting to resume this session…');
          return;
        }
        if (publicClosing || _publicReconnecting) return;
        _publicReconnecting = _retryPublicPresence().catch(_publicPersistenceError).finally(() => { _publicReconnecting = null; });
      });
    }
`;
}
