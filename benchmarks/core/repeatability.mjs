import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const pointer = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
function required(condition, path, reason) {
  if (!condition) throw Object.assign(new Error(reason), { path });
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return JSON.stringify(value);
  throw new Error('Repeatability conditions must contain finite JSON data');
}
export function createRepeatabilityContract(scenarios, fixture) {
  required(object(fixture) && typeof fixture.id === 'string' && fixture.id.trim(), '/repeatability/conditions/fixture/id', 'Named fixture definition required');
  required(object(fixture.sources) && Object.keys(fixture.sources).length > 0
    && Object.values(fixture.sources).every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)), '/repeatability/conditions/fixture/sources', 'Fixture source fingerprints required');
  required(Array.isArray(scenarios) && scenarios.length > 0 && new Set(scenarios.map(s => s.name)).size === scenarios.length, '/repeatability/conditions/scenarios', 'Unique scenario definitions required');
  const definitions = scenarios.map(({ name, inputs, controlledInputs }, index) => {
    const path = '/repeatability/conditions/scenarios/' + index;
    required(typeof name === 'string' && name.trim() && object(inputs), path, 'Scenario name and inputs required');
    required(object(controlledInputs), path + '/controlledInputs', 'Controlled inputs required');
    const c = controlledInputs;
    for (const [key, valid] of Object.entries({ scenario: c.scenario === name, seed: typeof c.seed === 'string' && c.seed.trim(),
      epoch: Number.isSafeInteger(c.epoch) && c.epoch >= 0, responseMs: Number.isSafeInteger(c.responseMs) && c.responseMs > 0,
      participantEnvironment: object(c.participantEnvironment) && Object.keys(c.participantEnvironment).length > 0,
      timing: object(c.timing) && Object.keys(c.timing).length > 0 })) required(valid, path + '/controlledInputs/' + key, 'Missing/invalid repetition condition: ' + key);
    const timing = c.timing, timingPath = path + '/controlledInputs/timing';
    required(timing.epoch === c.epoch && timing.provenance === 'assumed' && typeof timing.source === 'string' && timing.source.trim(), timingPath, 'Invalid timing calendar identity/provenance');
    required(object(timing.operationMs) && Object.keys(timing.operationMs).length > 0
      && Object.values(timing.operationMs).every(ms => Number.isSafeInteger(ms) && ms > 0), timingPath + '/operationMs', 'Positive timing operation durations required');
    required(Number.isSafeInteger(timing.disconnectAfterMs) && timing.disconnectAfterMs > 0, timingPath + '/disconnectAfterMs', 'Positive timing disconnect interval required');
    for (const key of ['httpDelivery', 'participantSchedule', 'realtimeCalendar']) required(typeof timing[key] === 'string' && timing[key].trim(), timingPath + '/' + key, 'Missing timing rule: ' + key);
    // Select recipes, never operation results, elapsed time, samples, RSS or code revision.
    return globalThis.structuredClone({ name, inputs, controlledInputs });
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const content = { version: 1, conditions: { fixture: globalThis.structuredClone(fixture), scenarios: definitions } };
  return { ...content, sha256: createHash('sha256').update(canonical(content)).digest('hex') };
}
export function conditionDifferences(before, after, path = '/repeatability/conditions') {
  if (isDeepStrictEqual(before, after)) return [];
  if ((object(before) && object(after)) || (Array.isArray(before) && Array.isArray(after))) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().flatMap(key => conditionDifferences(before[key], after[key], path + '/' + pointer(key)));
  }
  return [{ path, before: before ?? null, after: after ?? null }];
}
export function repeatabilityIssues(reference) {
  const contract = reference.repeatability;
  if (!object(contract)) return [{ path: '/repeatability', reason: 'Missing repetition contract; historical captures are not converted' }];
  if (contract.version !== 1) return [{ path: '/repeatability/version', reason: 'Unsupported repetition contract' }];
  try {
    const expected = createRepeatabilityContract(reference.scenarios, contract.conditions?.fixture);
    const differences = conditionDifferences(contract.conditions, expected.conditions);
    if (differences.length) return differences.map(d => ({ ...d, reason: 'Contract conditions do not match captured scenario inputs' }));
    if (contract.sha256 !== expected.sha256) return [{ path: '/repeatability/sha256', reason: 'Condition fingerprint does not match its declared recipe' }];
    return [];
  } catch (error) {
    return [{ path: error.path || '/repeatability/conditions', reason: error.message }];
  }
}
