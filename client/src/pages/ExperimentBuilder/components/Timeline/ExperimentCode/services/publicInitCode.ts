import { PublicExperimentCodeOptions } from "./publicCodeTypes";

export function publicInitCode(options: PublicExperimentCodeOptions): string {
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
    // Clean up stale jsPsych wrappers from previous runs (prevents stacking on restarts)
    document.querySelectorAll('.jspsych-content-wrapper').forEach(el => el.remove());

    ${customPreInitCode.public?.trim() ? `// --- User code (before initJsPsych) ---\n    ${customPreInitCode.public.trim()}\n\n    ` : ""}// __INIT_JSPSYCH_START__
    const jsPsych = initJsPsych({
      ${progressBar ? `show_progress_bar: true,` : ""}


      on_trial_start: function(trial) {
        const lastTrialData = jsPsych.data.get()
        if (lastTrialData && trial.data) {
        trial.data.prev_response = lastTrialData.response;
        }${publicParams.on_trial_start?.trim() ? `\n        // --- User code (on_trial_start) ---\n        ${publicParams.on_trial_start.trim()}` : ""}
      },

      ${extensions}

      on_data_update: async function (data) {

        // Agregar timestamp del cliente para ordenamiento correcto
        data.clientTimestamp = Date.now();
        data.sessionId = trialSessionId;
        data.experimentID = "${experimentID}";

        // Actualizar estado a 'in-progress' en la primera actualización
        if (data.trial_index === 0) {
          sessionRef.update({
            state: 'in-progress',
            lastUpdate: window.firebase.database.ServerValue.TIMESTAMP
          }).catch(err => console.error('Error updating state:', err));
        }

        // 🔄 SISTEMA DE RETOMA: Guardar branches + datos del trial para evaluar al reanudar
        if (data.builder_id !== undefined && data.builder_id !== null) {
          localStorage.setItem('jsPsych_resumeTrial', JSON.stringify({
            branches: data.branches || [],
            branchConditions: data.branchConditions || [],
            trialData: data
          }));
        }

        if (BATCH_CONFIG.useIndexedDB) {
          // --- CON IndexedDB: Batching habilitado ---
          try {
            await TrialDB.add(data);
            console.log(\`Trial \${data.trial_index} saved to IndexedDB\`);
          } catch (error) {
            console.error('Error saving to IndexedDB:', error);
          }

          // Solo enviar batches si batchSize > 0
          if (BATCH_CONFIG.size > 0) {
            const pendingCount = await TrialDB.count();
            
            // Enviar batch cuando se acumule el tamaño configurado
            if (pendingCount >= BATCH_CONFIG.size) {
              const batch = await TrialDB.getN(BATCH_CONFIG.size);
              BATCH_CONFIG.currentBatchNumber++;
              
              // Enviar batch concatenado a Firestore
              await sendBatchConcatenated(batch, BATCH_CONFIG.currentBatchNumber);
              
              // Eliminar trials enviados de IndexedDB
              await TrialDB.deleteN(BATCH_CONFIG.size);
              
              console.log(\`Batch #\${BATCH_CONFIG.currentBatchNumber} sent, \${batch.length} trials\`);
            }
          }
          // Si batchSize = 0, solo acumular en IndexedDB, enviar TODO en on_finish
        } else {
          // --- SIN IndexedDB: Enviar trial por trial a Firestore ---
          try {
            const response = await fetch("${DATA_API_URL}", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                experimentID: "${experimentID}",
                sessionId: trialSessionId,
                data: data
              })
            });

            if (!response.ok) {
              console.error('Error sending trial to Firestore:', await response.text());
            } else {
              console.log(\`Trial \${data.trial_index} sent to Firestore\`);
            }
          } catch (error) {
            console.error('Error sending trial:', error);
          }
        }

        ${branchingEvaluation}${publicParams.on_data_update?.trim() ? `\n\n        // --- User code (on_data_update) ---\n        ${publicParams.on_data_update.trim()}` : ""}
      },
`;
}
