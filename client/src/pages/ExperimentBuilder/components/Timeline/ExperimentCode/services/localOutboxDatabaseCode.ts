export function buildLocalOutboxDatabaseCode(): string {
  return `
    function openDatabase() {
      if (databasePromise) return databasePromise;
      databasePromise = new Promise(function(resolve, reject) {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = function() {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        request.onsuccess = function() { resolve(request.result); };
        request.onerror = function() {
          databasePromise = null;
          reject(request.error || new Error('IndexedDB could not be opened'));
        };
        request.onblocked = function() {
          databasePromise = null;
          reject(new Error('IndexedDB is blocked by another page'));
        };
      });
      return databasePromise;
    }

    async function runRequest(mode, makeRequest) {
      const database = await openDatabase();
      return new Promise(function(resolve, reject) {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let value;
        let request;
        try {
          request = makeRequest(store);
          request.onsuccess = function() { value = request.result; };
          request.onerror = function() {
            reject(request.error || new Error('IndexedDB request failed'));
          };
        } catch (error) {
          reject(error);
          return;
        }
        transaction.oncomplete = function() { resolve(value); };
        transaction.onerror = function() {
          reject(transaction.error || new Error('IndexedDB transaction failed'));
        };
        transaction.onabort = transaction.onerror;
      });
    }

    function belongsToSession(record) {
      return record.experimentID === experimentID && record.sessionId === sessionId;
    }

    async function listRecords() {
      const all = await runRequest('readonly', function(store) {
        return store.getAll();
      });
      return (all || []).filter(belongsToSession).sort(function(left, right) {
        return left.sequence - right.sequence;
      });
    }

    function saveRecord(record) {
      return runRequest('readwrite', function(store) { return store.put(record); });
    }

    async function initialize(persistedCount) {
      await openDatabase();
      const records = await listRecords();
      serverStoredCount = Number.isInteger(persistedCount) && persistedCount >= 0
        ? persistedCount
        : 0;
      nextSequence = Math.max(serverStoredCount, records.reduce(function(maximum, record) {
        return Math.max(maximum, record.sequence + 1);
      }, 0));
      return records;
    }

    async function saveUnsavedRecords() {
      for (const unsaved of unsavedRecords.values()) {
        await saveRecord(unsaved);
        unsavedRecords.delete(unsaved.key);
      }
    }
`;
}
