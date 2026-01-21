import { UploadedFile } from "./useExperimentCode";
const DATA_API_URL = import.meta.env.VITE_DATA_API_URL;

type Props = {
  experimentID: string | undefined;
  evaluateCondition: string;
  extensions: string;
  branchingEvaluation: string;
  uploadedFiles: UploadedFile[];
  experimentName: string;
  storage: string | undefined;
};

export default function PublicExperiment({
  experimentID,
  evaluateCondition,
  extensions,
  branchingEvaluation,
  uploadedFiles,
  experimentName,
  storage,
}: Props) {
  const generateExperiment = async () => {
    // Fetch codes from endpoint
    let allCodes = "";
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/timeline-code/${experimentID}`,
      );
      const data = await response.json();
      allCodes = data.codes.join("\n\n");
    } catch (error) {
      console.error("Error loading codes:", error);
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

  // --- Firebase config ---
  const firebaseConfig = {
    apiKey: "${import.meta.env.VITE_FIREBASE_API_KEY}",
    authDomain: "${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}",
    databaseURL: "${import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://" + import.meta.env.VITE_FIREBASE_PROJECT_ID + ".firebaseio.com"}",
    projectId: "${import.meta.env.VITE_FIREBASE_PROJECT_ID}",
    storageBucket: "${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID}",
    appId: "${import.meta.env.VITE_FIREBASE_APP_ID}"
  };

  // --- Cargar Firebase SDK ---
  if (typeof window.firebase === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
    script.onload = () => {
      const dbScript = document.createElement('script');
      dbScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js';
      dbScript.onload = () => { window._firebaseReady = true; };
      document.head.appendChild(dbScript);
    };
    document.head.appendChild(script);
  } else {
    window._firebaseReady = true;
  }

  function waitForFirebase() {
    return new Promise(resolve => {
      if (window._firebaseReady) return resolve();
      const interval = setInterval(() => {
        if (window._firebaseReady) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

 
  const userStr = ${window.localStorage.getItem("user")};

  const Uid = userStr.uid

  const trialSessionId =
    "online_" + (crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10));

  let participantNumber;

  async function saveSession(trialSessionId) {
    try {
      const res = await fetch("${DATA_API_URL}", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: "${experimentID}",
          experimentName: "${experimentName}", 
          sessionId: trialSessionId,
          storage: "${storage}",
          uid: Uid
        }),
      });
      
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error creating session:', errorText);
        throw new Error(\`Failed to create session: \${res.status} - \${errorText}\`);
      }
      
      const result = await res.json();
      console.log('Session created successfully:', result);
      
      if (!result.success) {
        if (result.message?.includes("INVALID_GOOGLE_DRIVE_TOKEN") || result.message?.includes("Invalid Google Drive token")) {
          alert("Warning: Google Drive token not found or invalid. Please reconnect your Drive account in Settings.");
        } else if (result.message?.includes("INVALID_DROPBOX_TOKEN") || result.message?.includes("Invalid Dropbox token")) {
          alert("Warning: Dropbox token not found or invalid. Please reconnect your Dropbox account in Settings.");
        }
        throw new Error(result.message || 'Failed to create session');
      }
      
      participantNumber = result.participantNumber;
      return participantNumber;
    } catch (error) {
      console.error('Error in saveSession:', error);
      alert('Error creating session: ' + error.message);
      throw error;
    }
  }

  (async () => {
    // Limpiar el localStorage de valores de sesiones anteriores
    localStorage.removeItem('jsPsych_jumpToTrial');
    
    // Esperar e inicializar Firebase
    await waitForFirebase();
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }
    const db = window.firebase.database();

    participantNumber = await saveSession(trialSessionId);

    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      alert("The participant number is not assigned. Please, wait.");
      throw new Error("participantNumber not assigned");
    }

    // --- Configurar onDisconnect para finalizar sesión automáticamente ---
    const sessionRef = db.ref('sessions/${experimentID}/' + trialSessionId);
    await sessionRef.set({
      connected: true,
      experimentID: '${experimentID}',
      sessionId: trialSessionId,
      startedAt: window.firebase.database.ServerValue.TIMESTAMP,
      storage: '${storage}',
      state: 'initiated',
      lastUpdate: window.firebase.database.ServerValue.TIMESTAMP,
      metadata: metadata
    });
    
    // Guardar metadata en db.json local también (para persistencia)
    fetch('/api/save-online-session-metadata/${experimentID}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: trialSessionId,
        metadata: metadata,
        state: 'initiated'
      })
    }).catch(err => console.warn('Could not save metadata to local db:', err));
    
    // Cuando se desconecte sin completar, marcar como abandoned
    // Incluir needsFinalization para que se procesen los datos en caso de desconexión
    sessionRef.onDisconnect().update({
      connected: false,
      needsFinalization: true,
      state: 'abandoned',
      disconnectedAt: window.firebase.database.ServerValue.TIMESTAMP,
      storage: '${storage}'
    });

    ${evaluateCondition}

    // Track pending data saves to ensure all complete before finishing
    const pendingDataSaves = [];

    const jsPsych = initJsPsych({
      display_element: document.getElementById('jspsych-container'),

      on_trial_start: function(trial) {
        const lastTrialData = jsPsych.data.get()
        if (lastTrialData && trial.data) {
        trial.data.prev_response = lastTrialData.response;
        }
      },

      ${extensions}

      on_data_update: function (data) {

        // Actualizar estado a 'in-progress' en la primera actualización
        if (data.trial_index === 0) {
          sessionRef.update({
            state: 'in-progress',
            lastUpdate: window.firebase.database.ServerValue.TIMESTAMP
          }).catch(err => console.error('Error updating state:', err));
          
          // Actualizar también en db.json local
          fetch('/api/save-online-session-metadata/${experimentID}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: trialSessionId,
              state: 'in-progress'
            })
          }).catch(err => console.warn('Could not update state in local db:', err));
        }

        // Create and track the promise for this data save
        const savePromise = fetch("${DATA_API_URL}", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "*/*" },
          body: JSON.stringify({
            experimentID: "${experimentID}",
            sessionId: trialSessionId,
            data: data,
            storage: "${storage}",
          }),
        })
        .then(res => {
          if (!res.ok) {
            return res.text().then(text => {
              console.error('Error appending data:', text);
            });
          }
          return res.json();
        })
        .then(result => {
          if (result && result.success) {
            console.log('Data appended to temporary storage');
          }
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

        ${branchingEvaluation}
      },

      on_finish: async function() {
        
        // Wait for all pending data saves to complete
        if (pendingDataSaves.length > 0) {
          console.log('Waiting for', pendingDataSaves.length, 'pending data saves to complete...');
          await Promise.allSettled(pendingDataSaves);
          console.log('All data saves completed');
        }
        
        // Cancelar el onDisconnect para evitar que marque como abandoned
        sessionRef.onDisconnect().cancel();

        // Finalizar la sesión normalmente y marcar en Firebase que terminó correctamente
        console.log('Experiment finished normally, sending data to storage...');
        
        try {
          
          // Marcar en Firebase que terminó correctamente Y necesita finalización
          await sessionRef.update({
            connected: false,
            finished: true,
            needsFinalization: true,
            state: 'completed',
            finishedAt: window.firebase.database.ServerValue.TIMESTAMP,
            lastUpdate: window.firebase.database.ServerValue.TIMESTAMP
          });
          
          // Guardar estado completado en db.json local (persistencia)
          await fetch('/api/save-online-session-metadata/${experimentID}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: trialSessionId,
              state: 'completed'
            })
          }).catch(err => console.warn('Could not update completed state in local db:', err));
          
          // El backend procesará la finalización al detectar needsFinalization=true
          console.log('Session marked for finalization in Firebase');
        } catch (error) {
          console.error('Error marking session as finished:', error);
        }
      },
  // Uncomment to see the json results after finishing a session experiment
  // jsPsych.data.displayData('csv');
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
  return { generateExperiment };
}
