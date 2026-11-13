import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quantity, convertQuantity } from '../core/quantity.mjs';
import { calculateBudget, renderBudget } from '../core/budget.mjs';
import { functionUsage, storageUsage, taskUnits, scheduledExecutions } from '../core/models.mjs';
import { evidence, priceProfile } from './fixtures.mjs';

const q = (value, unit = 'count', extra = {}) => quantity(value, unit, { ...evidence, ...extra });
const line = (id, rate, value, unit = 'count', scope = 'per-session') => ({
  id, rate, scope, service: priceProfile().rates[rate].service,
  location: priceProfile().rates[rate].location, quantity: q(value, unit),
});
const budget = (items, extra = {}) => calculateBudget({
  name: 'Known arithmetic case', scope: 'Only the declared resources of a synthetic workload',
  profile: priceProfile(), windowSeconds: 31 * 86400, volumes: [0, 1, 1000, 10000], items, ...extra,
});

describe('quantities and evidence', () => {
  it('keeps provenance and converts binary bytes independently from decimal GB', () => {
    const result = convertQuantity(q(1, 'GiB'), 'GB');
    assert.equal(result.value, '1.073741824');
    assert.equal(result.provenance, 'derived');
    assert.equal(result.inputs[0].provenance, 'assumed');
    assert.equal(convertQuantity(q(512, 'MiB'), 'GiB').value, '0.5');
  });
  it('distinguishes unknown from a justified zero or an explicit exclusion', () => {
    assert.equal(q(null).provenance, 'unknown');
    assert.equal(q(0).value, '0');
    assert.equal(q(0, 'count', { provenance: 'not-applicable' }).value, '0');
    assert.throws(() => quantity(0, 'count', { provenance: 'not-applicable' }));
    assert.throws(() => q(2, 'count', { provenance: 'not-applicable' }));
  });
  it('rejects invalid or incompatible values instead of supplying defaults', () => {
    for (const value of [-1, NaN, Infinity, 'Infinity', '', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => q(value));
    assert.throws(() => q(1, 'invented-unit'));
    assert.throws(() => q(1, 'count', { provenance: 'unknown' }));
    assert.throws(() => q(null, 'count', { provenance: 'invented' }));
    assert.throws(() => convertQuantity(q(1, 'byte'), 'count'));
    assert.throws(() => quantity(1, 'count', { provenance: 'observed', source: 'SDK' }));
  });
});

describe('resource models', () => {
  it('unions overlapping execution on the same instance before rounding allocated CPU and RAM', () => {
    const result = functionUsage({
      cpu: 1, memoryMiB: 512, roundingMs: 100, ...evidence,
      intervals: [
        { instance: 'one', phase: 'active', startMs: 0, endMs: 101 },
        { instance: 'one', phase: 'active', startMs: 50, endMs: 150 },
        { instance: 'two', phase: 'active', startMs: 0, endMs: 1 },
      ],
    });
    assert.equal(result.active.cpuSeconds.value, '0.3');
    assert.equal(result.active.memoryGiBSeconds.value, '0.15');
    assert.equal(result.active.seconds.value, '0.3');
    assert.equal(result.active.cpuSeconds.provenance, 'derived');
  });
  it('separates active/startup/idle categories and rejects ambiguous overlapping categories', () => {
    const input = { cpu: 2, memoryMiB: 1024, roundingMs: 100, ...evidence,
      intervals: [{ instance: 'one', phase: 'startup', startMs: 0, endMs: 100 },
        { instance: 'one', phase: 'idle', startMs: 100, endMs: 300 }] };
    assert.equal(functionUsage(input).startup.cpuSeconds.value, '0.2');
    assert.equal(functionUsage(input).idle.memoryGiBSeconds.value, '0.2');
    assert.throws(() => functionUsage({ ...input, intervals: [...input.intervals,
      { instance: 'one', phase: 'active', startMs: 50, endMs: 200 }] }));
    assert.throws(() => functionUsage({ ...input, roundingMs: 0 }));
    assert.throws(() => functionUsage({ ...input, intervals: [{ instance: 'one', phase: 'active', startMs: 0, endMs: 0 }] }));
  });
  it('integrates retained stored bytes over the declared billing period, including after cleanup', () => {
    const result = storageUsage({ ...evidence, representation: 'stored-including-indexes',
      windowSeconds: 200, billingPeriodSeconds: 200,
      samples: [{ atSeconds: 0, bytes: 1073741824 }, { atSeconds: 100, bytes: 0 }] });
    assert.equal(result.value, '0.5');
    assert.equal(result.unit, 'GiB-month');
    assert.throws(() => storageUsage({ ...evidence, representation: 'json', windowSeconds: 10,
      billingPeriodSeconds: 200, samples: [{ atSeconds: 0, bytes: 1 }] }));
  });
  it('applies task size minimums per operation and charges paused scheduler jobs separately from ticks', () => {
    assert.equal(taskUnits(q(0, 'byte'), 32768).value, '1');
    assert.equal(taskUnits(q(32768, 'byte'), 32768).value, '1');
    assert.equal(taskUnits(q(32769, 'byte'), 32768).value, '2');
    assert.equal(scheduledExecutions({ ...evidence, intervalSeconds: 60, windowSeconds: 86400, jobs: 2 }).value, '2880');
    assert.equal(scheduledExecutions({ ...evidence, intervalSeconds: 60, windowSeconds: 86400, jobs: 2, paused: true }).value, '0');
  });
});

describe('monetary budgets without cloud credentials', () => {
  it('calculates an independently known amount, keeping fixed cost once for 1000 sessions', () => {
    const result = budget([
      line('reads', 'reads', 3), line('writes', 'writes', 3), line('requests', 'requests', 1),
      line('cpu', 'cpu', '0.1', 'vCPU-second'), line('memory', 'memory', '0.05', 'GiB-second'),
      line('paused-job', 'scheduler', 31, 'job-day', 'window'),
    ]);
    assert.equal(result.status, 'complete');
    assert.equal(result.projections[0].total, '0.1');
    assert.equal(result.projections[1].total, '0.100010125');
    assert.equal(result.projections[2].fixed, '0.1');
    assert.equal(result.projections[2].variable, '0.010125');
    assert.equal(result.projections[2].total, '0.110125');
    assert.equal(result.projections[0].allocatedPerSession, null);
    assert.equal(result.currency, 'USD');
    assert.match(renderBudget(result), /0.110125/);
    assert.match(renderBudget(result), /Known arithmetic fixture/);
  });
  it('retains small monetary amounts before summing and projecting; supports decimal inputs exactly', () => {
    const profile = priceProfile();
    profile.rates.reads.price = '0.000000000000000000000000000001';
    profile.rates.reads.per = 1;
    const result = budget([line('read', 'reads', 1)], { profile });
    assert.equal(result.projections[1].total, '0.000000000000000000000000000001');
    assert.equal(result.projections[2].total, '0.000000000000000000000000001');
  });
  it('preserves exact modeled fractions across JSON serialization before projecting their cost', () => {
    const profile = priceProfile();
    profile.rates.storage = { service: 'storage', location: 'test', unit: 'GiB-month', per: 1, price: '1', source: 'fixture' };
    const stored = storageUsage({ ...evidence, representation: 'stored-including-indexes',
      samples: [{ atSeconds: 0, bytes: 1073741824 }, { atSeconds: 1, bytes: 0 }],
      windowSeconds: 3, billingPeriodSeconds: 3 });
    const item = { id: 'stored', service: 'storage', location: 'test', rate: 'storage',
      scope: 'per-session', quantity: JSON.parse(JSON.stringify(stored)) };
    assert.equal(budget([item], { profile, volumes: [3] }).projections[0].total, '1');
  });
  it('calculates quantity tiers after projection, rather than multiplying a single-session subtotal', () => {
    const profile = priceProfile();
    delete profile.rates.reads.price;
    profile.rates.reads.per = 1;
    profile.rates.reads.tiers = [{ upTo: 10, price: '2' }, { upTo: null, price: '1' }];
    const result = budget([line('read', 'reads', 1)], { profile, volumes: [1, 20] });
    assert.equal(result.projections[0].total, '2');
    assert.equal(result.projections[1].total, '30');
  });
  it('applies explicit aggregate minimums and rounding after scaling the workload', () => {
    const profile = priceProfile();
    Object.assign(profile.rates.reads, { price: '0.5', per: 10, minimum: 5, roundTo: 3 });
    const result = budget([line('read', 'reads', 1)], { profile, volumes: [0, 1, 1000] });
    assert.equal(result.projections[0].total, '0');
    assert.equal(result.projections[1].total, '0.3');
    assert.equal(result.projections[2].total, '50.1');
  });
  it('reports incomplete scope with a priced subtotal when a quantity, rate or coverage is missing', () => {
    const unknown = line('unknown', 'writes', null);
    const result = budget([line('reads', 'reads', 3), unknown]);
    assert.equal(result.status, 'incomplete');
    assert.equal(result.projections[2].total, null);
    assert.equal(result.projections[2].knownSubtotal, '0.0018');
    assert.ok(result.issues.some(issue => issue.item === 'unknown'));
    assert.equal(budget([{ ...line('x', 'reads', 1), rate: 'missing' }]).status, 'incomplete');
    assert.equal(budget([line('x', 'reads', 1)], { coverageIssues: ['Unobserved provider calls'] }).status, 'incomplete');
  });
  it('rejects conflicting locations, units, duplicate charges, invalid sources and implicit free quotas', () => {
    assert.throws(() => budget([{ ...line('read', 'reads', 1), location: 'us-central1' }]));
    assert.throws(() => budget([{ ...line('read', 'reads', 1), quantity: q(1, 'second') }]));
    assert.throws(() => budget([line('read', 'reads', 1), line('read', 'reads', 1)]));
    const profile = priceProfile();
    profile.sources.fixture.checkedAt = '2026-99-99';
    assert.throws(() => budget([line('read', 'reads', 1)], { profile }));
    assert.throws(() => budget([line('read', 'reads', 1)], { profile: { ...priceProfile(), basis: 'net' } }));
  });
  it('requires a reason for a zero-priced rate and preserves justified exclusions in the report', () => {
    const profile = priceProfile();
    profile.rates.reads.price = '0';
    assert.throws(() => budget([line('read', 'reads', 1)], { profile }));
    profile.rates.reads.zeroReason = 'Explicit free operation in arithmetic fixture';
    assert.equal(budget([line('read', 'reads', 1)], { profile }).projections[1].total, '0');
    const excluded = line('excluded', 'reads', 0);
    excluded.quantity = q(0, 'count', { provenance: 'not-applicable', source: 'This scenario performs no reads' });
    assert.equal(budget([excluded]).status, 'complete');
    assert.match(renderBudget(budget([excluded])), /This scenario performs no reads/);
  });
});
