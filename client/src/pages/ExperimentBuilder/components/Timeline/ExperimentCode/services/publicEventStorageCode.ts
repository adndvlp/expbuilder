export function publicEventStorageCode(): string {
  return `
  function _publicEventId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
  }
  function _upgradePublicEvents(transaction, storeName, counterName) {
    const counters = transaction.objectStore(counterName);
    const sequences = new Map();
    transaction.objectStore(storeName).openCursor().onsuccess = event => {
      const cursor = event.target.result;
      if (!cursor) return;
      const { id, timestamp, createdAt, sessionId, ...payload } = cursor.value;
      const sequence = sequences.get(sessionId) || 0;
      cursor.update({ ...cursor.value, eventId: _publicEventId(), sequence, payload });
      sequences.set(sessionId, sequence + 1);
      counters.put({ sessionId, nextSequence: sequence + 1 });
      cursor.continue();
    };
  }
`;
}

export function publicEventStorageMethods(): string {
  return `
    async add(trial) {
      if (!this.db) await this.init();
      const payload = JSON.parse(JSON.stringify(trial));
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName, this.counterName], 'readwrite');
        const counters = transaction.objectStore(this.counterName);
        let id;
        const request = counters.get(trialSessionId);
        request.onsuccess = () => {
          const sequence = request.result?.nextSequence || 0;
          const record = { ...payload, payload, eventId: _publicEventId(), sequence,
            timestamp: Date.now(), createdAt: Date.now(), sessionId: trialSessionId };
          const saved = transaction.objectStore(this.storeName).add(record);
          saved.onsuccess = () => { id = saved.result; };
          counters.put({ sessionId: trialSessionId, nextSequence: sequence + 1 });
        };
        transaction.oncomplete = () => resolve(id);
        transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Trial transaction aborted'));
      });
    },
    async deleteIds(ids) {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        ids.forEach(id => store.delete(id));
        transaction.oncomplete = () => resolve(ids.length);
        transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Trial deletion aborted'));
      });
    },
`;
}
