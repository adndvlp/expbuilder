import { PublicExperimentCodeOptions } from "./publicCodeTypes";
import {
  activateResumeRouteDecisionCode,
  resumeJumpStartupCode,
} from "./resumeJumpStartupCode";

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
  return `
  (async () => {
    // --- CAPTCHA gate (hCaptcha / reCAPTCHA) ---
    // Se omite en recargas por jump (sessionStorage persiste entre reloads del mismo tab)
    if (${captchaConfig.enabled} && "${captchaConfig.siteKey}" && !sessionStorage.getItem('jsPsych_captchaPassed')) {
      const _loadingEl = document.getElementById('jspsych-loading-overlay');
      if (_loadingEl) _loadingEl.style.display = 'none';
      await _showCaptchaGate("${captchaConfig.siteKey}", "${captchaConfig.provider}");
      sessionStorage.setItem('jsPsych_captchaPassed', '1');
      if (_loadingEl) _loadingEl.style.display = 'flex';
      _setLoadingMsg('Creating session\u2026');
    }

${resumeJumpStartupCode()}
    
    // --- Configuración de Batching (cargada desde Firestore) ---
    const BATCH_CONFIG = {
      size: ${batchConfig.batchSize},
      currentBatchNumber: 0,
      resumeTimeoutMinutes: ${batchConfig.resumeTimeoutMinutes},
      useIndexedDB: ${batchConfig.useIndexedDB}
    };

    // Inicializar IndexedDB solo si está habilitado
    if (BATCH_CONFIG.useIndexedDB) {
      await TrialDB.init();
    }
    
    // Verificar si hay una sesión pendiente (para retoma)
    let resumedSession = false;
    
    if (BATCH_CONFIG.useIndexedDB) {
      const existingTrials = await TrialDB.getAll();
      
      if (existingTrials.length > 0) {
        const lastTrial = existingTrials[existingTrials.length - 1];
        
        if (lastTrial.sessionId === trialSessionId) {
          BATCH_CONFIG.currentBatchNumber = Math.floor(existingTrials.length / (BATCH_CONFIG.size || 1));
          resumedSession = true;
        } else {
          await TrialDB.clear();
        }
      }
    }
    
    // SIEMPRE llamar a createSession (para crear documento en Firestore)
    // El backend maneja sesiones duplicadas (409) y las retorna correctamente
    _setLoadingMsg('Creating session…');
    participantNumber = await createSession();

    // If session name has counter token, generate final name now that participantNumber is known
    if (_sessionNameHasDynamic() && typeof participantNumber === 'number' && !isNaN(participantNumber)) {
      const _finalName = _generateSessionName(participantNumber);
      if (_finalName) {
        // Session IDs are durable identities. The generated name is display metadata.
        _updateSessionName(trialSessionId, _finalName);
      }
    }

    // Guardar sessionId y participantNumber en localStorage para futuras retomas
    localStorage.setItem('jsPsych_currentSessionId', trialSessionId);
    localStorage.setItem('jsPsych_participantNumber', participantNumber.toString());

    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      alert("The participant number is not assigned. Please, wait.");
      throw new Error("participantNumber not assigned");
    }
    
    // Esperar e inicializar Firebase
    _setLoadingMsg('Loading resources…');
    await waitForFirebase();
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }
    const db = window.firebase.database();

    // --- Configurar onDisconnect para finalizar sesión automáticamente ---
    const sessionRef = db.ref('sessions/${experimentID}/' + trialSessionId);
    await sessionRef.set({
      connected: true,
      experimentID: '${experimentID}',
      sessionId: trialSessionId,
      participantNumber: participantNumber,
      startedAt: window.firebase.database.ServerValue.TIMESTAMP,
      storage: '${useStorage}',
      storageProvider: '${useStorage}',
      state: resumedSession ? 'resumed' : 'initiated',
      lastUpdate: window.firebase.database.ServerValue.TIMESTAMP,
      metadata: metadata,
      resumeTimeoutMinutes: BATCH_CONFIG.resumeTimeoutMinutes,
      useIndexedDB: BATCH_CONFIG.useIndexedDB
    });
    
    sessionRef.onDisconnect().update({
      connected: false,
      state: 'disconnected',
      disconnectedAt: window.firebase.database.ServerValue.TIMESTAMP,
      storage: '${useStorage}'
    });

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
