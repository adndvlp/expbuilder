import { add, ceilMultiple, compare, decimal, divide, multiply, nonnegative, subtract } from './decimal.mjs';
import { convertQuantity, quantity, quantityValue } from './quantity.mjs';

const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateProfile(profile) {
  if (!profile?.id || !/^[A-Z]{3}$/.test(profile.currency) || profile.basis !== 'gross') throw new Error('A named gross currency profile is required');
  for (const [name, source] of Object.entries(profile.sources || {})) {
    if (!source.url?.startsWith('https://') || !validDate(source.checkedAt)) throw new Error('Invalid price source: ' + name);
  }
  for (const [id, rate] of Object.entries(profile.rates)) {
    if (!rate.service || !rate.location || !profile.sources[rate.source]) throw new Error('Incomplete price identity/source: ' + id);
    quantity(0, rate.unit, { provenance: 'assumed', source: 'Price unit validation' });
    nonnegative(rate.per, 'units per price', true);
    if (rate.roundTo != null) nonnegative(rate.roundTo, 'price rounding increment', true);
    if (rate.minimum != null) nonnegative(rate.minimum);
    const checkPrice = entry => {
      nonnegative(entry.price, 'unit price');
      if (compare(entry.price, 0) === 0 && !entry.zeroReason && !rate.zeroReason) throw new Error('Zero price needs justification: ' + id);
    };
    if (rate.tiers) {
      if (rate.price != null || !rate.tiers.length || rate.tiers.at(-1).upTo !== null) throw new Error('Invalid price tiers: ' + id);
      let previous = 0;
      for (const [index, tier] of rate.tiers.entries()) {
        checkPrice(tier);
        if (tier.upTo === null) { if (index !== rate.tiers.length - 1) throw new Error('Unbounded tier must be last'); }
        else {
          nonnegative(tier.upTo, 'tier limit', true);
          if (compare(tier.upTo, previous) <= 0) throw new Error('Price tiers must increase');
          previous = tier.upTo;
        }
      }
    } else checkPrice(rate);
  }
}
export function priceQuantity(value, rate) {
  if (compare(value, 0) === 0) return nonnegative(0);
  if (rate.minimum != null && compare(value, rate.minimum) < 0) value = nonnegative(rate.minimum);
  if (rate.roundTo != null) value = ceilMultiple(value, rate.roundTo);
  if (!rate.tiers) return multiply(divide(value, rate.per), rate.price);
  let result = nonnegative(0), previous = 0;
  for (const tier of rate.tiers) {
    const end = tier.upTo === null || compare(value, tier.upTo) < 0 ? value : tier.upTo;
    if (compare(end, previous) > 0) result = add(result, multiply(divide(subtract(end, previous), rate.per), tier.price));
    if (tier.upTo === null || compare(value, tier.upTo) <= 0) break;
    previous = tier.upTo;
  }
  return result;
}

export function calculateBudget({ name, scope, profile, windowSeconds, volumes, items, coverageIssues = [] }) {
  validateProfile(profile); nonnegative(windowSeconds);
  if (!name?.trim() || !scope?.trim() || !volumes?.length) throw new Error('Budget identity, scope and volumes required');
  if (volumes.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Invalid session volume');
  const ids = new Set(), issues = coverageIssues.map(reason => ({ reason }));
  const prepared = items.map(item => {
    if (!item.id || ids.has(item.id)) throw new Error('Duplicate or missing charge identity');
    ids.add(item.id);
    if (!['window', 'per-session'].includes(item.scope) || !item.service || !item.location) throw new Error('Incomplete charge scope');
    if (!item.quantity) { issues.push({ item: item.id, reason: 'Missing quantity' }); return { ...item, priced: false }; }
    const original = quantity(item.quantity.value, item.quantity.unit, item.quantity);
    if (original.provenance === 'not-applicable') return { ...item, quantity: original, priced: true, excluded: true };
    const rate = profile.rates[item.rate];
    if (rate && (rate.location !== item.location || rate.service !== item.service || (rate.category && rate.category !== item.category))) {
      throw new Error('Incompatible rate for charge: ' + item.id);
    }
    const normalized = rate ? convertQuantity(original, rate.unit) : original;
    if (original.value === null || !rate) issues.push({ item: item.id, reason: original.value === null ? 'Unknown quantity' : 'Missing rate' });
    return { ...item, quantity: original, normalized, priced: original.value !== null && Boolean(rate) };
  });
  const status = issues.length ? 'incomplete' : 'complete';
  const projections = volumes.map(sessions => {
    let fixed = nonnegative(0), variable = nonnegative(0);
    const byService = new Map(), lineItems = [];
    for (const item of prepared) {
      if (!item.priced) { lineItems.push({ id: item.id, amount: null }); continue; }
      const count = item.excluded ? nonnegative(0) : multiply(quantityValue(item.normalized), item.scope === 'per-session' ? sessions : 1);
      const amount = item.excluded ? nonnegative(0) : priceQuantity(count, profile.rates[item.rate]);
      if (item.scope === 'per-session') variable = add(variable, amount); else fixed = add(fixed, amount);
      byService.set(item.service, add(byService.get(item.service) || 0, amount));
      lineItems.push({ id: item.id, quantity: decimal(count), amount: decimal(amount) });
    }
    const subtotal = add(fixed, variable);
    return { sessions, fixed: decimal(fixed), variable: decimal(variable), knownSubtotal: decimal(subtotal),
      total: status === 'complete' ? decimal(subtotal) : null,
      allocatedPerSession: sessions && status === 'complete' ? decimal(divide(subtotal, sessions)) : null,
      byService: Object.fromEntries([...byService].map(([service, amount]) => [service, decimal(amount)])), lineItems };
  });
  return { name, scope, status, currency: profile.currency, basis: profile.basis, windowSeconds, issues,
    profile: globalThis.structuredClone(profile), items: prepared.map(({ normalized, priced, excluded, ...item }) => {
      void [normalized, priced, excluded]; return item;
    }), projections };
}

const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
export function renderBudget(report) {
  const rows = report.projections.map(p => '| ' + [p.sessions, p.fixed, p.variable, p.total ?? 'incomplete', p.knownSubtotal].join(' | ') + ' |');
  return [
    '# ' + cell(report.name), '', 'Scope: ' + cell(report.scope),
    '', 'Status: ' + report.status + '; ' + report.currency + '; gross usage before quotas, discounts and taxes.',
    '', '| Sessions | Fixed | Variable | Total | Known subtotal |', '|---|---|---|---|---|', ...rows,
    '', '## Quantities and conditions', '',
    ...report.items.map(item => '- ' + cell(item.id) + ': ' + cell(JSON.stringify(item.quantity || null))),
    '', '## Price profile', '', cell(JSON.stringify(report.profile)),
    '', ...report.issues.map(issue => '- Pending: ' + cell(JSON.stringify(issue))), '',
  ].join('\n');
}
