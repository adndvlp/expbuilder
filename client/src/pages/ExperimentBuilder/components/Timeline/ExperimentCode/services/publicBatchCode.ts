import { PublicExperimentCodeOptions } from "./publicCodeTypes";

export function publicBatchCode(options: PublicExperimentCodeOptions): string {
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
    // Track pending batch saves
    const pendingBatchSaves = [];

    // Función para enviar batch concatenado a Firestore (usando endpoint existente)
    async function sendBatchConcatenated(trials, batchNumber) {
      if (trials.length === 0) return;
      
      console.log(\`Sending concatenated batch #\${batchNumber} with \${trials.length} trials\`);
      
      // Concatenar trials en un documento plano sin anidamiento
      // Convertir cada trial a string JSON y concatenar con separador
      const concatenatedData = {
        batchNumber: batchNumber,
        trialsCount: trials.length,
        trialsData: JSON.stringify(trials), // String, no array anidado
        firstTrialIndex: trials[0]?.trial_index || 0,
        lastTrialIndex: trials[trials.length - 1]?.trial_index || 0,
        clientTimestamp: trials[0]?.clientTimestamp || Date.now(),
        trial_index: \`batch_\${batchNumber}\` // ID único para batch
      };
      
      const batchPromise = fetch("${DATA_API_URL}", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: "${experimentID}",
          sessionId: trialSessionId,
          data: concatenatedData,
          storage: "${useStorage}",
        }),
      })
      .then(res => {
        if (!res.ok) {
          return res.text().then(text => {
            console.error('Error sending batch:', text);
          });
        }
        return res.json();
      })
      .then(result => {
        if (result && result.success) {
          console.log(\`Batch #\${batchNumber} sent successfully\`);
        }
      })
      .catch(error => {
        console.error('Error in sendBatchConcatenated:', error);
      })
      .finally(() => {
        const index = pendingBatchSaves.indexOf(batchPromise);
        if (index > -1) {
          pendingBatchSaves.splice(index, 1);
        }
      });
      
      pendingBatchSaves.push(batchPromise);
      return batchPromise;
    }

    // Función para enviar experimento completo directo al storage
    async function sendCompleteExperiment(trials) {
      if (trials.length === 0) return;
      
      console.log(\`Sending complete experiment with \${trials.length} trials directly to storage\`);
      
      // Agregar metadata a cada trial
      const trialsWithMetadata = trials.map(trial => ({
        ...trial,
        session_browser: metadata.browser || "",
        session_browser_version: metadata.browserVersion || "",
        session_os: metadata.os || "",
        session_screen_resolution: metadata.screenResolution || "",
        session_language: metadata.language || "",
        session_started_at: metadata.startedAt || "",
        session_id: trialSessionId,
      }));
      
      // Enviar trials como JSON - el backend los convertirá a CSV
      const apiBaseUrl = "${DATA_API_URL}".replace('/apiData', '');
      return fetch(\`\${apiBaseUrl}/apiDataComplete\`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: "${experimentID}",
          sessionId: trialSessionId,
          trialsData: trialsWithMetadata,
          storage: "${useStorage}",
        }),
      })
      .then(res => {
        if (!res.ok) {
          return res.text().then(text => {
            console.error('Error sending complete experiment:', text);
            throw new Error(text);
          });
        }
        return res.json();
      })
      .then(result => {
        if (result && result.success) {
          console.log('Complete experiment sent successfully to storage');
        }
        return result;
      })
      .catch(error => {
        console.error('Error in sendCompleteExperiment:', error);
        throw error;
      });
    }
`;
}
