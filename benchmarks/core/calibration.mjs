import { convertQuantity, quantity } from './quantity.mjs';

const parameters = {
  baseMs: ['millisecond', 0], firestoreReadMs: ['millisecond', 0], firestoreCommitMs: ['millisecond', 0],
  realtimeMs: ['millisecond', 0], providerMs: ['millisecond', 0], startupMs: ['millisecond', 0],
  coldFraction: ['count', 0, 1], networkFactor: ['count', 1], protocolBytes: ['byte', 0],
  logBytesPerInvocation: ['byte', 0], rtdbStoredFactor: ['count', 1],
};
export function validateConditions(conditions) {
  if (!conditions || !conditions.source?.trim()) throw new Error('Conditions source required');
  for (const variant of ['low', 'nominal', 'high']) for (const [name, [unit, min, max]] of Object.entries(parameters)) {
    const value = conditions[variant]?.[name];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || (max !== undefined && value > max)
        || (unit === 'byte' && !Number.isSafeInteger(value))) throw new Error('Invalid conditions parameter: ' + variant + '.' + name);
  }
  for (const name of Object.keys(parameters)) if (conditions.low[name] > conditions.nominal[name] || conditions.nominal[name] > conditions.high[name]) throw new Error('Invalid low/nominal/high range: ' + name);
  for (const field of ['placement', 'compute', 'network', 'retention', 'logs', 'exclusions']) if (!conditions[field]) throw new Error('Missing conditions: ' + field);
  if (conditions.placement.firestore !== 'nam5' || conditions.placement.functions !== 'us-central1'
      || !/^us-central1(?: \(assumed\))?$/.test(conditions.placement.realtime)
      || conditions.placement.providersAndClients !== 'North America') throw new Error('Incompatible model placement: select tariffs and a model for that location');
  return conditions;
}
export function applyCalibration(conditions, calibration) {
  validateConditions(conditions);
  if (calibration?.format !== 1 || !calibration.id?.trim() || !calibration.source?.trim() || !calibration.environment?.trim()
      || typeof calibration.recordedAt !== 'string' || !Number.isFinite(Date.parse(calibration.recordedAt))) throw new Error('External calibration identity, source, date and environment required');
  if (!calibration.parameters || !Object.keys(calibration.parameters).length) throw new Error('Calibration parameters required');
  const result = globalThis.structuredClone(conditions), evidence = globalThis.structuredClone(calibration);
  for (const [path, input] of Object.entries(calibration.parameters)) {
    const [variant, name, extra] = path.split('.'), rule = parameters[name];
    if (!['low', 'nominal', 'high'].includes(variant) || !rule || extra !== undefined) throw new Error('Unsupported calibration parameter: ' + path);
    const valid = quantity(input.value, input.unit, input);
    if (valid.provenance !== 'external' || valid.value === null) throw new Error('External, known calibration quantities required');
    const normalized = convertQuantity(valid, rule[0]);
    result[variant][name] = Number(normalized.value);
    evidence.parameters[path] = normalized;
  }
  validateConditions(result);
  return { conditions: result, evidence };
}
