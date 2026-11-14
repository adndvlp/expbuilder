export function registeredExports(form = 'split') {
  const make = endpoint => ({ run() {}, __endpoint: { platform: 'gcfv2', region: ['us-central1'], ...endpoint } });
  const firestore = document => make({ eventTrigger: { eventType: 'google.cloud.firestore.document.v1.written', eventFilters: { database: '(default)', namespace: '(default)' }, eventFilterPathPatterns: { document }, retry: true } });
  const database = ref => make({ eventTrigger: { eventType: 'google.firebase.database.ref.v1.written', eventFilters: {}, eventFilterPathPatterns: { ref, instance: '*' }, retry: false } });
  const schedule = () => make({ scheduleTrigger: { schedule: 'every 1 minutes', timeZone: 'UTC', retryConfig: {} } });
  const task = () => make({ taskQueueTrigger: { retryConfig: { maxAttempts: 8, minBackoffSeconds: 30, maxBackoffSeconds: 900, maxDoublings: 5 } } });
  return {
    apiData: make({ httpsTrigger: {} }),
    enqueueSessionTimeout: firestore('experiments/{experimentID}/sessions/{sessionId}'),
    enqueueSessionExport: firestore('experiments/{experimentID}/sessions/{sessionId}/export_jobs/{revision}'),
    onSessionConnectionWritten: database('session_connections/{experimentID}/{sessionId}/{connectionId}'),
    finalizeDisconnectedSessions: database('sessions/{experimentID}/{sessionId}'),
    processSessionTimeout: task(), processSessionExportTask: task(),
    ...(form === 'split' ? { reconcilePendingSessionTimeouts: schedule(), reconcilePendingSessionExports: schedule() }
      : { reconcilePendingSessions: schedule() }),
  };
}
