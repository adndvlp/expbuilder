import { buildLocalOutboxCode } from "../Timeline/ExperimentCode/services/localOutboxCode";

type SelectedPreviewPersistenceOptions = {
  experimentID: string;
  isSaveMode: boolean;
  selectionName: string;
};

export function buildSelectedPreviewPersistence({
  experimentID,
  isSaveMode,
  selectionName,
}: SelectedPreviewPersistenceOptions): string {
  const encodedExperimentID = JSON.stringify(experimentID);
  const encodedSessionPrefix = JSON.stringify(`${selectionName}_result_`);
  const encodedSessionKey = JSON.stringify(
    `expbuilder:preview:${experimentID}:${selectionName}:session-id`,
  );
  const participantEndpoint = JSON.stringify(
    `/api/participant-number/${experimentID}`,
  );
  const sessionEndpoint = JSON.stringify(`/api/append-result/${experimentID}`);

  return `
    ${buildLocalOutboxCode()}

    const _previewSessionKey = ${encodedSessionKey};
    const _newPreviewSessionId = function() {
      return ${encodedSessionPrefix} + (crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10));
    };
    const storedSessionId = ${isSaveMode ? "sessionStorage.getItem(_previewSessionKey) || localStorage.getItem(_previewSessionKey)" : "null"};
    const trialSessionId = storedSessionId || _newPreviewSessionId();
    const isSaveMode = ${isSaveMode};
    ${isSaveMode ? `window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '/api/participant-files/${experimentID}';` : ""}
    if (isSaveMode) {
      sessionStorage.setItem(_previewSessionKey, trialSessionId);
      localStorage.setItem(_previewSessionKey, trialSessionId);
      window.JSPSYCH_SESSION_ID = trialSessionId;
    }
    let participantNumber;
    ${isSaveMode ? `const localOutbox = _createLocalOutbox(${encodedExperimentID}, trialSessionId);` : "const localOutbox = null;"}
    let persistedEventCount = 0;

    async function _previewJson(response) {
      try { return await response.json(); } catch (_error) { return null; }
    }

    function _flushPreviewOutbox() {
      if (!localOutbox) return;
      void localOutbox.flush().catch(function(error) {
        console.warn('[session-persistence] recovered preview results remain pending', {
          experimentID: ${encodedExperimentID},
          sessionId: trialSessionId,
          error: error.message
        });
      });
    }

    async function initParticipant() {
      if (!isSaveMode) {
        const response = await fetch(${participantEndpoint}, {
          headers: { Accept: 'application/json' }
        });
        const body = await _previewJson(response);
        if (
          !response.ok ||
          !body ||
          !Number.isInteger(body.participantNumber) ||
          body.participantNumber < 1
        ) {
          throw new Error('Participant number request failed');
        }
        return body.participantNumber;
      }

      if (storedSessionId) {
        let persistedResponse;
        try {
          persistedResponse = await fetch(
            '/api/session-results/' + ${encodedExperimentID} +
              '?sessionId=' + encodeURIComponent(trialSessionId),
            { headers: { Accept: 'application/json' } }
          );
        } catch (_error) {
          throw new Error('Preview session could not be verified');
        }
        const persistedBody = await _previewJson(persistedResponse);
        const session = persistedBody && Array.isArray(persistedBody.sessions)
          ? persistedBody.sessions.find(function(candidate) {
              return candidate.sessionId === trialSessionId &&
                candidate.experimentID === ${encodedExperimentID};
            })
          : null;
        if (!persistedResponse.ok || !persistedBody || !Array.isArray(persistedBody.sessions)) {
          throw new Error('Preview session could not be verified');
        }
        if (!session) {
          sessionStorage.removeItem(_previewSessionKey);
          localStorage.removeItem(_previewSessionKey);
          throw new Error('Preview session no longer exists; run the preview again');
        }
        if (session.state === 'completed') {
          sessionStorage.removeItem(_previewSessionKey);
          localStorage.removeItem(_previewSessionKey);
          throw new Error('Preview session is already completed; run the preview again');
        }
        if (
          session.sequenceTracked !== true ||
          !Number.isInteger(session.storedEventCount) ||
          !Number.isInteger(session.lastSequence) ||
          session.lastSequence !== session.storedEventCount - 1 ||
          !Number.isInteger(session.participantNumber) ||
          session.participantNumber < 1
        ) {
          throw new Error('Preview session has inconsistent saved results');
        }
        persistedEventCount = session.storedEventCount;
        await localOutbox.initialize(persistedEventCount);
        _flushPreviewOutbox();
        return session.participantNumber;
      }

      let response;
      try {
        response = await fetch(${sessionEndpoint}, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sessionId: trialSessionId })
        });
      } catch (_error) {
        throw new Error('Preview session creation failed');
      }
      const body = await _previewJson(response);
      if (
        !response.ok ||
        !body ||
        body.success !== true ||
        body.id !== trialSessionId ||
        !Number.isInteger(body.participantNumber) ||
        body.participantNumber < 1
      ) {
        throw new Error('Preview session creation failed');
      }
      await localOutbox.initialize(0);
      _flushPreviewOutbox();
      return body.participantNumber;
    }

    function persistPreviewResult(data) {
      if (!localOutbox) return;
      localOutbox.enqueue(data).catch(function(error) {
        console.error('[session-persistence] preview result remains recoverable', {
          experimentID: ${encodedExperimentID},
          sessionId: trialSessionId,
          error: error.message
        });
      });
    }

    async function completePreviewSession() {
      if (!localOutbox) return true;
      try {
        const stats = await localOutbox.waitForIdle();
        if (stats.pending !== 0 || stats.acknowledged !== stats.total) return false;
        const response = await fetch('/api/complete-session/' + ${encodedExperimentID}, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            sessionId: trialSessionId,
            expectedEventCount: stats.total,
            lastSequence: stats.lastSequence
          })
        });
        const body = await _previewJson(response);
        if (
          !response.ok ||
          !body ||
          body.success !== true ||
          body.storedEventCount !== stats.total ||
          body.lastSequence !== stats.lastSequence
        ) return false;
        await localOutbox.clear();
        sessionStorage.removeItem(_previewSessionKey);
        localStorage.removeItem(_previewSessionKey);
        return true;
      } catch (error) {
        console.error('[session-persistence] preview completion remains pending', {
          experimentID: ${encodedExperimentID},
          sessionId: trialSessionId,
          error: error.message
        });
        return false;
      }
    }
  `;
}
