import type { LocalExperimentCodeOptions } from "./localCodeTypes";

export function buildLocalRuntimeStart({
  customPreInitCode,
  evaluateCondition,
  experimentID,
}: LocalExperimentCodeOptions): string {
  const id = experimentID ?? "";
  const preInit = customPreInitCode.local?.trim();
  return `
  (async function() {
    const candidate = await _selectSessionCandidate();
    const resumeRaw = localStorage.getItem(_sessionKeys.resumeTrial);
    const existingJump = localStorage.getItem(_sessionKeys.jumpTrial);
    const comingFromJumpReload = sessionStorage.getItem(_tabKeys.jumpReload) === '1';
    sessionStorage.removeItem(_tabKeys.jumpReload);

    let persisted = await _findPersistedSession(candidate);
    if (candidate && persisted.status === 'unavailable') {
      throw new Error('The existing session could not be verified');
    }
    if (candidate && persisted.status === 'valid' && persisted.session.state !== 'completed') {
      trialSessionId = candidate;
      isResuming = true;
      participantNumber = persisted.session.participantNumber;
    } else {
      _claimedSessionId = null;
      trialSessionId = _newId();
      isResuming = false;
      _storePendingSessionIdentity(trialSessionId);
      participantNumber = await saveSession(trialSessionId);
      persisted = { status: 'valid', session: null };
    }

    const persistedEventCount = isResuming && Number.isInteger(persisted.session.storedEventCount)
      ? persisted.session.storedEventCount
      : 0;
    if (
      isResuming &&
      (persisted.session.sequenceTracked !== true ||
        !Number.isInteger(persisted.session.lastSequence) ||
        persisted.session.lastSequence !== persistedEventCount - 1)
    ) {
      throw new Error('The existing session has inconsistent saved results');
    }

    if (!Number.isInteger(participantNumber) || participantNumber < 1) {
      throw new Error('The server did not assign a valid participant number');
    }

    window.JSPSYCH_SESSION_ID = trialSessionId;
    _storeSessionIdentity();
    if (!isResuming) {
      await _setSessionDisplayName(
        trialSessionId,
        _generateSessionName(participantNumber)
      );
    }

    if (comingFromJumpReload && existingJump) {
      localStorage.removeItem(_sessionKeys.jumpTrial);
      localStorage.removeItem(_sessionKeys.resumeTrial);
    } else if (isResuming && resumeRaw && !existingJump) {
      const resumeRouteDecision = _resolveResumeBranch(resumeRaw);
      if (resumeRouteDecision !== null) {
        localStorage.setItem(_sessionKeys.jumpTrial, resumeRouteDecision);
        sessionStorage.setItem(_tabKeys.jumpReload, '1');
        window.branchCustomParameters =
          resumeRouteDecision.customParameters ?? null;
      }
    }

    const _jumpStartup =
      window.ExpBuilderNavigation.consumeReloadMarker();

    const socketReady = await waitForSocket(5000);
    if (socketReady) {
      try {
        socket = window.io();
        await _emitPresence('join-experiment', {
          experimentID: ${JSON.stringify(id)},
          sessionId: trialSessionId,
          state: isResuming ? 'resumed' : 'initiated',
          metadata: metadata
        });
      } catch (_error) {
        socket = null;
      }
    }

    ${evaluateCondition}

    const localOutbox = _createLocalOutbox(${JSON.stringify(id)}, trialSessionId);
    await localOutbox.initialize(persistedEventCount);
    void localOutbox.flush().catch(function(error) {
      console.warn('[session-persistence] recovered results remain pending', {
        experimentID: ${JSON.stringify(id)},
        sessionId: trialSessionId,
        error: error.message
      });
    });
    _hideLoading();

    document.querySelectorAll('.jspsych-content-wrapper').forEach(function(element) {
      element.remove();
    });

    ${preInit ? `// --- User code (before initJsPsych) ---\n    ${preInit}\n\n    ` : ""}// __INIT_JSPSYCH_START__
`;
}
