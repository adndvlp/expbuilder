import { PublicExperimentCodeOptions } from "./publicCodeTypes";
import { getPublicRuntimeStorageKeys } from "./publicRuntimeStorageKeys";
import { publicEventStorageCode, publicEventStorageMethods } from "./publicEventStorageCode";

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
  const storageKeys = getPublicRuntimeStorageKeys(experimentID);
  return `
  // --- FileUploadResponseComponent endpoint (Firebase Cloud Function) ---
  window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '${DATA_API_URL}'.replace('/apiData', '/uploadParticipantFile');
  window.JSPSYCH_EXPERIMENT_ID = '${experimentID}';

${publicEventStorageCode()}

  // --- IndexedDB Wrapper para Batching con TTL (3 días) ---
  const TrialDB = {
    dbName: ${JSON.stringify(storageKeys.trialDatabase)},
    storeName: 'trials',
    counterName: 'session-sequences',
    manifestName: 'event-manifest',
    db: null,
    TTL_DAYS: 3,

    async init() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 3);
        
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
          if (!db.objectStoreNames.contains(this.manifestName)) {
            const manifest = db.createObjectStore(this.manifestName, { keyPath: ['sessionId', 'sequence'] });
            manifest.createIndex('sessionId', 'sessionId');
          }
          if (!db.objectStoreNames.contains(this.counterName)) {
            db.createObjectStore(this.counterName, { keyPath: 'sessionId' });
            _upgradePublicEvents(request.transaction, this.storeName, this.counterName);
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

${publicEventStorageMethods()}

    async getAll() {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.index('sessionId').getAll(trialSessionId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async count() {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.index('sessionId').count(trialSessionId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async getN(n) {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.index('sessionId').getAll(trialSessionId, n);
        
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
