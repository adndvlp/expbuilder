import { UploadedFile } from "./useExperimentCode";

type Props = {
  experimentID: string | undefined;
  evaluateCondition: string;
  extensions: string;
  branchingEvaluation: string;
  uploadedFiles: UploadedFile[];
};

export default function LocalExperiment({
  experimentID,
  evaluateCondition,
  extensions,
  branchingEvaluation,
  uploadedFiles,
}: Props) {
  const generateLocalExperiment = async () => {
    // Generate codes dynamically from trial/loop data
    let allCodes = "";
    try {
      const { generateAllCodes } = await import(
        "../../../utils/generateTrialLoopCodes"
      );
      const codes = await generateAllCodes(experimentID || "", uploadedFiles);
      allCodes = codes.join("\n\n");
    } catch (error) {
      console.error("Error generating codes:", error);
    }

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

  const trialSessionId =
    (crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10));

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

  (async () => {

    localStorage.removeItem('jsPsych_jumpToTrial');
    
    // Esperar a que Socket.IO esté listo
    await waitForSocket();
    socket = io();
    
    participantNumber = await saveSession(trialSessionId);

    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      alert("The participant number is not assigned. Please, wait.");
      throw new Error("participantNumber not assigned");
    }

    // Conectar sesión con el servidor via WebSocket
    socket.emit('join-experiment', {
      experimentID: '${experimentID}',
      sessionId: trialSessionId,
      state: 'initiated',
      metadata: metadata
    });

    ${evaluateCondition}

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
    // Wait for all pending data saves to complete
    if (pendingDataSaves.length > 0) {
      console.log('Waiting for', pendingDataSaves.length, 'pending data saves to complete...');
      await Promise.allSettled(pendingDataSaves);
      console.log('All data saves completed');
    }
    
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
    // jsPsych.data.displayData();
  }
});

const timeline = [];

// Global preload for all uploaded files from Timeline
${
  uploadedFiles.length > 0
    ? `
const globalPreload = {
  type: jsPsychPreload,
  files: ${JSON.stringify(uploadedFiles.filter((f) => f && f.url).map((f) => f.url))}
};
timeline.push(globalPreload);
`
    : ""
}

${allCodes}

jsPsych.run(timeline);

})();
`;
  };
  return { generateLocalExperiment };
}
