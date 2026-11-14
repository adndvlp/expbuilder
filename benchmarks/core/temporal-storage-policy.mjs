import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { isDeepStrictEqual } from 'node:util';
import { validateConditions } from './calibration.mjs';
import { validateProfile } from './budget.mjs';
import { nonnegative } from './decimal.mjs';
import { repeatabilityIssues } from './repeatability.mjs';

const variants = ['low', 'nominal', 'high'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const field = value => typeof value === 'string' && value.trim().length > 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pointer = key => String(key).replaceAll('~', '~0').replaceAll('/', '~1');

function requireValue(condition, path, reason, status = 'invalid_input') {
  if (!condition) throw Object.assign(new Error(reason), { path, status, exitCode: status === 'incompatible' ? 4 : 6 });
}
function record(value, keys, path) {
  requireValue(object(value), path, 'Object required');
  requireValue(keys.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => keys.includes(key)), path, 'Missing or unsupported field');
}
function checkHashes(value, keys, path) {
  for (const key of keys) requireValue(digest(value[key]), path + '/' + key, 'SHA-256 fingerprint required');
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return JSON.stringify(value);
  throw new Error('Finite JSON data required');
}
const fingerprint = value => hash(canonical(value));
function compatible(condition, path, reason) {
  requireValue(condition, path, reason, 'incompatible');
}
function validateShape(policy) {
  record(policy, ['format', 'metrics', 'money', 'performance', 'temporalStorage'], '/policy');
  requireValue(policy.format === 1, '/policy/format', 'Unsupported policy format');
  for (const key of ['metrics', 'money', 'performance']) {
    requireValue(Array.isArray(policy[key]) && policy[key].length === 0, '/policy/' + key, 'Temporal policy cannot overlap generic allowances');
  }
  const declaration = policy.temporalStorage, path = '/policy/temporalStorage';
  record(declaration, ['component', 'unit', 'scope', 'review', 'limits'], path);
  requireValue(declaration.component === 'session-firestore-storage', path + '/component', 'Only per-session Firestore storage can be reviewed');
  requireValue(declaration.unit === 'byte-second', path + '/unit', 'Exact byte-second limits required');
  const scope = declaration.scope, s = path + '/scope';
  record(scope, ['baseline', 'conditionsSha256', 'assumptionsSha256', 'storageMethod', 'indexConfigurationSha256', 'profile', 'windowSeconds', 'billingPeriodSeconds', 'variants', 'volumes'], s);
  record(scope.baseline, ['id', 'referenceSha256', 'budgetSha256', 'measuredCodeSha256'], s + '/baseline');
  requireValue(field(scope.baseline.id), s + '/baseline/id', 'Named baseline required');
  checkHashes(scope.baseline, ['referenceSha256', 'budgetSha256', 'measuredCodeSha256'], s + '/baseline');
  checkHashes(scope, ['conditionsSha256', 'assumptionsSha256', 'indexConfigurationSha256'], s);
  record(scope.storageMethod, ['id', 'sha256'], s + '/storageMethod');
  requireValue(field(scope.storageMethod.id), s + '/storageMethod/id', 'Named storage method required');
  checkHashes(scope.storageMethod, ['sha256'], s + '/storageMethod');
  record(scope.profile, ['id', 'sha256', 'currency', 'basis'], s + '/profile');
  requireValue(field(scope.profile.id) && /^[A-Z]{3}$/.test(scope.profile.currency) && scope.profile.basis === 'gross', s + '/profile', 'Named gross currency profile required');
  checkHashes(scope.profile, ['sha256'], s + '/profile');
  for (const key of ['windowSeconds', 'billingPeriodSeconds']) requireValue(positiveInteger(scope[key]), s + '/' + key, 'Positive whole seconds required');
  requireValue(isDeepStrictEqual(scope.variants, variants), s + '/variants', 'All three reviewed variants required');
  requireValue(Array.isArray(scope.volumes) && scope.volumes.length > 0 && scope.volumes.every(positiveInteger)
    && new Set(scope.volumes).size === scope.volumes.length, s + '/volumes', 'Unique positive session volumes required');

  record(declaration.review, ['reason', 'specification', 'evidence'], path + '/review');
  for (const key of ['reason', 'specification']) requireValue(field(declaration.review[key]), path + '/review/' + key, 'Review reason and specification required');
  const evidence = declaration.review.evidence;
  record(evidence, ['file', 'sha256', 'candidateReferenceSha256', 'candidateMeasuredCodeSha256'], path + '/review/evidence');
  requireValue(field(evidence.file), path + '/review/evidence/file', 'Review evidence file required');
  checkHashes(evidence, ['sha256', 'candidateReferenceSha256', 'candidateMeasuredCodeSha256'], path + '/review/evidence');

  requireValue(Array.isArray(declaration.limits) && declaration.limits.length > 0, path + '/limits', 'Explicit scenario limits required');
  const names = new Set();
  for (const [index, limit] of declaration.limits.entries()) {
    const p = path + '/limits/' + index;
    record(limit, ['scenario', 'maxIncreaseByteSeconds', 'reason'], p);
    requireValue(field(limit.scenario) && !/[*?]/.test(limit.scenario) && limit.scenario !== 'idle' && !names.has(limit.scenario), p + '/scenario', 'Unique exact per-session scenario required');
    names.add(limit.scenario);
    requireValue(field(limit.reason), p + '/reason', 'Scenario review reason required');
    requireValue(typeof limit.maxIncreaseByteSeconds === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(limit.maxIncreaseByteSeconds), p + '/maxIncreaseByteSeconds', 'Nonnegative exact decimal string required');
    try { nonnegative(limit.maxIncreaseByteSeconds); }
    catch (error) { requireValue(false, p + '/maxIncreaseByteSeconds', error.message); }
  }
  return declaration;
}
function captureBundle(capture, path) {
  requireValue(object(capture?.bundle) && object(capture.files), path, 'Capture bundle and original file bytes required');
  for (const [name, key] of [['reference.json', 'reference'], ['budget.json', 'budgets']]) {
    const bytes = capture.files[name], p = path + '/files/' + pointer(name);
    requireValue(bytes instanceof Uint8Array && bytes.length > 0, p, 'Original capture bytes required');
    let decoded;
    try { decoded = JSON.parse(Buffer.from(bytes).toString('utf8')); }
    catch (error) { requireValue(false, p, 'Invalid capture JSON: ' + error.message); }
    requireValue(object(decoded) && isDeepStrictEqual(decoded, capture.bundle[key]), p, 'Decoded capture does not match its original bytes');
  }
  requireValue(capture.bundle.reference.format === 1, path + '/reference/format', 'Unsupported capture format');
  return capture.bundle;
}
function scenarioNames(scenarios, path) {
  requireValue(Array.isArray(scenarios) && scenarios.length > 0 && scenarios.every(s => field(s?.name)), path, 'Named scenarios required');
  const names = scenarios.map(s => s.name);
  requireValue(new Set(names).size === names.length, path, 'Unique captured scenarios required');
  return names;
}
function profileMatches(profile, scope, path) {
  compatible(object(profile) && profile.id === scope.profile.id && profile.currency === scope.profile.currency
    && profile.basis === scope.profile.basis && fingerprint(profile) === scope.profile.sha256, path, 'Price profile differs from reviewed scope');
  try { validateProfile(profile); }
  catch (error) { requireValue(false, path, error.message); }
}
function conditionsMatch(conditions, scope, path) {
  compatible(object(conditions) && fingerprint(conditions) === scope.assumptionsSha256, path, 'Assumptions differ from reviewed scope');
  try { validateConditions(conditions); }
  catch (error) { requireValue(false, path, error.message); }
}
function methodMatches(scenario, scope, path) {
  const model = scenario.storageModel, method = model?.method;
  compatible(object(method) && method.id === scope.storageMethod.id && method.sha256 === scope.storageMethod.sha256, path + '/method', 'Storage method differs from reviewed scope');
  const { sha256, ...definition } = method;
  compatible(fingerprint(definition) === sha256, path + '/method/sha256', 'Storage method fingerprint differs from its definition');
  const indexes = model.indexConfiguration;
  compatible(object(indexes?.value) && indexes.sha256 === scope.indexConfigurationSha256 && fingerprint(indexes.value) === indexes.sha256, path + '/indexConfiguration', 'Index configuration differs from reviewed scope');
}
function budgetMatches(budget, scope, path) {
  requireValue(object(budget) && Array.isArray(budget.items) && Array.isArray(budget.projections), path, 'Captured budget required');
  profileMatches(budget.profile, scope, path + '/profile');
  compatible(budget.windowSeconds === scope.windowSeconds, path + '/windowSeconds', 'Horizon differs from reviewed scope');
  compatible(isDeepStrictEqual(budget.projections.map(p => p?.sessions), scope.volumes), path + '/projections', 'Session projections differ from reviewed scope');
  const items = budget.items.filter(item => item?.id === 'session-firestore-storage');
  compatible(items.length === 1, path + '/items', 'Exactly one per-session storage component required');
  const item = items[0], p = path + '/items/session-firestore-storage';
  compatible(item.scope === 'per-session' && item.service === 'firestore' && item.rate === 'firestore-storage'
    && item.quantity?.unit === 'GiB-month', p, 'Storage component scope or units differ');
  const inputs = item.quantity.inputs;
  compatible(Array.isArray(inputs) && inputs.length === 1 && inputs[0]?.windowSeconds === scope.windowSeconds
    && inputs[0]?.billingPeriodSeconds === scope.billingPeriodSeconds && inputs[0]?.representation === 'stored-including-indexes', p + '/quantity/inputs', 'Storage integration scope differs');
}
function validateCapture(bundle, scope, path) {
  const { reference, budgets } = bundle;
  const names = scenarioNames(reference.scenarios, path + '/reference/scenarios');
  compatible(reference.repeatability?.sha256 === scope.conditionsSha256, path + '/reference/repeatability', 'Workload differs from reviewed scope');
  const issues = repeatabilityIssues(reference);
  compatible(issues.length === 0, path + '/reference' + (issues[0]?.path || '/repeatability'), issues[0]?.reason);
  for (const scenario of reference.scenarios) methodMatches(scenario, scope, path + '/reference/scenarios/' + pointer(scenario.name) + '/storageModel');
  conditionsMatch(budgets.assumptions, scope, path + '/budgets/assumptions');
  const budgetNames = scenarioNames(budgets.scenarios, path + '/budgets/scenarios');
  requireValue(isDeepStrictEqual(budgetNames.toSorted(), names.filter(name => name !== 'idle').toSorted()), path + '/budgets/scenarios', 'Budget scenarios differ from captured scenarios');
  for (const scenario of budgets.scenarios) for (const variant of variants) {
    budgetMatches(scenario[variant], scope, path + '/budgets/scenarios/' + pointer(scenario.name) + '/' + variant);
  }
  requireValue(Array.isArray(budgets.idle) && budgets.idle.length > 0, path + '/budgets/idle', 'Idle budgets required');
  // Idle reports include minute/day/month windows; only their profile is pinned here.
  for (const [index, budget] of budgets.idle.entries()) profileMatches(budget?.profile, scope, path + '/budgets/idle/' + index + '/profile');
  return names;
}

/** Validates a declaration and its capture scope; does not authorize any increase. */
export function validateTemporalStoragePolicy(policy, context) {
  const declaration = validateShape(policy), scope = declaration.scope;
  requireValue(object(context) && Object.hasOwn(context, 'baseline') && Object.hasOwn(context, 'candidate'), '/context', 'Both captures required');
  requireValue(Object.keys(context).every(key => ['baseline', 'candidate', 'profile', 'conditions', 'windowSeconds', 'volumes'].includes(key)), '/context', 'Unsupported validation option');
  const baseline = captureBundle(context.baseline, '/baseline'), candidate = captureBundle(context.candidate, '/candidate');
  for (const [name, expected] of [['reference.json', scope.baseline.referenceSha256], ['budget.json', scope.baseline.budgetSha256]]) {
    compatible(hash(context.baseline.files[name]) === expected, '/baseline/files/' + name, 'Baseline bytes differ from reviewed B0');
  }
  compatible(baseline.reference.measuredCode?.sha256 === scope.baseline.measuredCodeSha256, '/baseline/reference/measuredCode', 'Baseline code differs from reviewed B0');
  const before = validateCapture(baseline, scope, '/baseline'), after = validateCapture(candidate, scope, '/candidate');
  for (const [index, limit] of declaration.limits.entries()) requireValue(before.includes(limit.scenario) && after.includes(limit.scenario), '/policy/temporalStorage/limits/' + index + '/scenario', 'Reviewed scenario absent from captures');
  if (Object.hasOwn(context, 'profile')) profileMatches(context.profile, scope, '/context/profile');
  if (Object.hasOwn(context, 'conditions')) conditionsMatch(context.conditions, scope, '/context/conditions');
  for (const key of ['windowSeconds', 'volumes']) if (Object.hasOwn(context, key)) compatible(isDeepStrictEqual(context[key], scope[key]), '/context/' + key, 'Effective calculation scope differs from review');
  // Origin candidate hashes document the review, without pinning future candidate code or hosts.
  return globalThis.structuredClone(policy);
}
