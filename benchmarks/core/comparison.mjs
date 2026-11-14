import { isDeepStrictEqual } from 'node:util';
import { add, compare, decimal, divide, multiply, nonnegative, subtract } from './decimal.mjs';
import { convertQuantity, quantity, quantityValue } from './quantity.mjs';
import { validateProfile } from './budget.mjs';
import { applyCalibration, validateConditions } from './calibration.mjs';
import { referenceBudgets } from '../persistence/budget.mjs';
import { conditionDifferences, repeatabilityIssues } from './repeatability.mjs';

export const exitCodes = Object.freeze({ passed: 0, regression: 2, incomplete: 3, incompatible: 4, functional_failure: 5, invalid_input: 6 });
const priority = ['passed', 'regression', 'incomplete', 'incompatible', 'functional_failure', 'invalid_input'];
const clone = value => globalThis.structuredClone(value);
const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const field = value => typeof value === 'string' && value.trim();
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const same = isDeepStrictEqual;
const variants = ['low', 'nominal', 'high'];
function unique(items, key, label) {
  if (!Array.isArray(items) || !items.length || new Set(items.map(item => item[key])).size !== items.length) throw new Error('Missing/duplicate ' + label);
}
function validateBundle(bundle) {
  const { reference, budgets } = bundle || {};
  if (reference?.format !== 1) return false;
  if (!object(reference.machine) || !field(reference.revision)) throw new Error('Reference machine and revision required');
  unique(reference.scenarios, 'name', 'scenarios');
  for (const scenario of reference.scenarios) {
    if (!field(scenario.name) || !object(scenario.inputs) || !object(scenario.metrics) || !object(scenario.functions)
        || !Array.isArray(scenario.coverageIssues) || !object(scenario.functional) || !object(scenario.inventory)) throw new Error('Invalid scenario: ' + scenario.name);
    unique(scenario.registrations, 'name', 'registrations');
    for (const metrics of [scenario.metrics, ...Object.values(scenario.functions).map(fn => fn.metrics)]) {
      if (!object(metrics)) throw new Error('Missing metric map');
      for (const input of Object.values(metrics)) quantity(input.value, input.unit, input);
    }
  }
  if (!budgets?.assumptions || !Array.isArray(budgets.scenarios) || !budgets.idle?.length) throw new Error('Captured budget and conditions required');
  const names = reference.scenarios.filter(s => s.name !== 'idle').map(s => s.name).sort();
  if (!same(names, budgets.scenarios.map(s => s.name).sort())) throw new Error('Captured budget scenarios do not match measurements');
  for (const budget of [...budgets.idle, ...budgets.scenarios.flatMap(s => variants.map(key => s[key]))]) {
    if (!budget?.profile || !Array.isArray(budget.items) || !Array.isArray(budget.projections) || !field(budget.scope)) throw new Error('Invalid captured budget');
    validateProfile(budget.profile);
  }
  validateConditions(budgets.assumptions);
  return true;
}
function configuration(bundle) {
  const budget = bundle.budgets.scenarios[0]?.nominal || bundle.budgets.idle.at(-1);
  return { profile: budget.profile, windowSeconds: budget.windowSeconds,
    volumes: bundle.budgets.scenarios[0]?.nominal.projections.map(p => p.sessions) || [0], conditions: bundle.budgets.assumptions };
}
function tariffValues(profile) {
  return { currency: profile.currency, basis: profile.basis, rates: Object.fromEntries(Object.entries(profile.rates).map(([id, input]) => {
    const rate = { ...input }; delete rate.source; delete rate.zeroReason;
    for (const key of ['price', 'per', 'minimum', 'roundTo']) if (rate[key] !== undefined) rate[key] = decimal(rate[key]);
    if (rate.tiers) rate.tiers = rate.tiers.map(tier => ({ upTo: tier.upTo === null ? null : decimal(tier.upTo), price: decimal(tier.price) }));
    return [id, rate];
  })) };
}
export function recalculateCapture(bundle) {
  if (!validateBundle(bundle)) throw new Error('Unsupported reference format');
  const selected = configuration(bundle);
  return referenceBudgets(bundle.reference, selected.profile, { windowSeconds: selected.windowSeconds, volumes: selected.volumes,
    conditions: selected.conditions, calibration: bundle.budgets.calibration });
}
function scopes(bundle) {
  return { idle: bundle.budgets.idle.map(budget => budget.scope), scenarios: bundle.budgets.scenarios.map(scenario => ({ name: scenario.name, scopes: variants.map(key => scenario[key].scope) })).sort((a, b) => a.name.localeCompare(b.name)) };
}
function metricsFor(scenario) {
  const result = new Map();
  const put = (path, input, kind = 'metric') => result.set(path, { input, kind });
  for (const [name, input] of Object.entries(scenario.metrics)) put('/metrics/' + escape(name), input, name.includes('localDuration') || name.includes('sampledRss') ? 'performance' : 'metric');
  for (const [name, fn] of Object.entries(scenario.functions)) {
    for (const [metric, input] of Object.entries(fn.metrics)) put(`/functions/${escape(name)}/metrics/${escape(metric)}`, input, metric.includes('localDuration') || metric.includes('sampledRss') ? 'performance' : 'metric');
    if (fn.sampledRssMaxBytes !== undefined) put(`/functions/${escape(name)}/sampledRssMaxBytes`, quantity(fn.sampledRssMaxBytes, 'byte', {
      provenance: 'observed', source: fn.memoryScope || 'Local process RSS sample', environment: scenario.environment }), 'performance');
  }
  for (const [collection, inventory] of Object.entries(scenario.inventory)) for (const [name, value] of Object.entries(inventory)) put(`/inventory/${escape(collection)}/${escape(name)}`, quantity(value, name.endsWith('Bytes') ? 'byte' : 'count', {
    provenance: 'derived', source: 'Verified retained inventory; stored bytes include modeled indexes' }));
  if (scenario.retainedRtdbJsonBytes !== undefined) put('/retainedRtdbJsonBytes', quantity(scenario.retainedRtdbJsonBytes, 'byte', { provenance: 'derived', source: 'RTDB retained JSON, not full protocol/storage representation' }));
  return result;
}
function policyRules(policy) {
  if (policy === undefined) policy = { format: 1 };
  if (policy.format !== 1 || Object.keys(policy).some(key => !['format', 'metrics', 'money', 'performance'].includes(key))) throw new Error('Unsupported policy format/field');
  const result = [];
  for (const group of ['metrics', 'money', 'performance']) {
    if (policy[group] !== undefined && !Array.isArray(policy[group])) throw new Error('Policy rules must be arrays');
    for (const rule of policy[group] || []) {
      const keys = ['scenario', 'path', 'unit', 'currency', 'max', 'maxIncreaseAbsolute', 'maxIncreasePercent', 'reason', 'machine', 'minimumSamples'];
      if (!object(rule) || Object.keys(rule).some(key => !keys.includes(key)) || !field(rule.scenario) || !field(rule.path) || !field(rule.reason)) throw new Error('Policy selector/review reason required');
      if (group === 'money' ? !field(rule.currency) : !field(rule.unit)) throw new Error('Policy currency/unit required');
      if (!['max', 'maxIncreaseAbsolute', 'maxIncreasePercent'].some(key => rule[key] !== undefined)) throw new Error('Policy limit required');
      for (const key of ['max', 'maxIncreaseAbsolute', 'maxIncreasePercent']) if (rule[key] !== undefined) nonnegative(rule[key], 'policy limit');
      if (group === 'performance' && (!object(rule.machine) || !Number.isSafeInteger(rule.minimumSamples) || rule.minimumSamples < 1)) throw new Error('Performance machine, sample requirement and tolerance required');
      if (result.some(entry => entry.group === group && entry.rule.scenario === rule.scenario && entry.rule.path === rule.path)) throw new Error('Duplicate policy selector');
      result.push({ group, rule: clone(rule), matched: 0 });
    }
  }
  return result;
}
function delta(before, after) {
  if (before === null || after === null) return { before, after, delta: null, percent: null, state: 'unknown' };
  const difference = subtract(after, before), order = compare(after, before);
  return { before: decimal(before), after: decimal(after), delta: decimal(difference),
    percent: compare(before, 0) ? decimal(multiply(divide(difference, before), 100)) : null,
    state: order > 0 ? (compare(before, 0) === 0 ? 'new' : 'increased') : order < 0 ? 'decreased' : 'unchanged' };
}

export function compareReferences(options) {
  const report = { format: 1, status: 'passed', exitCode: 0, issues: [], scenarios: [],
    policy: clone(options.policy || { format: 1 }), normalization: {},
    scope: 'Regression check of measured quantities and modeled runtime cost; passing does not approve the captured consumption as a target' };
  const issue = (status, code, reason, context = {}) => { report.issues.push({ status, code, reason, ...context }); if (priority.indexOf(status) > priority.indexOf(report.status)) report.status = status; };
  function finish() {
    // A permitted decrease is different from exact repetition. Preserve both
    // conclusions so repeated runs cannot pass equality just by costing less.
    report.equality = report.scenarios.length && report.scenarios.every(s => s.quantities.length && s.money.length) ? {
      measurements: report.scenarios.every(s => s.metrics.filter(row => row.kind !== 'performance').every(row => row.state === 'unchanged')),
      storage: report.scenarios.every(s => same(s.storage.baseline, s.storage.candidate)),
      quantities: report.scenarios.every(s => s.quantities.every(row => row.state === 'unchanged')),
      money: report.scenarios.every(s => s.money.every(row => row.state === 'unchanged')),
      functional: report.scenarios.every(s => same(s.functional.baseline, s.functional.candidate)),
    } : null;
    report.exitCode = exitCodes[report.status]; return report;
  }
  try {
    const { baseline, candidate } = options;
    if (!validateBundle(baseline) || !validateBundle(candidate)) { issue('incompatible', 'unsupported_format', 'Only captured reference format 1 is supported'); return finish(); }
    report.captures = Object.fromEntries([['baseline', baseline], ['candidate', candidate]].map(([name, bundle]) => [name, {
      revision: bundle.reference.revision, measuredCode: clone(bundle.reference.measuredCode || null),
      createdAt: bundle.reference.createdAt, machine: clone(bundle.reference.machine),
      benchmarkRuntimeMs: bundle.reference.benchmarkRuntimeMs,
      repeatability: clone(bundle.reference.repeatability || null),
    }]));
    for (const [capture, bundle] of [['baseline', baseline], ['candidate', candidate]]) {
      for (const detail of repeatabilityIssues(bundle.reference)) issue('incompatible', 'repeatability', detail.reason, { ...detail, capture });
    }
    if (report.status === 'incompatible') return finish();
    for (const detail of conditionDifferences(baseline.reference.repeatability.conditions, candidate.reference.repeatability.conditions)) {
      issue('incompatible', 'repeatability', 'Repetition conditions differ; machine normalization does not change the workload', detail);
    }
    if (report.status === 'incompatible') return finish();
    const baselineNames = baseline.reference.scenarios.map(s => s.name).sort(), candidateNames = candidate.reference.scenarios.map(s => s.name).sort();
    if (!same(baselineNames, candidateNames)) { issue('incompatible', 'scenario_set', 'Scenario additions/omissions require an explicitly reviewed common workload', { baseline: baselineNames, candidate: candidateNames }); return finish(); }
    const rules = policyRules(options.policy), left = configuration(baseline), right = configuration(candidate);
    const normalization = options.normalization === undefined ? {} : options.normalization;
    if (!object(normalization) || (normalization.allowMachineDifference !== undefined && typeof normalization.allowMachineDifference !== 'boolean')) throw new Error('Invalid normalization object/boolean');
    if (Object.keys(normalization).some(key => !['reason', 'allowMachineDifference'].includes(key))) throw new Error('Unsupported normalization option');
    const reviewed = () => { if (!field(normalization.reason)) throw new Error('Explicit normalization reason required'); report.normalization.reason = normalization.reason; };
    if (normalization.allowMachineDifference) reviewed();
    if (!same(baseline.reference.machine, candidate.reference.machine)) {
      if (!normalization.allowMachineDifference) issue('incompatible', 'machine', 'Machine/runtime conditions differ');
      else { reviewed(); report.normalization.machineDifference = { baseline: baseline.reference.machine, candidate: candidate.reference.machine }; }
    }
    if (!same(left.conditions, right.conditions) && !options.conditions) issue('incompatible', 'conditions', 'Workload model conditions differ; select common conditions explicitly');
    if (!same(left.windowSeconds, right.windowSeconds) && options.windowSeconds === undefined) issue('incompatible', 'horizon', 'Budget horizons differ');
    if (!same(left.volumes, right.volumes) && options.volumes === undefined) issue('incompatible', 'volumes', 'Budget volumes differ');
    if (!same(scopes(baseline), scopes(candidate))) issue('incompatible', 'scope', 'Captured monetary scopes differ');
    if (left.profile.currency !== right.profile.currency && !options.profile) issue('incompatible', 'currency', 'Currencies differ; explicit common repricing profile required');
    const windowSeconds = options.windowSeconds ?? left.windowSeconds, volumes = options.volumes || left.volumes;
    if (options.windowSeconds !== undefined || options.volumes) { reviewed(); report.normalization.projection = { windowSeconds, volumes }; }
    let conditions = options.conditions || left.conditions;
    if (options.conditions) { reviewed(); report.normalization.conditions = clone(conditions); }
    if (options.calibration) {
      const calibrated = applyCalibration(conditions, options.calibration); conditions = calibrated.conditions; report.calibration = calibrated.evidence;
    }
    const selectedProfile = options.profile || left.profile; validateProfile(selectedProfile);
    report.pricing = { profile: clone(selectedProfile), sourcePricesDiffer: !same(tariffValues(left.profile), tariffValues(right.profile)), sourceProfilesDiffer: !same(left.profile, right.profile),
      baselineProfile: { id: left.profile.id, currency: left.profile.currency }, candidateProfile: { id: right.profile.id, currency: right.profile.currency }, recalculatedFromMeasurements: true };
    report.conditions = clone(conditions);
    function assess(row, name, group, pricedQuantity = false, exact = row) {
      const matching = rules.filter(entry => entry.group === group && [name, '*'].includes(entry.rule.scenario) && [row.path, '*'].includes(entry.rule.path)
        && (entry.rule.path !== '*' || (group === 'money' ? entry.rule.currency === row.unit : entry.rule.unit === row.unit)));
      if (matching.length > 1) throw new Error('Overlapping policy rules: ' + name + row.path);
      const entry = matching[0], rule = entry?.rule;
      if (entry) {
        entry.matched++;
        if ((group === 'money' ? rule.currency : rule.unit) !== row.unit) throw new Error('Policy unit/currency mismatch: ' + row.path);
        if (group === 'performance' && (!same(rule.machine, baseline.reference.machine) || !same(rule.machine, candidate.reference.machine)
            || (baseline.reference.samplesPerScenario ?? 1) < rule.minimumSamples || (candidate.reference.samplesPerScenario ?? 1) < rule.minimumSamples)) {
          issue('incompatible', 'performance_conditions', 'Performance tolerance has incompatible machine/sample conditions', { scenario: name, path: row.path }); return;
        }
      }
      const applies = pricedQuantity || group === 'money' || (group === 'metrics' && row.unit === 'count') || Boolean(rule);
      row.gated = applies; if (rule) row.review = clone(rule);
      if (!applies || exact.after === null) return;
      const base = exact.before ?? '0', absolute = nonnegative(rule?.maxIncreaseAbsolute || 0), relative = multiply(base, divide(rule?.maxIncreasePercent || 0, 100));
      const allowance = compare(absolute, relative) > 0 ? absolute : relative;
      row.allowedIncrease = decimal(allowance);
      if (compare(exact.after, add(base, allowance)) > 0 || (rule?.max !== undefined && compare(exact.after, rule.max) > 0)) {
        issue('regression', 'limit_exceeded', 'Candidate exceeds the reviewed quantity/cost limit', { scenario: name, path: row.path, unit: row.unit, before: row.before, after: row.after });
      }
    }
    for (const before of baseline.reference.scenarios) {
      const after = candidate.reference.scenarios.find(s => s.name === before.name), name = before.name;
      const result = { name, inputs: { baseline: clone(before.inputs), candidate: clone(after.inputs) }, metrics: [], quantities: [], money: [], implementationChanges: [] }; report.scenarios.push(result);
      result.functional = { baseline: clone(before.functional), candidate: clone(after.functional) };
      const storage = scenario => ({ timeline: clone(scenario.storageTimeline ?? null), timing: scenario.storageTiming ? {
        elapsedMs: scenario.storageTiming.elapsedMs, operations: clone(scenario.storageTiming.operations), actions: clone(scenario.storageTiming.actions),
      } : null });
      result.storage = { baseline: storage(before), candidate: storage(after) };
      if (!same(before.inputs, after.inputs)) issue('incompatible', 'workload', 'Scenario inputs differ', { scenario: name });
      if (before.environment !== after.environment) {
        if (!normalization.allowMachineDifference) issue('incompatible', 'environment', 'Measurement environments differ', { scenario: name });
        else (report.normalization.environments ||= []).push({ scenario: name, before: before.environment, after: after.environment });
      }
      if (before.functional.passed && after.functional.passed) for (const [key, value] of Object.entries(before.functional)) {
        if (key === 'passed' || key === 'reason') continue;
        if (!Object.hasOwn(after.functional, key)) issue('incomplete', 'functional_evidence_missing', 'Existing functional evidence disappeared', { scenario: name, path: '/functional/' + key });
        else if (!same(value, after.functional[key])) issue('functional_failure', 'functional_result', 'Functional result differs for the same workload', { scenario: name, path: '/functional/' + key });
      }
      for (const scenario of [before, after]) {
        if (!scenario.functional.passed) issue('functional_failure', 'functional_check', 'Functional CSV check failed', { scenario: name });
        if (scenario.coverageIssues.length || !scenario.inventoryVerifiedAgainstEmulator || !scenario.pending || Object.values(scenario.pending).some(value => value !== 0)) issue('incomplete', 'coverage', 'Coverage, verified inventory or pending work is incomplete', { scenario: name });
        const requiredMetrics = ['functions.invocations', 'firestore.readUnits', 'firestore.indexReadUnits', 'firestore.writes', 'firestore.deletes',
          'firestore.readCalls', 'firestore.transactionAttempts', 'firestore.batchAttempts', 'firestore.directWriteCalls'];
        // Persistence workload: idle has no participant transport. Other scenarios
        // exercise these observers even when an applicable operation measures zero.
        if (name !== 'idle') requiredMetrics.push('tasks.billableUnits', 'events.published', 'events.publishedPayloadBytes', 'events.deliveredPayloadBytes',
          'rtdb.downloadBytes', 'rtdb.disconnectRegistrations', 'rtdb.readCalls', 'rtdb.writeAttempts', 'http.requests', 'http.responseContentBytes',
          `provider.${scenario.inputs.provider || 'googledrive'}.requests`, `provider.${scenario.inputs.provider || 'googledrive'}.requestContentBytes`);
        for (const metric of requiredMetrics) {
          if (!Object.hasOwn(scenario.metrics, metric)) issue('incomplete', 'metric_missing', 'Required cost measurement is absent, not a measured zero', { scenario: name, path: '/metrics/' + metric });
        }
        for (const field of ['storageTimeline', 'retainedRtdbJsonBytes']) {
          if (scenario[field] === undefined || (field === 'storageTimeline' && (!Array.isArray(scenario[field]) || !scenario[field].length))) issue('incomplete', 'storage_missing', 'Storage measurement is missing', { scenario: name, path: '/' + field });
        }
      }
      for (const reg of before.registrations) {
        const next = after.registrations.find(entry => entry.name === reg.name);
        for (const key of ['cpu', 'memoryMiB', 'minInstances', 'location', 'intervalMs', 'endpoint']) if (!same(reg[key], next?.[key])) result.implementationChanges.push({ path: `/registrations/${escape(reg.name)}/${key}`, before: reg[key] ?? null, after: next?.[key] ?? null });
      }
      for (const reg of after.registrations) if (!before.registrations.some(entry => entry.name === reg.name)) result.implementationChanges.push({ path: '/registrations/' + escape(reg.name), before: null, after: clone(reg) });
      const a = metricsFor(before), b = metricsFor(after);
      for (const path of new Set([...a.keys(), ...b.keys()])) {
        let first = a.get(path), second = b.get(path);
        const collection = path.startsWith('/inventory/') ? path.split('/')[2].replaceAll('~1', '/').replaceAll('~0', '~') : null;
        if (!second && collection && !Object.hasOwn(after.inventory, collection) && after.inventoryVerifiedAgainstEmulator) second = { ...first, input: quantity(0, first.input.unit, { provenance: 'not-applicable', source: 'Collection absent in independently verified retained inventory' }) };
        if (!first && collection && !Object.hasOwn(before.inventory, collection) && before.inventoryVerifiedAgainstEmulator) first = { ...second, input: quantity(0, second.input.unit, { provenance: 'not-applicable', source: 'Collection absent in independently verified retained inventory' }) };
        if (!second) { result.metrics.push({ path, before: first.input.value, after: null, delta: null, percent: null, state: 'missing', unit: first.input.unit }); issue('incomplete', 'metric_missing', 'A measured metric disappeared; it is not a measured zero', { scenario: name, path }); continue; }
        const unit = first?.input.unit || second.input.unit;
        const next = convertQuantity(second.input, unit), previous = first ? convertQuantity(first.input, unit) : null;
        if (first && ['observed', 'derived', 'external'].includes(first.input.provenance) && second.input.provenance === 'assumed') issue('incomplete', 'measurement_downgrade', 'Measured/derived evidence was replaced by an assumption', { scenario: name, path });
        const row = { path, unit, kind: second.kind, ...delta(previous?.value ?? (first ? null : '0'), next.value) };
        if (first && (first.input.source !== second.input.source || first.input.provenance !== second.input.provenance)) row.evidenceChange = {
          before: { provenance: first.input.provenance, source: first.input.source }, after: { provenance: second.input.provenance, source: second.input.source } };
        if (!first) { row.state = next.value === null ? 'unknown' : 'new'; row.percent = null; }
        if (row.state === 'unknown') issue('incomplete', 'quantity_unknown', 'A comparison quantity is unknown', { scenario: name, path });
        if (previous && next.value !== null && previous.value !== null) Object.assign(row, delta(quantityValue(previous), quantityValue(next)));
        assess(row, name, second.kind === 'performance' ? 'performance' : 'metrics'); result.metrics.push(row);
      }
    }
    if (report.status !== 'passed') {
      // Invalid workloads/coverage never become an approved cost improvement.
      if (priority.indexOf(report.status) >= priority.indexOf('incomplete')) return finish();
    }
    const settings = { windowSeconds, volumes, conditions, calibration: report.calibration };
    const a = referenceBudgets(baseline.reference, selectedProfile, settings), b = referenceBudgets(candidate.reference, selectedProfile, settings);
    const quantityRows = (target, before, after, prefix, name) => {
      const firstItems = new Map(before.items.map(item => [item.id, item])), nextItems = new Map(after.items.map(item => [item.id, item]));
      for (const id of new Set([...firstItems.keys(), ...nextItems.keys()])) {
        const first = firstItems.get(id), second = nextItems.get(id);
        if (!second?.quantity || (first && !first.quantity)) { issue('incomplete', 'cost_quantity_missing', 'Missing applicable cost quantity', { scenario: name, path: `${prefix}/quantities/${escape(id)}` }); continue; }
        const unit = first?.quantity.unit || second.quantity.unit;
        const next = convertQuantity(second.quantity, unit), previous = first ? convertQuantity(first.quantity, unit) : null;
        const put = (path, unit, before, after) => {
          const row = { path, unit, ...delta(before, after) };
          if (row.state === 'unknown') issue('incomplete', 'cost_quantity_unknown', 'Unknown applicable cost quantity', { scenario: name, path });
          assess(row, name, 'metrics', true, { before, after }); target.push(row);
        };
        put(`${prefix}/quantities/${escape(id)}`, unit, previous ? previous.value === null ? null : quantityValue(previous) : '0', next.value === null ? null : quantityValue(next));
        for (const projection of before.projections) {
          // Explicitly cover every projected input to priceQuantity, including zero
          // rates and minimum/rounding blocks which can hide increased quantities.
          const rate = selectedProfile.rates[second.rate], rateUnit = rate?.unit || unit;
          const projected = item => {
            if (!item) return '0';
            const q = convertQuantity(item.quantity, rateUnit);
            return q.value === null ? null : multiply(quantityValue(q), item.scope === 'per-session' ? projection.sessions : 1);
          };
          put(`${prefix}/${projection.sessions}/quantities/${escape(id)}`, rateUnit, projected(first), projected(second));
        }
      }
    };
    const moneyRows = (target, before, after, prefix, name) => {
      if (before.status !== 'complete' || after.status !== 'complete') issue('incomplete', 'budget_incomplete', 'A normalized budget has unresolved applicable costs', { scenario: name });
      for (const previous of before.projections) {
        const next = after.projections.find(p => p.sessions === previous.sessions);
        for (const part of ['total', 'fixed', 'variable']) {
          const row = { path: `${prefix}/${previous.sessions}/${part}`, unit: selectedProfile.currency, ...delta(previous[part], next[part]) };
          assess(row, name, 'money'); target.push(row);
        }
        const firstItems = new Map(previous.lineItems.map(item => [item.id, item])), nextItems = new Map(next.lineItems.map(item => [item.id, item]));
        for (const id of new Set([...firstItems.keys(), ...nextItems.keys()])) {
          const first = firstItems.get(id), second = nextItems.get(id);
          if (!second) { issue('incomplete', 'cost_item_missing', 'A cost item disappeared; declare a justified zero instead', { scenario: name, path: id }); continue; }
          const row = { path: `${prefix}/${previous.sessions}/items/${escape(id)}`, unit: selectedProfile.currency, ...delta(first ? first.amount : '0', second.amount) };
          if (!first) { row.state = 'new'; row.percent = null; }
          assess(row, name, 'money'); target.push(row);
        }
      }
    };
    for (const result of report.scenarios) {
      if (result.name === 'idle') {
        for (const [index, budget] of a.idle.entries()) {
          quantityRows(result.quantities, budget, b.idle[index], '/idle-' + budget.windowSeconds, 'idle');
          moneyRows(result.money, budget, b.idle[index], '/idle-' + budget.windowSeconds, 'idle');
        }
      } else for (const variant of variants) {
        const before = a.scenarios.find(s => s.name === result.name)[variant], after = b.scenarios.find(s => s.name === result.name)[variant];
        quantityRows(result.quantities, before, after, '/' + variant, result.name);
        moneyRows(result.money, before, after, '/' + variant, result.name);
      }
    }
    for (const entry of rules) if (!entry.matched) throw new Error('Unused policy selector: ' + entry.rule.scenario + entry.rule.path);
    return finish();
  } catch (error) {
    const status = /[Ii]ncompatible (rate|quantity units|model placement)|unsupported resource configuration/.test(error.message) ? 'incompatible' : 'invalid_input';
    issue(status, status === 'incompatible' ? 'profile_incompatible' : 'invalid_input', error.message); return finish();
  }
}

export function renderComparison(report) {
  const safe = value => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
  const lines = ['# Comparación de consumo y costo', '', `Estado: ${report.status}. Código: ${report.exitCode}.`, '', report.scope, '',
    ...(report.captures ? [`Referencia: ${safe(report.captures.baseline.revision)}; candidata: ${safe(report.captures.candidate.revision)}. Las huellas del código medido y del cálculo están en comparison.json.`, ''] : []),
    '| Escenario | Cantidad/partida | Antes | Ahora | Cambio | % |', '|---|---|---:|---:|---:|---:|'];
  for (const scenario of report.scenarios) for (const row of [...scenario.metrics, ...(scenario.quantities || []), ...scenario.money]) if (row.state !== 'unchanged') {
    lines.push('| ' + [scenario.name, row.path, row.before, row.after, row.delta, row.percent === null ? row.state : row.percent].map(safe).join(' | ') + ' |');
  }
  lines.push('', '## Incidencias', '', ...(report.issues.length ? report.issues.map(issue => '- ' + safe([issue.code, issue.scenario, issue.path, issue.reason].filter(Boolean).join(': '))) : ['Sin aumentos no revisados ni cobertura perdida.']), '',
    'Los presupuestos se recalculan desde las mediciones con las mismas tarifas y condiciones. Los tiempos/RSS locales son descriptivos salvo tolerancia explícita. Una captura conserva evidencia; no convierte su consumo en un objetivo aprobado.', '',
    '## Condiciones y revisión', '', '```json', JSON.stringify({ equality: report.equality, pricing: report.pricing, normalization: report.normalization, calibration: report.calibration, policy: report.policy }, null, 2), '```', '');
  return lines.join('\n');
}
