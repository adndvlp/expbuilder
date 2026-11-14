import { isDeepStrictEqual } from 'node:util';
import { registration } from './model.mjs';
import { quantity } from '../core/quantity.mjs';

export const reconciliation = Object.freeze({ id: 'session-reconciliation',
  split: ['reconcilePendingSessionExports', 'reconcilePendingSessionTimeouts'], consolidated: ['reconcilePendingSessions'] });
export const allocationMetricUnits = Object.fromEntries(['functions.invocations', 'functions.failures', 'firestore.readUnits', 'firestore.indexReadUnits',
  'firestore.readCalls', 'firestore.writes', 'firestore.deletes', 'firestore.transactionAttempts', 'firestore.batchAttempts', 'firestore.directWriteCalls',
  'rtdb.readCalls', 'rtdb.writeAttempts', ...['googledrive', 'dropbox', 'osf'].map(provider => `provider.${provider}.requests`)].map(name => [name, 'count']));
export const reconciliationMetricUnits = { ...allocationMetricUnits,
  ...Object.fromEntries(['firestore.readFailures', 'firestore.queries', 'firestore.documentsReturned', 'firestore.writeAttempts', 'firestore.deleteAttempts',
    'firestore.writeFailures', 'firestore.transactionFailures', 'firestore.batchFailures', 'rtdb.readFailures', 'rtdb.writeFailures', 'rtdb.writes',
    'rtdb.listenerRegistrations', 'rtdb.listenerDeliveries', 'rtdb.listenerFailures', 'tasks.enqueueAttempts', 'tasks.enqueued', 'tasks.enqueueFailures',
    'tasks.deleteAttempts', 'tasks.deleted', 'tasks.billableUnits'].map(name => [name, 'count'])),
  ...Object.fromEntries(['rtdb.payloadReadBytes', 'rtdb.payloadWriteBytes', 'rtdb.downloadBytes', 'rtdb.uploadBytes', 'tasks.payloadJsonBytes',
    ...['googledrive', 'dropbox', 'osf'].flatMap(provider => [`provider.${provider}.requestContentBytes`, `provider.${provider}.responseContentBytes`])].map(name => [name, 'byte'])) };
export const memberOfReconciliation = name => [...reconciliation.split, ...reconciliation.consolidated].includes(name);
const bindings = {
  enqueueSessionTimeout: ['firestore', 'document', 'experiments/{experimentID}/sessions/{sessionId}'],
  enqueueSessionExport: ['firestore', 'document', 'experiments/{experimentID}/sessions/{sessionId}/export_jobs/{revision}'],
  onSessionConnectionWritten: ['database', 'ref', 'session_connections/{experimentID}/{sessionId}/{connectionId}'],
  finalizeDisconnectedSessions: ['database', 'ref', 'sessions/{experimentID}/{sessionId}'],
};
const origins = { apiData: 'http', processSessionTimeout: 'task', processSessionExportTask: 'task',
  ...Object.fromEntries(Object.entries(bindings).map(([name, [origin]]) => [name, origin])) };
const excluded = {
  apiDataComplete: 'Separate completion HTTP endpoint; the measured publication uses apiData completeSession.',
  publishExperiment: 'Publication is preparation, outside the participant runtime workload.',
  apiDeleteExperiment: 'Experiment administration is outside the participant runtime workload.',
  apiCondition: 'Separate condition HTTP endpoint; the current runtime registers through apiData.',
  uploadParticipantFile: 'Participant file upload HTTP endpoint is outside these declared response scenarios.',
  dropboxOAuthCallback: 'OAuth preparation is outside the participant runtime workload.',
  githubOAuthCallback: 'OAuth preparation is outside the participant runtime workload.',
  googleDriveOAuthCallback: 'OAuth preparation is outside the participant runtime workload.',
  osfOAuthCallback: 'OAuth preparation is outside the participant runtime workload.',
  osfManage: 'OSF administration is outside the participant runtime workload.',
  createOAuthStateEndpoint: 'OAuth preparation is outside the participant runtime workload.',
  getOAuthClientIds: 'OAuth preparation is outside the participant runtime workload.',
};
const fail = message => { throw new Error('Function inventory coverage: ' + message); };
const serial = value => JSON.parse(JSON.stringify(value));
export function functionMeasurements(entry) {
  const zeros = Object.fromEntries(Object.entries(entry.observer?.zeroMetrics || {}).map(([metric, unit]) => [metric,
    quantity(0, unit, { provenance: 'observed', source: entry.observer.source, environment: entry.observer.environment })]));
  return { ...zeros, ...entry.metrics };
}
export function functionInventory(exports) {
  const present = name => Object.hasOwn(exports, name);
  const form = reconciliation.split.every(present) && !reconciliation.consolidated.some(present) ? 'split'
    : reconciliation.consolidated.every(present) && !reconciliation.split.some(present) ? 'consolidated' : null;
  if (!form) fail('missing or overlapping reconciliation registrations');
  const runtime = { ...origins, ...Object.fromEntries(reconciliation[form].map(name => [name, 'schedule'])) };
  for (const name of Object.keys(runtime)) if (!present(name)) fail('missing registered endpoint: ' + name);
  const definitions = [], registered = [];
  for (const [name, handler] of Object.entries(exports).sort(([a], [b]) => a.localeCompare(b))) {
    if (!runtime[name] && !excluded[name]) fail('unobserved export: ' + name);
    const definition = registration(name, handler), endpoint = definition.endpoint;
    if (endpoint.platform !== 'gcfv2' || [endpoint.httpsTrigger, endpoint.eventTrigger, endpoint.scheduleTrigger, endpoint.taskQueueTrigger].filter(Boolean).length !== 1) fail('unsupported registration: ' + name);
    if (definition.origin !== (runtime[name] || 'http')) fail('unsupported origin: ' + name);
    if (runtime[name]) {
      if ((endpoint.region && (endpoint.region.length !== 1 || endpoint.region[0] !== 'us-central1'))
        || definition.location !== 'us-central1' || typeof definition.cpu !== 'number' || definition.cpu <= 0 || definition.cpu > 8
        || !Number.isInteger(definition.memoryMiB) || definition.memoryMiB < 128 || definition.memoryMiB > 32768 || definition.minInstances !== 0) fail('unsupported resource configuration: ' + name);
      if (definition.origin === 'schedule' && (definition.intervalMs !== 60000 || endpoint.scheduleTrigger.timeZone !== 'UTC'
        || Object.keys(serial(endpoint.scheduleTrigger.retryConfig || {})).length)) fail('unsupported schedule: ' + name);
      if (definition.origin === 'task') {
        const r = serial(definition.retry);
        if (!r || !Number.isInteger(r.maxAttempts) || r.maxAttempts < 1 || !(r.minBackoffSeconds > 0)
          || !(r.maxBackoffSeconds >= r.minBackoffSeconds) || !Number.isInteger(r.maxDoublings) || r.maxDoublings < 0
          || r.maxRetrySeconds != null) fail('unsupported task retries: ' + name);
      }
      if (bindings[name]) {
        const [origin, kind, pattern] = bindings[name], trigger = endpoint.eventTrigger;
        const type = origin === 'firestore' ? 'google.cloud.firestore.document.v1.written' : 'google.firebase.database.ref.v1.written';
        if (trigger.eventType !== type || trigger.eventFilterPathPatterns?.[kind]?.replace(/^\//, '') !== pattern
          || Object.keys(trigger.eventFilterPathPatterns || {}).some(key => ![kind, ...(origin === 'database' ? ['instance'] : [])].includes(key))
          || Object.keys(trigger.eventFilters || {}).some(key => !(origin === 'firestore' && ['database', 'namespace'].includes(key)))
          || (origin === 'database' && trigger.eventFilterPathPatterns.instance !== '*')
          || (origin === 'firestore' && (trigger.eventFilters?.database !== '(default)' || trigger.eventFilters?.namespace !== '(default)'))) fail('unsupported registered event binding: ' + name);
      }
      definitions.push(definition);
    }
    const { handler: implementation, ...record } = definition; void implementation;
    registered.push({ ...serial(record), coverage: runtime[name]
      ? { scope: 'runtime', reason: 'Registered handler observed by the HTTP boundary or binding-driven event/task/schedule dispatcher.' }
      : { scope: 'outside-workload', reason: excluded[name] } });
  }
  return { definitions, evidence: { version: 1, source: 'Actual api/functions/index.js exports and gcfv2 endpoint registrations', form, registered,
    responsibilities: [{ id: reconciliation.id, members: [...reconciliation[form]] }] } };
}

export function validateFunctionCoverage(scenario) {
  if (!scenario.functionInventory) return []; // Generic arithmetic captures have no persistence endpoint inventory.
  const issues = [], issue = (path, reason) => issues.push({ path, reason });
  try {
    const evidence = scenario.functionInventory;
    if (evidence.version !== 1 || !Array.isArray(evidence.registered) || new Set(evidence.registered.map(entry => entry.name)).size !== evidence.registered.length) fail('invalid/duplicate inventory records');
    const exports = Object.fromEntries(evidence.registered.map(record => [record.name, { run() {}, __endpoint: record.endpoint }]));
    const expected = functionInventory(exports);
    if (!isDeepStrictEqual(evidence, expected.evidence)) fail('inventory responsibilities/resources/bindings do not match registered endpoints');
    const runtime = expected.definitions.map(({ handler, ...definition }) => { void handler; return serial(definition); });
    if (!isDeepStrictEqual(serial(scenario.registrations), runtime)) fail('missing or changed runtime registration');
    for (const definition of runtime) {
      const observed = scenario.functions[definition.name], invocations = observed?.metrics?.['functions.invocations'];
      const measurements = observed ? functionMeasurements(observed) : {};
      if (!observed || !invocations || invocations.value === null || invocations.unit !== 'count'
        || !['observed', 'derived'].includes(invocations.provenance) || !isDeepStrictEqual(observed.origins, [definition.origin])) issue('/functions/' + definition.name, 'Missing/unobserved registered function; absence is not a measured zero');
      for (const [metric, unit] of Object.entries(memberOfReconciliation(definition.name) ? reconciliationMetricUnits : allocationMetricUnits)) {
        const value = measurements[metric];
        if (!value || value.value === null || value.unit !== unit || !['observed', 'derived', 'external'].includes(value.provenance)) issue('/functions/' + definition.name + '/metrics/' + metric, 'Missing/unknown function measurement');
      }
      for (const [metric, value] of Object.entries(observed?.metrics || {})) if (value.value === null) issue('/functions/' + definition.name + '/metrics/' + metric, 'Unknown function measurement');
    }
    for (const name of Object.keys(scenario.functions)) if (!runtime.some(definition => definition.name === name)) issue('/functions/' + name, 'Unknown or excluded function was invoked');
  } catch (error) { issue('/functionInventory', error.message); }
  return issues;
}

export function matchBinding(definition, origin, path) {
  if (definition.origin !== origin) return null;
  const pattern = definition.endpoint?.eventTrigger?.eventFilterPathPatterns?.[origin === 'firestore' ? 'document' : 'ref'];
  if (!pattern) return null;
  const expected = pattern.replace(/^\//, '').split('/'), actual = path.replace(/^\//, '').split('/');
  if (expected.length !== actual.length) return null;
  const params = {};
  for (const [index, segment] of expected.entries()) {
    if (/^\{\w+\}$/.test(segment)) params[segment.slice(1, -1)] = actual[index];
    else if (segment !== actual[index]) return null;
  }
  return params;
}
