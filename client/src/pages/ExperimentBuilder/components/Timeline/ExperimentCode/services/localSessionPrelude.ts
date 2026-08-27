import { resumeCode } from "../ResumeCode";
import { loadingOverlayCode } from "../LoadingOverlay";
import type { LocalExperimentCodeOptions } from "./localCodeTypes";
import { buildLocalMetadataCode } from "./localMetadataCode";
import { buildLocalSessionNameCode } from "./localSessionNameCode";

export function buildLocalSessionPrelude(
  options: LocalExperimentCodeOptions,
): string {
  const experimentID = options.experimentID ?? "";
  return `
  window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '/api/participant-files/${experimentID}';
  window.JSPSYCH_EXPERIMENT_ID = ${JSON.stringify(experimentID)};

  ${resumeCode()}
  ${buildLocalSessionNameCode(options)}
  ${buildLocalMetadataCode()}

  const _sessionNamespace = 'expbuilder:local:' + ${JSON.stringify(experimentID)} + ':';
  const _sessionKeys = {
    sessionId: _sessionNamespace + 'session-id',
    participant: _sessionNamespace + 'participant-number',
    resumeTrial: _sessionNamespace + 'resume-trial',
    jumpTrial: _sessionNamespace + 'jump-to-trial',
    owner: _sessionNamespace + 'owner'
  };
  const _tabKeys = {
    id: _sessionNamespace + 'tab-id',
    sessionId: _sessionNamespace + 'tab-session-id',
    jumpReload: _sessionNamespace + 'jump-reload'
  };
  const _newId = function() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  };
  let _tabId = sessionStorage.getItem(_tabKeys.id);
  if (!_tabId) {
    _tabId = _newId();
    sessionStorage.setItem(_tabKeys.id, _tabId);
  }
  window.JSPSYCH_LOCAL_KEYS = _sessionKeys;
  const _sessionChannel = typeof BroadcastChannel === 'function'
    ? new BroadcastChannel(_sessionNamespace + 'ownership')
    : null;
  let trialSessionId = null;
  let _claimedSessionId = null;
  let isResuming = false;
  let participantNumber;

  if (_sessionChannel) {
    _sessionChannel.addEventListener('message', function(event) {
      if (
        event.data &&
        event.data.type === 'probe' &&
        (trialSessionId || _claimedSessionId) &&
        event.data.sessionId === (trialSessionId || _claimedSessionId)
      ) {
        _sessionChannel.postMessage({
          type: 'active',
          requestId: event.data.requestId,
          sessionId: trialSessionId || _claimedSessionId
        });
      }
    });
  }

  async function _claimSessionCandidate(sessionId) {
    if (!sessionId) return false;
    if (!_sessionChannel) {
      localStorage.setItem(_sessionKeys.owner, _tabId);
      await new Promise(function(resolve) { setTimeout(resolve, 100); });
      const claimed = localStorage.getItem(_sessionKeys.owner) === _tabId;
      if (claimed) _claimedSessionId = sessionId;
      return claimed;
    }

    const requestId = _newId();
    const contenders = new Set([_tabId]);
    const listener = function(event) {
      if (!event.data || event.data.sessionId !== sessionId) return;
      if (event.data.type === 'claim-probe') {
        contenders.add(event.data.tabId);
        _sessionChannel.postMessage({
          type: 'claim-response',
          requestId: event.data.requestId,
          sessionId: sessionId,
          tabId: _tabId
        });
      } else if (
        event.data.type === 'claim-response' &&
        event.data.requestId === requestId
      ) {
        contenders.add(event.data.tabId);
      }
    };
    _sessionChannel.addEventListener('message', listener);
    _sessionChannel.postMessage({
      type: 'claim-probe',
      requestId: requestId,
      sessionId: sessionId,
      tabId: _tabId
    });
    await new Promise(function(resolve) { setTimeout(resolve, 200); });
    _sessionChannel.removeEventListener('message', listener);
    const winner = Array.from(contenders).sort()[0];
    if (winner !== _tabId) return false;
    _claimedSessionId = sessionId;
    return true;
  }

  function _isSessionActiveElsewhere(sessionId) {
    if (!_sessionChannel || !sessionId) return Promise.resolve(false);
    return new Promise(function(resolve) {
      const requestId = _newId();
      let settled = false;
      const listener = function(event) {
        if (
          event.data &&
          event.data.type === 'active' &&
          event.data.requestId === requestId &&
          event.data.sessionId === sessionId
        ) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            _sessionChannel.removeEventListener('message', listener);
            resolve(true);
          }
        }
      };
      const timeout = setTimeout(function() {
        if (!settled) {
          settled = true;
          _sessionChannel.removeEventListener('message', listener);
          resolve(false);
        }
      }, 200);
      _sessionChannel.addEventListener('message', listener);
      _sessionChannel.postMessage({ type: 'probe', requestId: requestId, sessionId: sessionId });
    });
  }

  async function _selectSessionCandidate() {
    const tabCandidate = sessionStorage.getItem(_tabKeys.sessionId);
    const storedCandidate = localStorage.getItem(_sessionKeys.sessionId);
    const candidate = tabCandidate || storedCandidate;
    if (!candidate) return null;
    if (await _isSessionActiveElsewhere(candidate)) return null;
    return (await _claimSessionCandidate(candidate)) ? candidate : null;
  }

  async function _readJson(response) {
    try { return await response.json(); } catch (_error) { return null; }
  }

  async function _findPersistedSession(sessionId) {
    if (!sessionId) return { status: 'missing', session: null };
    try {
      const response = await fetch(
        '/api/session-results/${experimentID}?sessionId=' + encodeURIComponent(sessionId),
        { headers: { Accept: 'application/json' } }
      );
      const body = await _readJson(response);
      if (!response.ok || !body || !Array.isArray(body.sessions)) {
        return { status: 'unavailable', session: null };
      }
      const session = body.sessions.find(function(candidate) {
        return candidate.sessionId === sessionId && candidate.experimentID === ${JSON.stringify(experimentID)};
      }) || null;
      return { status: session ? 'valid' : 'missing', session: session };
    } catch (_error) {
      return { status: 'unavailable', session: null };
    }
  }

  async function saveSession(sessionId) {
    let response;
    try {
      response = await fetch('/api/append-result/${experimentID}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sessionId: sessionId, metadata: metadata })
      });
    } catch (_error) {
      throw new Error('Session creation failed because the server is unavailable');
    }
    const body = await _readJson(response);
    if (
      !response.ok ||
      !body ||
      body.success !== true ||
      body.id !== sessionId ||
      !Number.isInteger(body.participantNumber) ||
      body.participantNumber < 1
    ) {
      throw new Error('Session creation returned an invalid acknowledgement');
    }
    return body.participantNumber;
  }

  function _storePendingSessionIdentity(sessionId) {
    sessionStorage.setItem(_tabKeys.sessionId, sessionId);
    localStorage.setItem(_sessionKeys.sessionId, sessionId);
    localStorage.setItem(_sessionKeys.owner, _tabId);
  }

  function _storeSessionIdentity() {
    _storePendingSessionIdentity(trialSessionId);
    localStorage.setItem(_sessionKeys.participant, String(participantNumber));
  }

  function _clearSessionIdentity() {
    sessionStorage.removeItem(_tabKeys.sessionId);
    sessionStorage.removeItem(_tabKeys.jumpReload);
    if (localStorage.getItem(_sessionKeys.sessionId) === trialSessionId) {
      localStorage.removeItem(_sessionKeys.sessionId);
      localStorage.removeItem(_sessionKeys.participant);
      localStorage.removeItem(_sessionKeys.resumeTrial);
      localStorage.removeItem(_sessionKeys.jumpTrial);
      localStorage.removeItem(_sessionKeys.owner);
    }
  }

  ${loadingOverlayCode()}
`;
}
