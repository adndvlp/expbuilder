import { add, compare, decimal, divide, multiply, nonnegative, subtract } from './decimal.mjs';
import { convertQuantity, quantity, quantityValue } from './quantity.mjs';
import { priceQuantity } from './budget.mjs';

const clone = value => globalThis.structuredClone(value);
const component = 'session-firestore-storage';
const inventoryFields = ['documents', 'documentBytes', 'automaticIndexBytes', 'automaticIndexEntries', 'compositeBytes', 'compositeIndexEntries', 'indexBytes', 'indexEntries', 'storedBytes'];
const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const exact = value => ({ numerator: value.n.toString(), denominator: value.d.toString() });
const amount = value => ({ value: decimal(value), exact: exact(value) });

export function temporalInventoryIssues(scenario) {
  const issues = [];
  for (const [collection, inventory] of Object.entries(scenario.inventory)) for (const field of inventoryFields) {
    if (!Number.isSafeInteger(inventory?.[field]) || inventory[field] < 0) issues.push({
      code: 'temporal_inventory_missing', path: '/inventory/' + escape(collection) + '/' + field,
      reason: 'Every final document/index component requires a measured nonnegative whole value',
    });
  }
  if (!Number.isSafeInteger(scenario.retainedRtdbJsonBytes) || scenario.retainedRtdbJsonBytes < 0) issues.push({
    code: 'temporal_inventory_missing', path: '/retainedRtdbJsonBytes', reason: 'Measured retained RTDB bytes required',
  });
  return issues;
}
function projectedQuantity(item, budget, sessions) {
  if (item.quantity.provenance === 'not-applicable') return nonnegative(0);
  const rate = budget.profile.rates[item.rate];
  return multiply(quantityValue(convertQuantity(item.quantity, rate.unit)), item.scope === 'per-session' ? sessions : 1);
}
function subtotal(budget, sessions, scope) {
  return budget.items.filter(item => item.scope === scope).reduce((total, item) =>
    add(total, priceQuantity(projectedQuantity(item, budget, sessions), budget.profile.rates[item.rate])), nonnegative(0));
}
function savings(before, after, prefix, name, scopes, issue) {
  for (const projection of before.projections) for (const [part, scope] of scopes) {
    const first = subtotal(before, projection.sessions, scope), second = subtotal(after, projection.sessions, scope);
    if (compare(second, first) >= 0) issue('regression', 'temporal_storage_savings', 'A temporal allowance requires strictly lower independent fixed and variable subtotals', {
      scenario: name, path: `${prefix}/${projection.sessions}/${part}`, before: decimal(first), after: decimal(second),
    });
  }
}

/** Derives allowances from one physical cap per session; no generic row rules. */
export function createTemporalStorageEvaluation({ declaration, baseline, candidate, beforeBudgets, afterBudgets, report, issue }) {
  const records = new Map(), allowances = new Map();
  const factor = multiply(1073741824, declaration.scope.billingPeriodSeconds);
  const code = candidate.reference.measuredCode?.sha256;
  const sameCode = code === baseline.reference.measuredCode?.sha256;
  const knownCode = typeof code === 'string' && /^[a-f0-9]{64}$/.test(code);
  const addAllowance = (name, path, limit, values) => allowances.set(name + path, { limit, ...values });
  const existingFailure = name => report.issues.some(i => !i.scenario || i.scenario === name);
  for (const result of report.scenarios) {
    if (result.name === 'idle') {
      for (const [index, budget] of beforeBudgets.idle.entries()) savings(budget, afterBudgets.idle[index], '/idle-' + budget.windowSeconds, 'idle', [['fixed', 'window']], issue);
      continue;
    }
    const rule = declaration.limits.find(limit => limit.scenario === result.name);
    if (!rule) continue;
    const before = beforeBudgets.scenarios.find(s => s.name === result.name), after = afterBudgets.scenarios.find(s => s.name === result.name);
    const stored = budget => budget.items.find(item => item.id === component);
    const first = multiply(quantityValue(stored(before.nominal).quantity), factor), second = multiply(quantityValue(stored(after.nominal).quantity), factor);
    const increase = subtract(second, first), cap = nonnegative(rule.maxIncreaseByteSeconds), quantityCap = divide(cap, factor);
    const usesAllowance = compare(increase, 0) > 0;
    const record = {
      component, unit: declaration.unit, baselineByteSeconds: decimal(first), candidateByteSeconds: decimal(second),
      increaseByteSeconds: decimal(increase), maxIncreaseByteSeconds: rule.maxIncreaseByteSeconds,
      increaseExact: exact(increase), maxIncreaseExact: exact(cap), usesAllowance, authorized: false,
      reason: rule.reason, review: clone(declaration.review), baseline: clone(declaration.scope.baseline),
      quantity: { unit: 'GiB-month', maximumIncrease: amount(quantityCap) }, equivalents: [],
    };
    result.temporalStorage = record; records.set(result.name, { record, rows: [] });
    if (usesAllowance) {
      if (!knownCode) issue('incomplete', 'temporal_storage_code_missing', 'Candidate measured code identity required', { scenario: result.name });
      if (sameCode) issue('regression', 'temporal_storage_repetition', 'Repetitions of the same measured code require strict equality', { scenario: result.name });
      if (compare(increase, cap) > 0) issue('regression', 'temporal_storage_limit', 'Integrated storage exceeds the exact reviewed byte-second cap', {
        scenario: result.name, path: '/storageTimeline', increaseByteSeconds: decimal(increase), maxIncreaseByteSeconds: rule.maxIncreaseByteSeconds,
      });
      for (const variant of declaration.scope.variants) savings(before[variant], after[variant], '/' + variant, result.name, [['fixed', 'window'], ['variable', 'per-session']], issue);
    }
    const eligible = usesAllowance && !existingFailure(result.name);
    for (const variant of declaration.scope.variants) {
      const a = before[variant], b = after[variant], firstItem = stored(a), secondItem = stored(b);
      const rate = a.profile.rates[firstItem.rate];
      const capInRateUnit = quantityValue(convertQuantity(quantity(quantityCap, 'GiB-month', { provenance: 'derived', source: 'Reviewed physical cap divided by GiB bytes and billing seconds' }), rate.unit));
      if (eligible) addAllowance(result.name, `/${variant}/quantities/${component}`, quantityCap);
      for (const sessions of declaration.scope.volumes) {
        const firstQuantity = projectedQuantity(firstItem, a, sessions), secondQuantity = projectedQuantity(secondItem, b, sessions);
        const projectedCap = multiply(capInRateUnit, sessions);
        const firstAmount = priceQuantity(firstQuantity, rate), secondAmount = priceQuantity(secondQuantity, rate);
        // Price the upper bound relative to its original quantity. This also
        // preserves tariff tiers/minimums/rounding without pricing the cap twice.
        const moneyCap = subtract(priceQuantity(add(firstQuantity, projectedCap), rate), firstAmount);
        record.equivalents.push({ variant, sessions, quantityUnit: rate.unit, quantity: amount(projectedCap),
          currency: a.profile.currency, money: amount(moneyCap), rate: clone(rate) });
        if (!eligible) continue;
        addAllowance(result.name, `/${variant}/${sessions}/quantities/${component}`, projectedCap);
        addAllowance(result.name, `/${variant}/${sessions}/items/${component}`, moneyCap, { before: firstAmount, after: secondAmount });
      }
    }
  }
  return {
    allowance(name, row) {
      const entry = allowances.get(name + row.path);
      if (!entry) return null;
      const record = records.get(name);
      record.rows.push(row);
      row.temporalStorage = { component, authorized: false };
      row.allowedIncreaseExact = exact(entry.limit);
      return entry;
    },
    finalize(equality) {
      if (sameCode && equality && Object.values(equality).some(equal => !equal)
          && !report.issues.some(i => i.code === 'temporal_storage_repetition')) {
        issue('regression', 'temporal_storage_repetition', 'Repetitions require all five exact equality checks, including permitted decreases');
      }
      for (const { record, rows } of records.values()) {
        record.authorized = record.usesAllowance && report.issues.length === 0;
        for (const row of rows) row.temporalStorage.authorized = record.authorized;
      }
    },
  };
}
