import { buildLocalOutboxDatabaseCode } from "./localOutboxDatabaseCode";

export function buildLocalOutboxCode(): string {
  return `
  function _createLocalOutbox(experimentID, sessionId) {
    const DB_NAME = 'expbuilder-local-session-outbox-v1';
    const STORE_NAME = 'trial-events';
    const MAX_ATTEMPTS = 3;
    let databasePromise;
    let flushPromise = null;
    let retryTimer = null;
    let enqueueTail = Promise.resolve();
    let nextSequence = 0;
    let serverStoredCount = 0;
    const unsavedRecords = new Map();
    const acknowledgementListeners = new Set();

${buildLocalOutboxDatabaseCode()}

    function delay(milliseconds) {
      return new Promise(function(resolve) { setTimeout(resolve, milliseconds); });
    }

    function scheduleRetry() {
      if (retryTimer !== null) return;
      retryTimer = setTimeout(function() {
        retryTimer = null;
        void waitForIdle().catch(function(error) {
          console.warn('[session-persistence] automatic retry remains pending', {
            experimentID: experimentID,
            sessionId: sessionId,
            error: error.message
          });
          scheduleRetry();
        });
      }, 5000);
    }

    async function responseJson(response) {
      try {
        return await response.json();
      } catch (_error) {
        return null;
      }
    }

    function persistenceError(message, retryable, status) {
      const error = new Error(message);
      error.retryable = retryable;
      error.status = status || 0;
      return error;
    }

    function notifyAcknowledged(record) {
      for (const listener of acknowledgementListeners) {
        try {
          listener(record.payload, {
            eventId: record.eventId,
            sequence: record.sequence
          });
        } catch (error) {
          console.error('[session-persistence] acknowledgement listener failed', error);
        }
      }
    }

    async function sendOnce(record) {
      let response;
      try {
        response = await fetch('/api/append-result/' + encodeURIComponent(experimentID), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            eventId: record.eventId,
            sequence: record.sequence,
            response: record.payload
          })
        });
      } catch (error) {
        throw persistenceError('Network error while saving trial', true, 0);
      }

      const body = await responseJson(response);
      if (!response.ok || !body || body.success !== true) {
        const retryable = response.status >= 500 || response.status === 429;
        throw persistenceError(
          'Trial save rejected with HTTP ' + response.status,
          retryable,
          response.status
        );
      }
      if (body.eventId !== record.eventId || body.sequence !== record.sequence) {
        throw persistenceError('Trial save acknowledgement did not match', false, response.status);
      }
      if (
        !Number.isInteger(body.storedCount) ||
        body.storedCount < record.sequence + 1
      ) {
        throw persistenceError('Trial save count acknowledgement did not match', false, response.status);
      }

      record.status = 'acknowledged';
      record.acknowledgedAt = new Date().toISOString();
      record.updatedAt = record.acknowledgedAt;
      delete record.lastError;
      await saveRecord(record);
      notifyAcknowledged(record);
      console.info('[session-persistence] trial acknowledged', {
        experimentID: experimentID,
        sessionId: sessionId,
        eventId: record.eventId,
        sequence: record.sequence
      });
    }

    async function sendWithRetries(record) {
      let lastError;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        record.attempts = (record.attempts || 0) + 1;
        record.updatedAt = new Date().toISOString();
        await saveRecord(record);
        try {
          await sendOnce(record);
          return;
        } catch (error) {
          lastError = error;
          record.lastError = error.message;
          record.updatedAt = new Date().toISOString();
          await saveRecord(record);
          console.warn('[session-persistence] trial still pending', {
            experimentID: experimentID,
            sessionId: sessionId,
            eventId: record.eventId,
            sequence: record.sequence,
            status: error.status || 0,
            attempt: attempt
          });
          if (!error.retryable || attempt === MAX_ATTEMPTS) break;
          await delay(Math.min(250 * Math.pow(2, attempt - 1), 1000));
        }
      }
      throw lastError || new Error('Trial could not be saved');
    }

    async function flushAll() {
      while (true) {
        const records = await listRecords();
        const pending = records.filter(function(record) {
          return record.status !== 'acknowledged';
        });
        if (pending.length === 0) return stats();
        for (const record of pending) await sendWithRetries(record);
      }
    }

    function flush() {
      if (!flushPromise) {
        flushPromise = flushAll().catch(function(error) {
          if (error.retryable !== false) scheduleRetry();
          throw error;
        }).finally(function() { flushPromise = null; });
        window.ExpBuilderPersistence?.track?.(flushPromise);
      }
      return flushPromise;
    }

    function onAcknowledged(listener) {
      if (typeof listener !== 'function') {
        throw new TypeError('Acknowledgement listener must be a function');
      }
      acknowledgementListeners.add(listener);
      return function unsubscribe() {
        acknowledgementListeners.delete(listener);
      };
    }

    async function waitForIdle() {
      await enqueueTail;
      await saveUnsavedRecords();
      if (flushPromise) {
        try { await flushPromise; } catch (_error) {}
      }
      return flush();
    }

    async function enqueue(payload) {
      const sequence = nextSequence;
      nextSequence += 1;
      const now = new Date().toISOString();
      const eventId = sessionId + ':' + sequence;
      const record = {
        key: experimentID + '::' + sessionId + '::' + sequence,
        experimentID: experimentID,
        sessionId: sessionId,
        eventId: eventId,
        sequence: sequence,
        payload: payload,
        status: 'pending',
        attempts: 0,
        createdAt: now,
        updatedAt: now
      };
      unsavedRecords.set(record.key, record);
      const queued = enqueueTail.then(async function() {
        await saveUnsavedRecords();
      });
      enqueueTail = queued.catch(function() { return undefined; });
      try {
        await queued;
      } catch (error) {
        scheduleRetry();
        throw error;
      }
      return flush();
    }

    async function stats() {
      const records = await listRecords();
      const total = Math.max(serverStoredCount, records.reduce(function(maximum, record) {
        return Math.max(maximum, record.sequence + 1);
      }, 0));
      const acknowledgedAfterBaseline = records.filter(function(record) {
        return record.sequence >= serverStoredCount && record.status === 'acknowledged';
      }).length;
      const pending = records.filter(function(record) {
        return record.status !== 'acknowledged';
      }).length + unsavedRecords.size;
      return {
        total: total,
        acknowledged: Math.min(total, serverStoredCount + acknowledgedAfterBaseline),
        pending: pending,
        lastSequence: total - 1
      };
    }

    async function clear() {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      const records = await listRecords();
      for (const record of records) {
        await runRequest('readwrite', function(store) { return store.delete(record.key); });
      }
    }

    return {
      clear: clear,
      enqueue: enqueue,
      flush: flush,
      initialize: initialize,
      onAcknowledged: onAcknowledged,
      stats: stats,
      waitForIdle: waitForIdle
    };
  }
`;
}
