import { useEffect, useMemo, useState } from "react";
import {
  fetchExperimentNameByID,
  useExperimentID,
} from "../../hooks/useExperimentID";
import useTrials from "../../hooks/useTrials";
import { Trial } from "../ConfigPanel/types";
import { useExperimentStorage } from "../../hooks/useStorage";

const DATA_API_URL = import.meta.env.VITE_DATA_API_URL;

interface UploadedFile {
  url?: string;
  name?: string;
  type?: string;
}

export function useExperimentCode(uploadedFiles: UploadedFile[] = []) {
  const [experimentName, setExperimentName] = useState("Experiment");

  const experimentID = useExperimentID();

  const { trials } = useTrials();

  // Obtén el storage desde el hook, pero si está undefined, usa el valor cacheado en localStorage
  let storage = useExperimentStorage(experimentID ?? "");
  if (!storage && experimentID) {
    try {
      const cached = localStorage.getItem(`experiment_storage_${experimentID}`);
      if (cached) storage = cached;
    } catch (e) {
      // Ignorar errores de localStorage
    }
  }

  useEffect(() => {
    if (experimentID) {
      fetchExperimentNameByID(experimentID).then(setExperimentName);
    }
  }, [experimentID]);

  function isTrial(trial: any): trial is Trial {
    return "parameters" in trial;
  }

  const allCodes = trials
    .map((item) => {
      if ("parameters" in item) return item.trialCode;
      if ("trials" in item) return item.code;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

  const extensions = useMemo(() => {
    // Solo incluir extensiones si includesExtensions es true
    const rawExtensionsChain: string[] = [];
    trials.forEach((trial) => {
      if (isTrial(trial) && trial.parameters?.includesExtensions) {
        if (trial.parameters?.extensionType) {
          rawExtensionsChain.push(trial.parameters.extensionType);
        }
      }
    });

    const uniqueExtensions = [
      ...new Set(rawExtensionsChain.filter((val) => val !== "")),
    ];

    if (uniqueExtensions.length > 0) {
      const extensionsArrayStr = uniqueExtensions
        .map((e) => `{type: ${e}}`)
        .join(",");
      return `extensions: [${extensionsArrayStr}],`;
    }
    return "";
  }, [trials]);

  const evaluateCondition = `// --- Branching logic functions (outside initJsPsych for timeline access) ---
    window.nextTrialId = null;
    window.skipRemaining = false;
    window.branchingActive = false;
    window.branchCustomParameters = null; // Store custom parameters for the next trial

    const evaluateCondition = (trialData, condition) => {
      // All rules in a condition must be true (AND logic)
      return condition.rules.every(rule => {
        let propValue;
        
        // For dynamic plugins, handle nested structure
        if (rule.fieldType && rule.componentIdx !== undefined && rule.componentIdx !== "") {
          // Dynamic plugin structure: fieldType -> componentIdx -> prop
          // Note: response_components in the builder becomes "response" in the actual trial data
          const actualFieldName = rule.fieldType === 'response_components' ? 'response' : rule.fieldType;
          const fieldArray = trialData[actualFieldName];
          if (!Array.isArray(fieldArray)) {
            console.warn('Field array not found for fieldType:', rule.fieldType, 'actual field:', actualFieldName);
            return false;
          }
          
          // componentIdx is the component name, not a numeric index
          const component = fieldArray.find(c => c.name === rule.componentIdx);
          if (!component) {
            console.warn('Component not found with name:', rule.componentIdx);
            return false;
          }
          
          // Get the property value from the component
          // For SurveyComponent, the response structure is different
          // The prop is actually a question name inside component.response
          if (component.type === "SurveyComponent" && component.response && typeof component.response === 'object') {
            // The prop (e.g., "question1") is a key inside component.response
            if (component.response[rule.prop] !== undefined) {
              propValue = component.response[rule.prop];
            } else {
              return false;
            }
          } else {
            // For other components, check direct properties
            if (rule.prop === "response" && component.response !== undefined) {
              propValue = component.response;
            } else if (component[rule.prop] !== undefined) {
              propValue = component[rule.prop];
            } else {
              return false;
            }
          }
        } else {
          // Normal plugin structure
          propValue = trialData[rule.prop];
        }
        
        const compareValue = rule.value;
        
        // Handle array responses (multi-select or single-select returned as array)
        if (Array.isArray(propValue)) {
          const matches = propValue.includes(compareValue) || propValue.includes(String(compareValue));
          switch (rule.op) {
            case '==':
              return matches;
            case '!=':
              return !matches;
            default:
              return false;
          }
        }
        
        // Convert values for comparison (for non-array values)
        const numPropValue = parseFloat(propValue);
        const numCompareValue = parseFloat(compareValue);
        const isNumeric = !isNaN(numPropValue) && !isNaN(numCompareValue);
        
        switch (rule.op) {
          case '==':
            return isNumeric ? numPropValue === numCompareValue : propValue == compareValue;
          case '!=':
            return isNumeric ? numPropValue !== numCompareValue : propValue != compareValue;
          case '>':
            return isNumeric && numPropValue > numCompareValue;
          case '<':
            return isNumeric && numPropValue < numCompareValue;
          case '>=':
            return isNumeric && numPropValue >= numCompareValue;
          case '<=':
            return isNumeric && numPropValue <= numCompareValue;
          default:
            return false;
        }
      });
    };
    
    const getNextTrialId = (lastTrialData) => {
      if (!lastTrialData || !lastTrialData.trials || !lastTrialData.trials[0]) {
        return null;
      }
      
      const trial = lastTrialData.trials[0];
      
      // Check if trial/loop has branches
      if (!Array.isArray(trial.branches) || trial.branches.length === 0) {
        return null;
      }
      
      // Check if there are conditions to evaluate
      const hasBranchConditions = Array.isArray(trial.branchConditions) && trial.branchConditions.length > 0;
      
      // Check if any condition has customParameters
      const hasCustomParameters = hasBranchConditions && 
        trial.branchConditions.flat().some(condition => 
          condition && condition.customParameters && 
          Object.keys(condition.customParameters).length > 0
        );
      
      // If there are no conditions AND no custom parameters, auto-branch to first branch
      if (!hasBranchConditions && !hasCustomParameters) {
        console.log('No conditions or custom parameters defined, auto-branching to first branch:', trial.branches[0]);
        return trial.branches[0];
      }
      
      // If there are no conditions but there ARE custom parameters, we can't auto-branch
      // We need to evaluate conditions to know which customParameters to use
      if (!hasBranchConditions && hasCustomParameters) {
        console.log('Custom parameters exist but no conditions, cannot auto-branch');
        return null;
      }
      
      // If there ARE conditions, evaluate them (regardless of how many branches there are)
      // branchConditions is an array of arrays, flatten it first
      const conditions = trial.branchConditions.flat();
      
      // Evaluate each condition (OR logic between conditions)
      for (const condition of conditions) {
        if (!condition || !condition.rules) {
          console.warn('Invalid condition structure:', condition);
          continue;
        }
        
        if (evaluateCondition(trial, condition)) {
          // Store custom parameters if they exist
          if (condition.customParameters) {
            window.branchCustomParameters = condition.customParameters;
          }
          return condition.nextTrialId;
        }
      }
      
      // No condition matched - do NOT branch (conditions were defined but none matched)
      return null;
    };`;

  const branchingEvaluation = `// Solo evaluar branching si el trial/loop tiene un trial_id o loop_id válido
      if ((!data.trial_id || data.trial_id === undefined) && (!data.loop_id || data.loop_id === undefined)) {
        return;
      }
      
      const lastTrialData = jsPsych.data.getLastTrialData();
      const trial = lastTrialData.trials ? lastTrialData.trials[0] : null;
      
      // Verificar si este trial/loop tiene branches
      if (!trial || !trial.branches || trial.branches.length === 0) {
        return; // No tiene branches, no hay nada que hacer
      }
      
      // IMPORTANTE: Si el trial está dentro de un loop (isInLoop = true),
      // NO activar el branching global. Los trials dentro de loops usan su propio
      // sistema de branching con variables locales (loopNextTrialId, etc.)
      if (trial.isInLoop === true) {
        return;
      }
      
      const nextTrialId = getNextTrialId(lastTrialData);
      
      if (nextTrialId) {
        // Check if nextTrialId is "FINISH_EXPERIMENT"
        if (nextTrialId === 'FINISH_EXPERIMENT') {
          jsPsych.abortExperiment('Experiment finished by branching condition', {});
          return;
        }
        
        window.nextTrialId = nextTrialId;
        window.skipRemaining = true;
        window.branchingActive = true;
      }`;

  const generateLocalExperiment = () => {
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
    jsPsych.data.displayData();
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

  const generateExperiment = () => {
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
  return { generateLocalExperiment, generateExperiment };
}
