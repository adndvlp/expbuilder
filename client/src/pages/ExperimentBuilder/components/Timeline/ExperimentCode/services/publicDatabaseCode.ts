import { PublicExperimentCodeOptions } from "./publicCodeTypes";

export function publicDatabaseCode(
  options: PublicExperimentCodeOptions,
): string {
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
  // --- FileUploadResponseComponent endpoint (Firebase Cloud Function) ---
  window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '${DATA_API_URL}'.replace('/apiData', '/uploadParticipantFile');
  window.JSPSYCH_EXPERIMENT_ID = '${experimentID}';

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
`;
}
