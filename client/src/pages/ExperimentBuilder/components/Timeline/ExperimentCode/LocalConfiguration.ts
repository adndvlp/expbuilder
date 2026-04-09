import { UploadedFile } from "./useExperimentCode";
import { Trial, Loop } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import ExperimentBase from "./ExperimentBase";
import useDevMode from "../../../hooks/useDevMode";
import { loadingOverlayCode } from "./LoadingOverlay";
import { resumeCode } from "./ResumeCode";
import { CanvasStyles } from "../../ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

type GetTrialFn = (id: string | number) => Promise<Trial | null>;
type GetLoopTimelineFn = (loopId: string | number) => Promise<TimelineItem[]>;
type GetLoopFn = (id: string | number) => Promise<Loop | null>;

type Props = {
  experimentID: string | undefined;
  evaluateCondition: string;
  fetchExtensions: () => Promise<string>;
  branchingEvaluation: string;
  uploadedFiles: UploadedFile[];
  getTrial: GetTrialFn;
  getLoopTimeline: GetLoopTimelineFn;
  getLoop: GetLoopFn;
  canvasStyles?: CanvasStyles;
};

export default function LocalConfiguration({
  experimentID,
  evaluateCondition,
  fetchExtensions,
  branchingEvaluation,
  uploadedFiles,
  getTrial,
  getLoopTimeline,
  getLoop,
  canvasStyles,
}: Props) {
  const { isDevMode, code } = useDevMode();
  const { generatedBaseCode } = ExperimentBase({
    experimentID,
    uploadedFiles,
    getTrial,
    getLoopTimeline,
    getLoop,
    canvasStyles,
  });
  const progressBar = canvasStyles?.progressBar ?? false;

  type _SessionNameToken = {
    id: string;
    type: string;
    dateFormat: string;
    timeFormat: string;
    randomLength: number;
    customValue: string;
    counterDigits: number;
  };

  const generateLocalExperiment = async () => {
    // Fetch extensions before generating experiment
    const extensions = await fetchExtensions();
    // Generate codes dynamically from trial/loop data
    const baseCode = isDevMode ? code : await generatedBaseCode();

    // Fetch session name config from local API
    let sessionNameTokens: _SessionNameToken[] = [];
    let sessionNameSeparator = "_";
    if (experimentID) {
      try {
        const snRes = await fetch(`/api/session-name-config/${experimentID}`);
        if (snRes.ok) {
          const sn = await snRes.json();
          sessionNameTokens = sn.tokens ?? [];
          sessionNameSeparator = sn.separator ?? "_";
        }
      } catch {
        // local server unavailable — fall back to UUID
      }
    }

    return `
  // --- FileUploadResponseComponent endpoint (local Express server) ---
  window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '/api/participant-files/${experimentID}';

  // --- Session Name Configuration ---
  const _SESSION_NAME_TOKENS = ${JSON.stringify(sessionNameTokens)};
  const _SESSION_NAME_SEPARATOR = ${JSON.stringify(sessionNameSeparator)};
  function _generateSessionName(participantNumber) {
    if (!_SESSION_NAME_TOKENS || _SESSION_NAME_TOKENS.length === 0) return null;
    const _now = new Date();
    const _pad = (n, len) => String(n).padStart(len != null ? len : 2, '0');
    const _y = _now.getFullYear();
    const _mo = _pad(_now.getMonth() + 1);
    const _d = _pad(_now.getDate());
    const _h = _pad(_now.getHours());
    const _mi = _pad(_now.getMinutes());
    const _s = _pad(_now.getSeconds());
    const _parts = _SESSION_NAME_TOKENS.map(function(_token) {
      switch (_token.type) {
        case 'date': {
          if (_token.dateFormat === 'YYYYMMDD') return _y + '' + _mo + _d;
          if (_token.dateFormat === 'DD-MM-YYYY') return _d + '-' + _mo + '-' + _y;
          if (_token.dateFormat === 'MM-DD-YYYY') return _mo + '-' + _d + '-' + _y;
          return _y + '-' + _mo + '-' + _d;
        }
        case 'time': {
          if (_token.timeFormat === 'HH-mm') return _h + '-' + _mi;
          if (_token.timeFormat === 'HHmmss') return _h + '' + _mi + _s;
          return _h + '-' + _mi + '-' + _s;
        }
        case 'randomAlpha': {
          const _chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          return Array.from({ length: _token.randomLength || 6 }, function() {
            return _chars[Math.floor(Math.random() * _chars.length)];
          }).join('');
        }
        case 'customText': return _token.customValue || '';
        case 'counter': {
          if (participantNumber == null) return '__CNT__';
          return _pad(participantNumber, _token.counterDigits || 3);
        }
        default: return '';
      }
    }).filter(function(p) { return p !== ''; });
    // Safety net: if no randomAlpha or counter token, append a 6-char random suffix for uniqueness
    const _hasUnique = _SESSION_NAME_TOKENS.some(function(t) { return t.type === 'randomAlpha' || t.type === 'counter'; });
    if (!_hasUnique && _parts.length > 0) {
      const _rc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      _parts.push(Array.from({ length: 6 }, function() { return _rc[Math.floor(Math.random() * _rc.length)]; }).join(''));
    }
    return _parts.length > 0 ? _parts.join(_SESSION_NAME_SEPARATOR) : null;
  }
  function _sessionNameHasDynamic() {
    return _SESSION_NAME_TOKENS.some(function(t) { return t.type === 'counter'; });
  }
  async function _renameSessionIfNeeded(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return oldId;
    try {
      const _r = await fetch('/api/rename-session/${experimentID}', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSessionId: oldId, newSessionId: newId })
      });
      if (_r.ok) return newId;
    } catch(e) {}
    return oldId;
  }

  // --- Recolectar metadata del sistema ---
  const getMetadata = () => {
    const ua = navigator.userAgent;    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    
    if (ua.indexOf('Firefox') > -1) {
      browserName = 'Firefox';
      browserVersion = ua.match(/Firefox\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('Chrome') > -1) {
      browserName = 'Chrome';
      browserVersion = ua.match(/Chrome\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('Safari') > -1) {
      browserName = 'Safari';
      browserVersion = ua.match(/Version\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('Edg') > -1) {
      browserName = 'Edge';
      browserVersion = ua.match(/Edg\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    }
    
    let osName = 'Unknown';
    if (ua.indexOf('Win') > -1) osName = 'Windows';
    else if (ua.indexOf('Mac') > -1) osName = 'macOS';
    else if (ua.indexOf('Linux') > -1) osName = 'Linux';
    else if (ua.indexOf('Android') > -1) osName = 'Android';
    else if (ua.indexOf('iOS') > -1) osName = 'iOS';
    
    return {
      browser: browserName,
      browserVersion: browserVersion,
      os: osName,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      screenResolution: \`\${window.screen.width}x\${window.screen.height}\`,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      language: navigator.language,
      userAgent: ua,
      startedAt: new Date().toISOString()
    };
  };
  
  const metadata = getMetadata();

  // --- Socket.IO para tracking en tiempo real ---
  const socketScript = document.createElement('script');
  socketScript.src = '/socket.io/socket.io.js';
  socketScript.onload = () => {
    window._socketReady = true;
  };
  document.head.appendChild(socketScript);

  function waitForSocket() {
    return new Promise(resolve => {
      if (window._socketReady) return resolve();
      const interval = setInterval(() => {
        if (window._socketReady) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  // Recuperar sessionId de localStorage o crear uno nuevo
  let trialSessionId = localStorage.getItem('jsPsych_currentSessionId');
  let isResuming = false;

  if (!trialSessionId) {
    trialSessionId = _generateSessionName(null) || (crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10));
  } else {
    isResuming = true;
  }

  // Setear JSPSYCH_SESSION_ID inmediatamente para que FileUpload tenga siempre el sessionId
  window.JSPSYCH_SESSION_ID = trialSessionId;

  let participantNumber;
  let socket;

  async function saveSession(trialSessionId) {
   
   const res = await fetch("/api/append-result/${experimentID}", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({
        sessionId: trialSessionId,
        metadata: metadata
      }),
    });
  
    const result = await res.json();
    participantNumber = result.participantNumber;
    return participantNumber;
    
  }

  ${loadingOverlayCode()}
  ${resumeCode()}

  (async () => {

    // Leer datos de retoma ANTES de cualquier limpieza
    const resumeRaw = localStorage.getItem('jsPsych_resumeTrial');
    const existingJump = localStorage.getItem('jsPsych_jumpToTrial');

    // Guard contra bucle infinito: si la última recarga fue un intento de jump
    // y el key sigue intacto (ningún trial lo consumió), borrar todo y empezar limpio.
    const comingFromJumpReload = sessionStorage.getItem('jsPsych_jumpReload') === '1';
    sessionStorage.removeItem('jsPsych_jumpReload');
    if (comingFromJumpReload && existingJump) {
      localStorage.removeItem('jsPsych_jumpToTrial');
      localStorage.removeItem('jsPsych_resumeTrial');
      localStorage.removeItem('jsPsych_currentSessionId');
      localStorage.removeItem('jsPsych_participantNumber');
      // Reinicar variables de sesión para que el experimento arranque limpio
      trialSessionId = _generateSessionName(null) || (crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10));
      isResuming = false;
    } else if (!existingJump) {
      // Sin jump pendiente: derivar destino desde el último trial completado
      localStorage.removeItem('jsPsych_jumpToTrial');
      const jumpTarget = _resolveResumeBranch(resumeRaw);
      localStorage.removeItem('jsPsych_resumeTrial');
      if (jumpTarget) localStorage.setItem('jsPsych_jumpToTrial', jumpTarget);
    } else {
      // Jump ya establecido por repeat/jump — preservarlo, solo limpiar resume
      localStorage.removeItem('jsPsych_resumeTrial');
    }

    // Esperar a que Socket.IO esté listo
    await waitForSocket();
    socket = io();
    
    if (isResuming) {
      // Sesión existente (retoma o repeat/jump): recuperar participantNumber del localStorage
      // para evitar crear una sesión duplicada en el backend
      const storedPN = localStorage.getItem('jsPsych_participantNumber');
      if (storedPN && !isNaN(Number(storedPN))) {
        participantNumber = Number(storedPN);
      } else {
        // Número de participante perdido — recrear sesión como nueva
        _setLoadingMsg('Creating session\u2026');
        participantNumber = await saveSession(trialSessionId);
      }
    } else {
      _setLoadingMsg('Creating session\u2026');
      participantNumber = await saveSession(trialSessionId);
      // Rename session once participantNumber is known (dynamic tokens: counter)
      if (_sessionNameHasDynamic() && typeof participantNumber === 'number' && !isNaN(participantNumber)) {
        const _finalId = _generateSessionName(participantNumber);
        if (_finalId && _finalId !== trialSessionId) {
          trialSessionId = await _renameSessionIfNeeded(trialSessionId, _finalId);
          window.JSPSYCH_SESSION_ID = trialSessionId;
        }
      }
    }

    // Si falla con el sessionId existente (sesión huérfana), reintentar con uno nuevo
    // IMPORTANTE: NO borrar jsPsych_resumeTrial aquí para no perder el punto de retoma
    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      localStorage.removeItem('jsPsych_currentSessionId');
      localStorage.removeItem('jsPsych_participantNumber');
      trialSessionId = _generateSessionName(null) || (crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10));
      isResuming = false;
      _setLoadingMsg('Creating session\u2026');
      participantNumber = await saveSession(trialSessionId);
      if (_sessionNameHasDynamic() && typeof participantNumber === 'number' && !isNaN(participantNumber)) {
        const _finalId = _generateSessionName(participantNumber);
        if (_finalId && _finalId !== trialSessionId) {
          trialSessionId = await _renameSessionIfNeeded(trialSessionId, _finalId);
        }
      }
    }

    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      alert("The participant number is not assigned. Please, wait.");
      throw new Error("participantNumber not assigned");
    }

    // Guardar sessionId en localStorage para futuras retomas
    localStorage.setItem('jsPsych_currentSessionId', trialSessionId);
    localStorage.setItem('jsPsych_participantNumber', participantNumber.toString());

    // Conectar sesión con el servidor via WebSocket
    socket.emit('join-experiment', {
      experimentID: '${experimentID}',
      sessionId: trialSessionId,
      state: isResuming ? 'resumed' : 'initiated',
      metadata: metadata
    });

    ${evaluateCondition}

    _hideLoading();

    // Track pending data saves to ensure all complete before finishing
    const pendingDataSaves = [];

    const jsPsych = initJsPsych({
          display_element: document.getElementById('jspsych-container'),
           ${progressBar ? `show_progress_bar: true,` : ""} 


    ${extensions}

    on_data_update: function (data) {
      // Create and track the promise for this data save
      const savePromise = fetch("/api/append-result/${experimentID}", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          sessionId: trialSessionId,
          response: data,
        }),
      })
      .then(res => {
        if (!res.ok) {
          console.error('Error saving trial data:', res.statusText);
        }
        return res;
      })
      .catch(error => {
        console.error('Error in on_data_update:', error);
      })
      .finally(() => {
        // Remove from pending once complete
        const index = pendingDataSaves.indexOf(savePromise);
        if (index > -1) {
          pendingDataSaves.splice(index, 1);
        }
      });
      
      pendingDataSaves.push(savePromise);

      // 🔄 SISTEMA DE RETOMA: Guardar branches + datos del trial para evaluar al reanudar
      if (data.builder_id !== undefined && data.builder_id !== null) {
        localStorage.setItem('jsPsych_resumeTrial', JSON.stringify({
          branches: data.branches || [],
          branchConditions: data.branchConditions || [],
          trialData: data
        }));
      }
      
      // Actualizar estado a 'in-progress' en la primera actualización
      if (data.trial_index === 0 && socket) {
        socket.emit('update-session-state', {
          experimentID: '${experimentID}',
          sessionId: trialSessionId,
          state: 'in-progress'
        });
      }
      
      ${branchingEvaluation}
    },

  on_finish: async function() {
    // Si hay un repeat/jump pendiente, recargar para ejecutarlo
    if (localStorage.getItem('jsPsych_jumpToTrial')) {
      if (pendingDataSaves.length > 0) await Promise.allSettled(pendingDataSaves);
      sessionStorage.setItem('jsPsych_jumpReload', '1');
      window.location.reload();
      return;
    }

    _showLoading('Saving your data\u2026');
    await new Promise(r => setTimeout(r, 0));

    // Limpiar datos de retoma ya que el experimento terminó correctamente
    localStorage.removeItem('jsPsych_resumeTrial');
    localStorage.removeItem('jsPsych_currentSessionId');
    localStorage.removeItem('jsPsych_participantNumber');

    // Wait for all pending data saves to complete
    if (pendingDataSaves.length > 0) {
      _setLoadingMsg('Uploading data\u2026');
      await Promise.allSettled(pendingDataSaves);
    }
    
    _setLoadingMsg('Finishing up\u2026');

    // Marcar como completado
    if (socket) {
      socket.emit('update-session-state', {
        experimentID: '${experimentID}',
        sessionId: trialSessionId,
        state: 'completed'
      });
    }
    
    await fetch("/api/complete-session/${experimentID}", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({
        sessionId: trialSessionId,
      }),
    });

    _showSuccess();
  }
});

${baseCode}

})();
`;
  };
  return { generateLocalExperiment };
}
