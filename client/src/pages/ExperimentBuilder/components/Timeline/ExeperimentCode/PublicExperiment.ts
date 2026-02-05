import { UploadedFile } from "./useExperimentCode";
import { Trial, Loop } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
const DATA_API_URL = import.meta.env.VITE_DATA_API_URL;

type GetTrialFn = (id: string | number) => Promise<Trial | null>;
type GetLoopTimelineFn = (loopId: string | number) => Promise<TimelineItem[]>;
type GetLoopFn = (id: string | number) => Promise<Loop | null>;

type Props = {
  experimentID: string | undefined;
  evaluateCondition: string;
  fetchExtensions: () => Promise<string>;
  branchingEvaluation: string;
  uploadedFiles: UploadedFile[];
  experimentName: string;
  storage: string | undefined;
  getTrial: GetTrialFn;
  getLoopTimeline: GetLoopTimelineFn;
  getLoop: GetLoopFn;
};

export default function PublicExperiment({
  experimentID,
  evaluateCondition,
  fetchExtensions,
  branchingEvaluation,
  uploadedFiles,
  storage,
  getTrial,
  getLoopTimeline,
  getLoop,
}: Props) {
  const generateExperiment = async (storageOverride?: string) => {
    const useStorage = storageOverride || storage;

    // Cargar configuración de batching desde Firestore
    let batchConfig = {
      useIndexedDB: true,
      batchSize: 0,
      resumeTimeoutMinutes: 30,
    };

    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../../../../../lib/firebase");

      if (experimentID) {
        const docRef = doc(db, "experiments", experimentID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.batchConfig) {
            batchConfig = {
              useIndexedDB: data.batchConfig.useIndexedDB ?? true,
              batchSize: data.batchConfig.batchSize ?? 0,
              resumeTimeoutMinutes: data.batchConfig.resumeTimeoutMinutes ?? 30,
            };
          }
        }
      }
    } catch (error) {
      console.error("Error loading batch config:", error);
      // Continuar con valores por defecto
    }

    // Fetch extensions before generating experiment
    const extensions = await fetchExtensions();
    // Generate codes dynamically from trial/loop data
    let allCodes = "";
    try {
      const { generateAllCodes } = await import(
        "../../../utils/generateTrialLoopCodes"
      );
      const codes = await generateAllCodes(
        experimentID || "",
        uploadedFiles,
        getTrial,
        getLoopTimeline,
        getLoop,
      );
      allCodes = codes.join("\n\n");
    } catch (error) {
      console.error("Error generating codes:", error);
    }

    return `
  // --- IndexedDB Wrapper para Batching con TTL (3 días) ---
  const TrialDB = {
    dbName: 'jsPsychTrialsDB',
    storeName: 'trials',
    db: null,
    TTL_DAYS: 3,

    async init() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          // Limpiar datos vencidos al iniciar
          this.cleanExpiredData().catch(err => console.error('Error cleaning expired data:', err));
          resolve(this.db);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { 
              keyPath: 'id', 
              autoIncrement: true 
            });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        };
      });
    },

    async cleanExpiredData() {
      if (!this.db) await this.init();
      const now = Date.now();
      const expirationTime = this.TTL_DAYS * 24 * 60 * 60 * 1000; // 3 días en ms
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('createdAt');
        const request = index.openCursor();
        
        let deletedCount = 0;
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const trial = cursor.value;
            const age = now - (trial.createdAt || now);
            
            if (age > expirationTime) {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          } else {
            if (deletedCount > 0) {
              console.log(\`Cleaned \${deletedCount} expired trials from IndexedDB\`);
            }
            resolve(deletedCount);
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    },

    async add(trial) {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.add({
          ...trial,
          timestamp: Date.now(),
          createdAt: Date.now(),
          sessionId: trialSessionId
        });
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async getAll() {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async count() {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.count();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async getN(n) {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll(null, n);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async deleteN(n) {
      if (!this.db) await this.init();
      const trials = await this.getN(n);
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        trials.forEach(trial => {
          store.delete(trial.id);
        });
        
        transaction.oncomplete = () => resolve(trials.length);
        transaction.onerror = () => reject(transaction.error);
      });
    },

    async clear() {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  };

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

  // Recuperar sessionId de localStorage o crear uno nuevo
  let trialSessionId = localStorage.getItem('jsPsych_currentSessionId');
  let storedParticipantNumber = localStorage.getItem('jsPsych_participantNumber');
  let isResuming = false;
  
  if (!trialSessionId) {
    trialSessionId = "online_" + (crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10));
    console.log('🆕 [RESUME] Created NEW sessionId:', trialSessionId);
  } else {
    isResuming = true;
    console.log('🔄 [RESUME] Loaded EXISTING sessionId from localStorage:', trialSessionId);
  }

  let participantNumber;

  async function createSession() {
    try {
      const res = await fetch("${DATA_API_URL}", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: "${experimentID}",
          sessionId: trialSessionId,
          uid: Uid,
          batchSize: ${batchConfig.batchSize}
        }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error creating session:', errorText);
        throw new Error(\`Failed to create session: \${res.status} - \${errorText}\`);
      }
      
      const result = await res.json();
      console.log('Session created:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to create session');
      }
      
      return result.participantNumber;
    } catch (error) {
      console.error('Error in createSession:', error);
      alert('Error creating session: ' + error.message);
      throw error;
    }
  }

  (async () => {
    // Limpiar el localStorage de valores de sesiones anteriores (solo repeat/jump conditions)
    localStorage.removeItem('jsPsych_jumpToTrial');
    
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
      console.log('🔍 [RESUME] Checking IndexedDB for existing trials...');
      const existingTrials = await TrialDB.getAll();
      console.log('🔍 [RESUME] Found ' + existingTrials.length + ' trials in IndexedDB');
      
      if (existingTrials.length > 0) {
        const lastTrial = existingTrials[existingTrials.length - 1];
        console.log('🔍 [RESUME] Last trial sessionId:', lastTrial.sessionId);
        console.log('🔍 [RESUME] Current sessionId:', trialSessionId);
        
        if (lastTrial.sessionId === trialSessionId) {
          console.log('✅ [RESUME] Resuming session with ' + existingTrials.length + ' existing trials');
          BATCH_CONFIG.currentBatchNumber = Math.floor(existingTrials.length / (BATCH_CONFIG.size || 1));
          resumedSession = true;
        } else {
          console.log('❌ [RESUME] SessionId mismatch. Clearing old trials from different session.');
          console.log('   Old:', lastTrial.sessionId);
          console.log('   New:', trialSessionId);
          await TrialDB.clear();
        }
      } else {
        console.log('ℹ️ [RESUME] No existing trials found. Starting fresh session.');
      }
    } else {
      console.log('ℹ️ [RESUME] IndexedDB disabled. Resume check skipped.');
    }
    
    // SIEMPRE llamar a createSession (para crear documento en Firestore)
    // El backend maneja sesiones duplicadas (409) y las retorna correctamente
    participantNumber = await createSession();
    
    // Guardar sessionId y participantNumber en localStorage para futuras retomas
    localStorage.setItem('jsPsych_currentSessionId', trialSessionId);
    localStorage.setItem('jsPsych_participantNumber', participantNumber.toString());

    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      alert("The participant number is not assigned. Please, wait.");
      throw new Error("participantNumber not assigned");
    }

    console.log('Participant number assigned:', participantNumber);
    
    // Esperar e inicializar Firebase
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

    // Verificar si hay un trial guardado para retomar (de una sesión previa)
    const resumeTrialId = localStorage.getItem('jsPsych_resumeTrial');
    console.log('🔍 [RESUME] Checking for resume trial ID in localStorage...');
    console.log('🔍 [RESUME] resumeTrialId:', resumeTrialId);
    
    if (resumeTrialId) {
      console.log('✅ [RESUME] Found resume point! Jumping to trial:', resumeTrialId);
      // Usar la misma lógica de jump pero con la key de retoma
      localStorage.setItem('jsPsych_jumpToTrial', resumeTrialId);
      localStorage.removeItem('jsPsych_resumeTrial');
      console.log('✅ [RESUME] Set jsPsych_jumpToTrial to:', resumeTrialId);
    } else {
      console.log('ℹ️ [RESUME] No resume trial ID found. Starting from beginning.');
    }

    const jsPsych = initJsPsych({
      display_element: document.getElementById('jspsych-container'),

      on_trial_start: function(trial) {
        const lastTrialData = jsPsych.data.get()
        if (lastTrialData && trial.data) {
        trial.data.prev_response = lastTrialData.response;
        }
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

        // 🔄 SISTEMA DE RETOMA: Guardar builder_id (jsPsych no lo sobrescribe)
        if (data.builder_id !== undefined && data.builder_id !== null) {
          localStorage.setItem('jsPsych_resumeTrial', String(data.builder_id));
          console.log('💾 [RESUME] Saved builder_id:', data.builder_id);
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

        ${branchingEvaluation}
      },

      on_finish: async function() {
        
        console.log('Experiment finishing...');
        
        // Limpiar el localStorage de retoma ya que el experimento terminó correctamente
        localStorage.removeItem('jsPsych_resumeTrial');
        localStorage.removeItem('jsPsych_currentSessionId');
        localStorage.removeItem('jsPsych_participantNumber');
        console.log('🧹 [RESUME] Cleared resume data - experiment completed');

        if (BATCH_CONFIG.useIndexedDB) {
          // --- CON IndexedDB: Enviar datos acumulados ---
          
          // Esperar cualquier batch pendiente
          if (pendingBatchSaves.length > 0) {
            console.log('Waiting for', pendingBatchSaves.length, 'pending batch saves...');
            await Promise.allSettled(pendingBatchSaves);
          }

          const allTrials = await TrialDB.getAll();
          
          if (allTrials.length > 0) {
            if (BATCH_CONFIG.size === 0) {
              // batchSize=0: Enviar TODO directo al storage (sin Firestore)
              console.log(\`Sending \${allTrials.length} trials directly to storage (batchSize=0)\`);
              
              try {
                await sendCompleteExperiment(allTrials);
                await TrialDB.clear();
                console.log('Complete experiment sent to storage successfully');
              } catch (error) {
                console.error('Error sending complete experiment:', error);
                alert('Error sending experiment data. Please contact support.');
              }
            } else {
              // batchSize>0: Enviar trials restantes como batch final a Firestore
              BATCH_CONFIG.currentBatchNumber++;
              console.log(\`Sending final batch #\${BATCH_CONFIG.currentBatchNumber} with \${allTrials.length} remaining trials\`);
              await sendBatchConcatenated(allTrials, BATCH_CONFIG.currentBatchNumber);
              await TrialDB.clear();
              
              // Esperar que el batch final termine
              if (pendingBatchSaves.length > 0) {
                console.log('Waiting for final batch to complete...');
                await Promise.allSettled(pendingBatchSaves);
              }
            }
          }
        } else {
          // --- SIN IndexedDB: Datos ya están en Firestore (trials individuales) ---
          console.log('All trials already in Firestore, triggering finalization...');
        }
        
        // Cancelar el onDisconnect para evitar que marque como abandoned
        sessionRef.onDisconnect().cancel();

        // Finalizar la sesión normalmente y marcar en Firebase que terminó correctamente
        console.log('Experiment finished normally, sending data to storage...');
        
        try {
          // Si batchSize=0 CON IndexedDB: Ya se envió directo al storage, NO necesita finalización
          const needsBackendFinalization = !(BATCH_CONFIG.useIndexedDB && BATCH_CONFIG.size === 0);
          
          // Marcar en Firebase que terminó correctamente
          await sessionRef.update({
            connected: false,
            finished: true,
            needsFinalization: needsBackendFinalization,
            state: 'completed',
            finishedAt: window.firebase.database.ServerValue.TIMESTAMP,
            lastUpdate: window.firebase.database.ServerValue.TIMESTAMP
          });
          
          if (needsBackendFinalization) {
            console.log('Session marked for finalization in Firebase');
          } else {
            console.log('Session completed (batch=0, already sent to storage)');
          }
        } catch (error) {
          console.error('Error marking session as finished:', error);
        }
      }
    });
    
    // Uncomment to see the json results after finishing a session experiment
    // jsPsych.data.displayData('csv');

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
