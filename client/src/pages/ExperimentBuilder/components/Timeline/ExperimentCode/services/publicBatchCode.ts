import { PublicExperimentCodeOptions } from "./publicCodeTypes";
import { publicEventTransportCode } from "./publicEventTransportCode";

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

${publicEventTransportCode(options)}

    // Función para enviar experimento completo directo al storage
    async function sendCompleteExperiment(trials) {
      if (trials.length === 0) return;
      
      console.log(\`Sending complete experiment with \${trials.length} trials directly to storage\`);
      
      // Agregar metadata a cada trial
      const trialsWithMetadata = trials.map(trial => ({
        ...(trial.payload ?? trial),
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
        if (result?.success !== true) throw new Error('Complete experiment upload was not acknowledged');
        console.log('Complete experiment sent successfully to storage');
        return result;
      })
      .catch(error => {
        console.error('Error in sendCompleteExperiment:', error);
        throw error;
      });
    }
`;
}
