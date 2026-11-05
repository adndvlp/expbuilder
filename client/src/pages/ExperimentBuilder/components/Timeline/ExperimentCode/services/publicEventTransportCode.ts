import type { PublicExperimentCodeOptions } from "./publicCodeTypes";

export function publicEventTransportCode({ DATA_API_URL, experimentID }: PublicExperimentCodeOptions): string {
  return `
    let publicBatchTail = Promise.resolve();
    const publicDirectPending = [];
    const publicSequenceKey = ${JSON.stringify(`expbuilder:public:${experimentID}:direct-sequence:`)} + trialSessionId;
    let publicDirectSequence = Number(localStorage.getItem(publicSequenceKey) || 0);
    function _canonicalPublicEvent(value) {
      if (Array.isArray(value)) return '[' + value.map(_canonicalPublicEvent).join(',') + ']';
      if (value !== null && typeof value === 'object') {
        return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + _canonicalPublicEvent(value[key])).join(',') + '}';
      }
      return JSON.stringify(value);
    }
    async function _publicEventEnvelope(record) {
      const payload = record.payload;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(_canonicalPublicEvent(payload)));
      const payloadHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      return { eventId: record.eventId, sequence: record.sequence, payloadHash, payload };
    }
    async function sendBatchConcatenated(records, batchNumber) {
      if (!records.length) return;
      const events = await Promise.all(records.map(_publicEventEnvelope));
      const batchPromise = (async () => {
        const response = await fetch(${JSON.stringify(DATA_API_URL)}, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'appendEvents', experimentID: ${JSON.stringify(experimentID)},
            sessionId: trialSessionId, data: { protocolVersion: 1, events }, batchNumber })
        });
        if (!response.ok) throw new Error('Batch upload failed: ' + await response.text());
        const result = await response.json();
        const expected = new Map(events.map(event => [event.eventId, event]));
        if (result?.success !== true || result.experimentID !== ${JSON.stringify(experimentID)}
            || result.sessionId !== trialSessionId || !Array.isArray(result.acknowledged)
            || result.acknowledged.length !== events.length) throw new Error('Invalid batch acknowledgement');
        for (const item of result.acknowledged) {
          const event = expected.get(item.eventId);
          if (!event || item.sequence !== event.sequence || item.payloadHash !== event.payloadHash) {
            throw new Error('Batch acknowledgement does not match saved events');
          }
          expected.delete(item.eventId);
        }
      })();
      pendingBatchSaves.push(batchPromise);
      try { await batchPromise; }
      finally { pendingBatchSaves.splice(pendingBatchSaves.indexOf(batchPromise), 1); }
    }
    function _flushPublicBatches(force = false) {
      const operation = publicBatchTail.then(async () => {
        const size = BATCH_CONFIG.size;
        if (size <= 0) return;
        while (await TrialDB.count() >= (force ? 1 : size)) {
          const selected = await TrialDB.getN(size);
          let offset = 0;
          while (offset < selected.length) {
            const batch = [];
            let bytes = 0;
            while (offset < selected.length && batch.length < 100) {
              const record = selected[offset];
              const length = new TextEncoder().encode(JSON.stringify(record.payload)).byteLength + 256;
              if (batch.length && bytes + length > 900000) break;
              batch.push(record); bytes += length; offset++;
            }
            await sendBatchConcatenated(batch, ++BATCH_CONFIG.currentBatchNumber);
            await TrialDB.deleteIds(batch.map(record => record.id));
          }
        }
      });
      publicBatchTail = operation.catch(() => {});
      return operation;
    }
    function _queuePublicDirectEvent(data) {
      const record = { eventId: _publicEventId(), sequence: publicDirectSequence++,
        payload: JSON.parse(JSON.stringify(data)) };
      localStorage.setItem(publicSequenceKey, String(publicDirectSequence));
      publicDirectPending.push(record);
      const operation = publicBatchTail.then(async () => {
        while (publicDirectPending.length) {
          await sendBatchConcatenated([publicDirectPending[0]], ++BATCH_CONFIG.currentBatchNumber);
          publicDirectPending.shift();
        }
      });
      publicBatchTail = operation.catch(() => {});
      return operation;
    }
`;
}
