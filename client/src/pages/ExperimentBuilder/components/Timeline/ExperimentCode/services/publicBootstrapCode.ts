import { publicRecoveryCode } from "./publicRecoveryCode";
import { publicPresenceCode } from "./publicPresenceCode";
import { PublicExperimentCodeOptions } from "./publicCodeTypes";
import {
  activateResumeRouteDecisionCode,
  resumeStartupCode,
} from "./resumeStartupCode";
import { getPublicRuntimeStorageKeys } from "./publicRuntimeStorageKeys";

export function publicBootstrapCode(
  options: PublicExperimentCodeOptions,
): string {
  const {
    DATA_API_URL,
    FIREBASE_DATABASE_URL,
    experimentID,
    useStorage,
    batchConfig,
    recruitmentConfig,
    captchaConfig,
    sessionNameTokens,
    sessionNameSeparator,
    currentUid,
    evaluateCondition,
    branchingEvaluation,
    customPreInitCode,
    publicParams,
    extensions,
    progressBar,
    baseCode,
  } = options;
  void [
    DATA_API_URL,
    FIREBASE_DATABASE_URL,
    experimentID,
    useStorage,
    batchConfig,
    recruitmentConfig,
    captchaConfig,
    sessionNameTokens,
    sessionNameSeparator,
    currentUid,
    evaluateCondition,
    branchingEvaluation,
    customPreInitCode,
    publicParams,
    extensions,
    progressBar,
    baseCode,
  ];
  const storageKeys = getPublicRuntimeStorageKeys(experimentID);
  return `
  (async () => {
    _setLoadingMsg('Creating session…');
    let _publicSessionState = await createSession();
    if (_publicSessionState.decision === 'revision_mismatch') {
      if (!_publicSessionState.artifactUrl) throw new Error('The original publication is unavailable. Your pending responses are preserved.');
      const destination = _publicArtifactLocation(_publicSessionState);
      destination.search = window.location.search; destination.hash = window.location.hash;
      window.location.replace(destination.href); return;
    }
    if (_publicSessionState.decision && !['resume_allowed', 'session_expired', 'session_completed'].includes(_publicSessionState.decision)) {
      throw new Error('Session cannot resume: ' + _publicSessionState.decision + '. Your pending responses are preserved.');
    }
    const effectiveBatch = _publicSessionState.configuration?.batchConfig || ${JSON.stringify(batchConfig)};
    const BATCH_CONFIG = { size: effectiveBatch.batchSize, useIndexedDB: effectiveBatch.useIndexedDB,
      resumeTimeoutMinutes: effectiveBatch.resumeTimeoutMinutes, currentBatchNumber: 0 };
    // Esperar e inicializar Firebase
    _setLoadingMsg('Loading resources…');
    await waitForFirebase();
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }
    const db = window.firebase.database();

${publicRecoveryCode(options)}
${publicPresenceCode(options)}
    if (_publicSessionState.sessionProtocolVersion === 3) await _connectPublicSession();


    const effectiveCaptcha = _publicSessionState.configuration?.captchaConfig || ${JSON.stringify(captchaConfig)};
    if (!['completed', 'expired'].includes(_publicSessionState.lifecycle) && effectiveCaptcha.enabled && effectiveCaptcha.siteKey
        && !sessionStorage.getItem(_publicStorageKeys.captchaPassed)) {
      const loading = document.getElementById('jspsych-loading-overlay');
      if (loading) loading.style.display = 'none';
      await _showCaptchaGate(effectiveCaptcha.siteKey, effectiveCaptcha.provider);
      sessionStorage.setItem(_publicStorageKeys.captchaPassed, '1');
      if (loading) loading.style.display = 'flex';
    }
    if (BATCH_CONFIG.useIndexedDB) await TrialDB.init();
    participantNumber = _publicSessionState.participantNumber;
    if (typeof participantNumber !== 'number' || !Number.isFinite(participantNumber)) {
      throw new Error('participantNumber not assigned');
    }
    if (BATCH_CONFIG.useIndexedDB) await TrialDB.syncManifest(_publicSessionState.receivedEvents || []);
    const _savedLocalState = BATCH_CONFIG.useIndexedDB ? await TrialDB.getState() : null;
    const _serverSequence = _publicSessionState.resumeCheckpointSequence ?? -1;
    const _backedCheckpoint = _savedLocalState?.checkpoint && (_savedLocalState.checkpointSequence ?? -1) >= _serverSequence
      ? _savedLocalState.checkpoint : _publicSessionState.resumeCheckpoint;
    let _cachedCheckpoint = null;
    try { _cachedCheckpoint = JSON.parse(localStorage.getItem(_publicStorageKeys.resumeTrial) || 'null'); } catch (_) {}
    const _canKeepStartCursor = _backedCheckpoint && _cachedCheckpoint
      && _canonicalPublicEvent(_cachedCheckpoint.completed) === _canonicalPublicEvent(_backedCheckpoint.completed);
    if (['completed', 'expired'].includes(_publicSessionState.lifecycle) || !_backedCheckpoint) {
      localStorage.removeItem(_publicStorageKeys.resumeTrial);
    } else if (!_canKeepStartCursor) {
      localStorage.setItem(_publicStorageKeys.resumeTrial, JSON.stringify(_backedCheckpoint));
    }
${resumeStartupCode(storageKeys.resumeTrial)}

    // If session name has counter token, generate final name now that participantNumber is known
    if (_sessionNameHasDynamic() && typeof participantNumber === 'number' && !isNaN(participantNumber)) {
      const _finalName = _generateSessionName(participantNumber);
      if (_finalName) {
        // Session IDs are durable identities. The generated name is display metadata.
        _updateSessionName(trialSessionId, _finalName);
      }
    }

    // Guardar sessionId y participantNumber en localStorage para futuras retomas
    localStorage.setItem(_publicStorageKeys.sessionId, trialSessionId);
    localStorage.setItem(_publicStorageKeys.participant, participantNumber.toString());

    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      alert("The participant number is not assigned. Please, wait.");
      throw new Error("participantNumber not assigned");
    }
    
    ${evaluateCondition}
${activateResumeRouteDecisionCode()}

    _hideLoading();

    // --- Recruitment platform URL params (using URLSearchParams - available before initJsPsych) ---
    const _urlParams = new URLSearchParams(window.location.search);
    const _prolificPID = _urlParams.get('PROLIFIC_PID');
    const _prolificStudyID = _urlParams.get('STUDY_ID');
    const _prolificSessionID = _urlParams.get('SESSION_ID');
    const _mturkWorkerID = _urlParams.get('workerId');
    const _mturkAssignmentID = _urlParams.get('assignmentId');
    const _mturkHitID = _urlParams.get('hitId');
    const _mturkTurkSubmitTo = _urlParams.get('turkSubmitTo');
    const _mturkIsPreview = _mturkAssignmentID === 'ASSIGNMENT_ID_NOT_AVAILABLE';

    ${
      recruitmentConfig.platform === "mturk"
        ? `
    // MTurk preview mode: block experiment from starting
    if (_mturkIsPreview) {
      document.getElementById('jspsych-container').innerHTML =
        '<div style="padding:40px;text-align:center;font-family:sans-serif">' +
        '<h2>Preview</h2>' +
        '<p>Accept the HIT to start the experiment.</p>' +
        '</div>';
      return;
    }
    `
        : ""
    }
`;
}
