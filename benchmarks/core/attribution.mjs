import { add, decimal } from './decimal.mjs';
import { convertQuantity, quantity, quantityValue } from './quantity.mjs';
import { reconciliation, functionMeasurements } from '../persistence/function-inventory.mjs';

export const reconciliationMembers = scenario => scenario.functionInventory?.responsibilities.find(entry => entry.id === reconciliation.id)?.members || [];
const performance = metric => metric.includes('localDuration') || metric.includes('sampledRss');
function sum(inputs, unit, source) {
  let total = add(0, 0);
  for (const input of inputs) {
    const value = convertQuantity(input, unit);
    if (value.value === null) return quantity(null, unit, { source });
    total = add(total, quantityValue(value));
  }
  return quantity(decimal(total), unit, { provenance: 'derived', source,
    exact: { numerator: total.n.toString(), denominator: total.d.toString() } });
}
export function responsibilityMetrics(scenario) {
  const members = reconciliationMembers(scenario), result = new Map();
  if (!members.length) return result;
  const measurements = members.map(name => functionMeasurements(scenario.functions[name]));
  const metrics = new Set(measurements.flatMap(entry => Object.keys(entry)));
  for (const metric of metrics) {
    if (performance(metric)) continue;
    const inputs = measurements.map(entry => entry[metric]);
    if (inputs.some(input => !input)) throw Object.assign(new Error('Missing responsibility measurement: ' + metric), { coverage: true });
    result.set('/responsibilities/' + reconciliation.id + '/metrics/' + metric, {
      input: sum(inputs, inputs[0].unit, 'Exact sum of observed reconciliation members; each physical measurement remains in the report'), kind: 'responsibility' });
  }
  return result;
}
export function physicalMember(path) {
  const match = /^\/functions\/([^/]+)\//.exec(path);
  return match ? match[1] : null;
}

// Input budgets have already priced each member with its own resource options,
// duration rounding and tariffs. Never reprice a combined CPU/memory allocation.
export function attributeBudget(budget) {
  const groups = new Map(), physical = [];
  for (const item of budget.items) {
    const allocation = item.functionAllocation;
    if (!allocation?.responsibility) { groups.set(item.id, [item]); continue; }
    physical.push(item);
    const id = [item.scope, 'responsibility', allocation.responsibility, item.service, item.location,
      allocation.phase, allocation.resource, item.rate, item.category || 'none', item.quantity.unit].join('-');
    const group = groups.get(id) || []; group.push(item); groups.set(id, group);
  }
  const items = [...groups].map(([id, members]) => members[0].functionAllocation?.responsibility ? {
    id, rate: members[0].rate, scope: members[0].scope, service: members[0].service, location: members[0].location,
    category: members[0].category, quantity: sum(members.map(item => item.quantity), members[0].quantity.unit, 'Sum of physical allocations after each function resource model'),
  } : members[0]);
  const projections = budget.projections.map(projection => ({ ...projection,
    lineItems: [...groups].map(([id, members]) => {
      const rows = members.map(item => projection.lineItems.find(row => row.id === item.id));
      return { id, amount: rows.some(row => row?.amount == null) ? null : decimal(rows.reduce((total, row) => add(total, row.amount), 0)) };
    }) }));
  return { budget: { ...budget, items, projections }, physical };
}
