export function publicEventStorageCode(): string {
  return `
  function _publicEventId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
  }
  function _canonicalPublicEvent(value) {
    if (Array.isArray(value)) return '[' + value.map(_canonicalPublicEvent).join(',') + ']';
    if (value !== null && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + _canonicalPublicEvent(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
  }
  async function _publicHash(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(_canonicalPublicEvent(value)));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function _publicEventEnvelope(record) {
    return { eventId: record.eventId, sequence: record.sequence,
      payloadHash: record.payloadHash || await _publicHash(record.payload), payload: record.payload,
      ...(record.checkpoint ? { checkpoint: record.checkpoint } : {}) };
  }
  function _bindPublicCheckpoint(checkpoint, eventId, sequence) {
    if (!checkpoint?.completed || typeof checkpoint.completed !== 'object') return checkpoint;
    return { ...checkpoint, completed: { ...checkpoint.completed, eventId, sequence } };
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
    async add(trial, checkpoint = null) {
      if (!this.db) await this.init();
      const payload = JSON.parse(JSON.stringify(trial));
      const payloadHash = await _publicHash(payload);
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName, this.counterName, this.manifestName], 'readwrite');
        const counters = transaction.objectStore(this.counterName);
        let record;
        const request = counters.get(trialSessionId);
        request.onsuccess = () => {
          const sequence = request.result?.nextSequence || 0;
          const eventId = _publicEventId();
          const savedCheckpoint = _bindPublicCheckpoint(checkpoint, eventId, sequence);
          record = { ...payload, payload, payloadHash, checkpoint: savedCheckpoint, eventId, sequence,
            timestamp: Date.now(), createdAt: Date.now(), sessionId: trialSessionId };
          const saved = transaction.objectStore(this.storeName).add(record);
          saved.onsuccess = () => { record.id = saved.result; };
          transaction.objectStore(this.manifestName).put({ sessionId: trialSessionId,
            eventId: record.eventId, sequence, payloadHash });
          counters.put({ sessionId: trialSessionId, nextSequence: sequence + 1,
            checkpointSequence: checkpoint ? sequence : (request.result?.checkpointSequence ?? -1),
            checkpoint: savedCheckpoint || request.result?.checkpoint || null });
        };
        transaction.oncomplete = () => resolve(record);
        transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Trial transaction aborted'));
      });
    },
    async getState() {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.counterName, this.manifestName], 'readonly');
        const counter = transaction.objectStore(this.counterName).get(trialSessionId);
        const manifest = transaction.objectStore(this.manifestName).index('sessionId').getAll(trialSessionId);
        transaction.oncomplete = () => resolve({ ...counter.result,
          events: manifest.result.sort((a, b) => a.sequence - b.sequence) });
        transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Cannot read saved event set'));
      });
    },
    async syncManifest(receivedEvents = []) {
      if (!this.db) await this.init();
      const pending = await this.getAll();
      const events = [...receivedEvents, ...await Promise.all(pending.map(_publicEventEnvelope))];
      if (!events.length) return;
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.counterName, this.manifestName], 'readwrite');
        const counters = transaction.objectStore(this.counterName);
        const request = counters.get(trialSessionId);
        request.onsuccess = () => {
          for (const { eventId, sequence, payloadHash } of events) {
            transaction.objectStore(this.manifestName).put({ sessionId: trialSessionId, eventId, sequence, payloadHash });
          }
          counters.put({ ...request.result, sessionId: trialSessionId,
            nextSequence: Math.max(request.result?.nextSequence || 0, ...events.map(event => event.sequence + 1)) });
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Cannot restore saved event set'));
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
