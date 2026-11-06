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

  // --- IndexedDB: unacknowledged events have no age-based expiry ---
  const TrialDB = {
    dbName: ${JSON.stringify(storageKeys.trialDatabase)},
    storeName: 'trials',
    counterName: 'session-sequences',
    manifestName: 'event-manifest',
    db: null,

    async init() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 3);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
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

${publicEventStorageMethods()}

    async getAll(sessionId = trialSessionId) {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.index('sessionId').getAll(sessionId);
        
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
      const rows = await this.getAll();
      return this.deleteIds(rows.map(row => row.id));
    }
  };
`;
}
