import { UploadedFile } from "./useExperimentCode";
import { Trial, Loop } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import ExperimentBase from "./ExperimentBase";
import useDevMode from "../../../hooks/useDevMode";
import { loadingOverlayCode } from "./LoadingOverlay";
import { resumeCode } from "./ResumeCode";

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
}: Props) {
  const { isDevMode, code } = useDevMode();
  const { generatedBaseCode } = ExperimentBase({
    experimentID,
    uploadedFiles,
    getTrial,
    getLoopTimeline,
    getLoop,
  });
  const generateLocalExperiment = async () => {
    // Fetch extensions before generating experiment
    const extensions = await fetchExtensions();
    // Generate codes dynamically from trial/loop data
    const baseCode = isDevMode ? code : await generatedBaseCode();

    return `
  // --- Recolectar metadata del sistema ---
  const getMetadata = () => {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
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
    trialSessionId = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  } else {
    isResuming = true;
  }

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

    if (!existingJump) {
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
    
    _setLoadingMsg('Creating session\u2026');
    participantNumber = await saveSession(trialSessionId);

    // Si falla con el sessionId existente (sesión huérfana), reintentar con uno nuevo
    // IMPORTANTE: NO borrar jsPsych_resumeTrial aquí para no perder el punto de retoma
    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      localStorage.removeItem('jsPsych_currentSessionId');
      localStorage.removeItem('jsPsych_participantNumber');
      trialSessionId = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10);
      isResuming = false;
      participantNumber = await saveSession(trialSessionId);
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
