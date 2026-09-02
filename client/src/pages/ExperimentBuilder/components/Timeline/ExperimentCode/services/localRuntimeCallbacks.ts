import type { LocalExperimentCodeOptions } from "./localCodeTypes";

export function buildLocalDataCallback({
  branchingEvaluation,
  experimentID,
  localParams,
}: LocalExperimentCodeOptions): string {
  const id = experimentID ?? "";
  return `
    on_data_update: function(data) {
      _runtimeTrace('trial-data', {
        builderId: data.builder_id ?? data.trial_id ?? data.loop_id ?? null,
        trialIndex: data.trial_index ?? null
      });
      if (data.builder_id !== undefined && data.builder_id !== null) {
        localStorage.setItem(
          _sessionKeys.resumeTrial,
          JSON.stringify(_createResumeCheckpoint(data))
        );
      }

      localOutbox.enqueue(data).catch(function(error) {
        console.error('[session-persistence] result remains recoverable in IndexedDB', {
          experimentID: ${JSON.stringify(id)},
          sessionId: trialSessionId,
          error: error.message
        });
      });

      if (data.trial_index === 0) {
        void _emitPresence('update-session-state', {
          experimentID: ${JSON.stringify(id)},
          sessionId: trialSessionId,
          state: 'in-progress'
        });
      }

      ${branchingEvaluation}${localParams.on_data_update?.trim() ? `

      // --- User code (on_data_update) ---
      ${localParams.on_data_update.trim()}` : ""}
    },
`;
}

export function buildLocalFinishCallback({
  experimentID,
  localParams,
}: LocalExperimentCodeOptions): string {
  const id = experimentID ?? "";
  return `
    on_finish: async function() {
      if (window.ExpBuilderNavigation.isTransitionPending()) {
        _runtimeTrace('experiment-finish-suppressed', { reason: 'jump' });
        return;
      }
      _showLoading('Saving your data…');
      _setLoadingMsg('Verifying every result…');
      let completionRetryDelay = 2000;
      const attemptDurableCompletion = async function() {
        try {
        const stats = await localOutbox.waitForIdle();
        if (stats.pending !== 0 || stats.acknowledged !== stats.total) {
          throw new Error('Some results are still pending');
        }
        const response = await fetch('/api/complete-session/${id}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            sessionId: trialSessionId,
            expectedEventCount: stats.total,
            lastSequence: stats.lastSequence
          })
        });
        const body = await _readJson(response);
        if (
          !response.ok ||
          !body ||
          body.success !== true ||
          body.storedEventCount !== stats.total ||
          body.lastSequence !== stats.lastSequence
        ) {
          const acknowledgementError = new Error(
            'Completion acknowledgement did not match saved results'
          );
          acknowledgementError.retryable = response.status >= 500 || response.status === 429;
          throw acknowledgementError;
        }

        await _emitPresence('update-session-state', {
          experimentID: ${JSON.stringify(id)},
          sessionId: trialSessionId,
          state: 'completed'
        });
        await localOutbox.clear();
        window.ExpBuilderNavigation.clearTransientState();
        _clearSessionIdentity();
        if (_sessionChannel) _sessionChannel.close();
        _runtimeTrace('experiment-finish', {
          experimentID: ${JSON.stringify(id)},
          sessionId: trialSessionId
        });
        _showSuccess();${localParams.on_finish?.trim() ? `
        try {
        // --- User code (on_finish) ---
        ${localParams.on_finish.trim()}
        } catch (userError) {
          console.error('[experiment] on_finish failed', {
            error: userError && userError.message ? userError.message : String(userError)
          });
        }` : ""}
        return true;
      } catch (error) {
        _runtimeError(error, { source: 'session-completion' });
        console.error('[session-persistence] completion blocked; data remains recoverable', {
          experimentID: ${JSON.stringify(id)},
          sessionId: trialSessionId,
          error: error.message
        });
        if (error.retryable === false) {
          _setLoadingMsg('Data remains on this device, but the server rejected completion.');
          return false;
        }
        _setLoadingMsg('Data remains on this device. Reconnecting to save…');
        const retryAfter = completionRetryDelay;
        completionRetryDelay = Math.min(completionRetryDelay * 2, 30000);
        setTimeout(function() {
          void attemptDurableCompletion();
        }, retryAfter);
        return false;
      }
      };
      await attemptDurableCompletion();
    }
`;
}
