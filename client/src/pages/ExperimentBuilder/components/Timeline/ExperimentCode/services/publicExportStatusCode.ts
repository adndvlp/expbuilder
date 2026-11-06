import type { PublicExperimentCodeOptions } from './publicCodeTypes';

export function publicExportStatusCode({ DATA_API_URL, experimentID }: PublicExperimentCodeOptions): string {
  return `
    async function _publicExportStatus(action = 'sessionStatus') {
      const response = await fetch(${JSON.stringify(DATA_API_URL)}, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, experimentID: ${JSON.stringify(experimentID)}, sessionId: trialSessionId }) });
      if (!response.ok) throw new Error('Export status could not be checked');
      return response.json();
    }
    async function _waitForPublicExport(result, expected, recovery = false) {
      const deadline = Date.now() + 600000;
      let delay = 750;
      while (true) {
        if (result?.success !== true || result.experimentID !== ${JSON.stringify(experimentID)} || result.sessionId !== trialSessionId) {
          throw new Error('Invalid export status identity');
        }
        const receipt = recovery ? result.export : result.completion;
        if (!receipt) throw new Error('Missing export receipt');
        if (!recovery && Object.keys(expected).some(key => receipt[key] !== expected[key])) {
          throw new Error('Completion receipt differs from the expected responses');
        }
        if (receipt.confirmed === true) {
          if (recovery && (receipt.eventCount !== expected.expectedEventCount || receipt.eventsHash !== expected.eventsHash
              || receipt.confirmedRevision !== receipt.requestedRevision)) throw new Error('Recovery receipt does not confirm all pending responses');
          publicExportRetryRequested = false;
          return receipt;
        }
        if (publicExportRetryRequested) {
          publicExportRetryRequested = false;
          result = await _publicExportStatus('retryExport');
          continue;
        }
        if (!result.export?.status || result.export.status === 'needs_attention') throw new Error('Storage export needs a retry or support');
        if (Date.now() >= deadline) throw new Error('Storage export is still pending; retry checking its status');
        _setLoadingMsg('Saving your data…');
        await new Promise(resolve => setTimeout(resolve, delay));
        result = await _publicExportStatus(); delay = Math.min(5000, delay * 1.5);
      }
    }
    function _showPublicRecoveryComplete() {
      _hideLoading?.();
      document.getElementById('expbuilder-expired-session')?.remove();
      const panel = document.createElement('div');
      panel.style.cssText = 'padding:40px;text-align:center;font-family:sans-serif';
      panel.textContent = 'This session has ended. The available responses have been saved.';
      if (typeof _offerNewPublicSession === 'function') _offerNewPublicSession(panel);
      (document.getElementById('jspsych-container') || document.body).replaceChildren(panel);
    }
`;
}
