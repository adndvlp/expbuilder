import { useEffect, useMemo, useState } from "react";
import {
  fetchExperimentNameByID,
  useExperimentID,
} from "../../hooks/useExperimentID";
import useTrials from "../../hooks/useTrials";
import { Trial } from "../ConfigPanel/types";
import { useExperimentStorage } from "../../hooks/useStorage";

const DATA_API_URL = import.meta.env.VITE_DATA_API_URL;

export function useExperimentCode() {
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
        const propValue = trialData[rule.prop];
        const compareValue = rule.value;
        
        // Convert values for comparison
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
          console.log('Condition matched:', condition);
          // Store custom parameters if they exist
          if (condition.customParameters) {
            window.branchCustomParameters = condition.customParameters;
            console.log('Custom parameters for branch:', window.branchCustomParameters);
          }
          return condition.nextTrialId;
        }
      }
      
      // No condition matched - do NOT branch (conditions were defined but none matched)
      console.log('No condition matched, NOT branching');
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
        console.log('Trial inside loop detected, skipping global branching');
        return;
      }
      
      console.log('Trial/Loop data:', lastTrialData);
      
      const nextTrialId = getNextTrialId(lastTrialData);
      console.log('Next trial/loop ID:', nextTrialId);
      
      if (nextTrialId) {
        // Check if nextTrialId is "FINISH_EXPERIMENT"
        if (nextTrialId === 'FINISH_EXPERIMENT') {
          console.log('Finish experiment requested');
          jsPsych.abortExperiment('Experiment finished by branching condition', {});
          return;
        }
        
        window.nextTrialId = nextTrialId;
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Branching activated: skip to trial/loop', nextTrialId);
      }`;

  const generateLocalExperiment = () => {
    return `
  const trialSessionId =
    (crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10));

  let participantNumber;

  async function saveSession(trialSessionId) {
   
   const res = await fetch("/api/append-result/${experimentID}", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({
        sessionId: trialSessionId,
      }),
    });
  
    const result = await res.json();
    participantNumber = result.participantNumber;
    return participantNumber;
    
  }

  (async () => {

    localStorage.removeItem('jsPsych_jumpToTrial');
    
    participantNumber = await saveSession(trialSessionId);

    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      alert("The participant number is not assigned. Please, wait.");
      throw new Error("participantNumber not assigned");
    }

    ${evaluateCondition}

    const jsPsych = initJsPsych({
          display_element: document.getElementById('jspsych-container'),


    ${extensions}

    on_data_update: function (data) {
      const res = fetch("/api/append-result/${experimentID}", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          sessionId: trialSessionId,
          response: data,
        }),
      });
      ${branchingEvaluation}
    },

  on_finish: function() {
    jsPsych.data.displayData
  }
});

const timeline = [];

${allCodes}

jsPsych.run(timeline);

})();
`;
  };

  const generateExperiment = () => {
    return `
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
    (crypto.randomUUID
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
      storage: '${storage}'
    });
    
    // Cuando se desconecte, marcar para que el backend finalice la sesión
    // Incluir needsFinalization para que se procesen los datos en caso de desconexión
    sessionRef.onDisconnect().update({
      connected: false,
      needsFinalization: true,
      disconnectedAt: window.firebase.database.ServerValue.TIMESTAMP,
      storage: '${storage}'
    });

    ${evaluateCondition}

    const jsPsych = initJsPsych({
      display_element: document.getElementById('jspsych-container'),

      on_trial_start: function(trial) {
        const lastTrialData = jsPsych.data.get()
        if (lastTrialData) {
        trial.data.prev_response = lastTrialData.response;
        }
      },

      ${extensions}

      on_data_update: function (data) {

        fetch("${DATA_API_URL}", {
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
        });

        ${branchingEvaluation}
      },

      on_finish: async function() {
        
        // Cancelar el onDisconnect para evitar conflictos
        sessionRef.onDisconnect().cancel();

        // Finalizar la sesión normalmente y marcar en Firebase que terminó correctamente
        console.log('Experiment finished normally, sending data to Google Drive...');
        
        try {
          
          // Marcar en Firebase que terminó correctamente Y necesita finalización
          await sessionRef.update({
            connected: false,
            finished: true,
            needsFinalization: true,
            finishedAt: window.firebase.database.ServerValue.TIMESTAMP
          });
          
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



${allCodes}

jsPsych.run(timeline);

})();
`;
  };
  return { generateLocalExperiment, generateExperiment };
}
