import { add, ceilMultiple, compare, divide, multiply, nonnegative, subtract } from './decimal.mjs';
import { convertQuantity, quantity, quantityValue } from './quantity.mjs';

function derived(value, unit, source, inputs) {
  return quantity(value, unit, { provenance: 'derived', source, inputs: [globalThis.structuredClone(inputs)] });
}
function evidence(input) {
  quantity(0, 'count', input);
  if (!['assumed', 'external', 'observed'].includes(input.provenance)) throw new Error('Model input evidence required');
}
export function functionUsage(input) {
  evidence(input);
  nonnegative(input.cpu, 'allocated CPU', true); nonnegative(input.memoryMiB, 'allocated memory', true);
  nonnegative(input.roundingMs, 'billing increment', true);
  const phases = ['active', 'startup', 'idle'], groups = new Map(), byInstance = new Map();
  for (const interval of input.intervals) {
    if (!interval.instance || !phases.includes(interval.phase)) throw new Error('Execution instance and phase required');
    nonnegative(interval.startMs); nonnegative(interval.endMs);
    if (compare(interval.endMs, interval.startMs) <= 0) throw new Error('Execution intervals must have positive duration; omit absent allocations');
    for (const earlier of byInstance.get(interval.instance) || []) {
      if (earlier.phase !== interval.phase && compare(earlier.startMs, interval.endMs) < 0
          && compare(interval.startMs, earlier.endMs) < 0) throw new Error('Overlapping billing categories');
    }
    const previous = byInstance.get(interval.instance) || [];
    previous.push(interval); byInstance.set(interval.instance, previous);
    const key = interval.instance + ':' + interval.phase;
    const group = groups.get(key) || { phase: interval.phase, intervals: [] };
    group.intervals.push(interval); groups.set(key, group);
  }
  const milliseconds = Object.fromEntries(phases.map(phase => [phase, 0]));
  for (const group of groups.values()) {
    const merged = [];
    for (const interval of group.intervals.toSorted((a, b) => compare(a.startMs, b.startMs))) {
      const last = merged.at(-1);
      if (last && compare(interval.startMs, last.endMs) <= 0) {
        if (compare(interval.endMs, last.endMs) > 0) last.endMs = interval.endMs;
      } else merged.push({ ...interval });
    }
    for (const interval of merged) milliseconds[group.phase] = add(milliseconds[group.phase],
      ceilMultiple(subtract(interval.endMs, interval.startMs), input.roundingMs));
  }
  return Object.fromEntries(phases.map(phase => {
    const seconds = divide(milliseconds[phase], 1000), source = 'Union of instance intervals and allocated resources: ' + phase;
    return [phase, {
      seconds: derived(seconds, 'second', source, input),
      cpuSeconds: derived(multiply(seconds, input.cpu), 'vCPU-second', source, input),
      memoryGiBSeconds: derived(multiply(seconds, divide(input.memoryMiB, 1024)), 'GiB-second', source, input),
    }];
  }));
}
export function storageUsage(input) {
  evidence(input);
  if (input.representation !== 'stored-including-indexes') throw new Error('Stored size including indexes required');
  nonnegative(input.windowSeconds); nonnegative(input.billingPeriodSeconds, 'billing period', true);
  if (!input.samples.length || input.samples[0].atSeconds !== 0) throw new Error('Initial storage sample required');
  let byteSeconds = nonnegative(0);
  for (const [index, sample] of input.samples.entries()) {
    const end = input.samples[index + 1]?.atSeconds ?? input.windowSeconds;
    nonnegative(sample.bytes); nonnegative(sample.atSeconds);
    if (compare(end, sample.atSeconds) < 0 || compare(end, input.windowSeconds) > 0
        || (index && compare(sample.atSeconds, input.samples[index - 1].atSeconds) <= 0)) throw new Error('Invalid storage timeline');
    byteSeconds = add(byteSeconds, multiply(sample.bytes, subtract(end, sample.atSeconds)));
  }
  return derived(divide(byteSeconds, multiply(1073741824, input.billingPeriodSeconds)), 'GiB-month',
    'Stored bytes integrated over the declared billing period', input);
}
export function taskUnits(bytes, blockBytes) {
  const normalized = convertQuantity(bytes, 'byte');
  nonnegative(blockBytes, 'task size block', true);
  if (normalized.value === null) return quantity(null, 'count', { provenance: 'unknown', source: 'Task size unknown', inputs: [bytes] });
  const blocks = divide(ceilMultiple(quantityValue(normalized), blockBytes), blockBytes);
  return derived(compare(blocks, 1) < 0 ? 1 : blocks, 'count', 'Per-operation payload size minimum', { bytes, blockBytes });
}
export function scheduledExecutions(input) {
  evidence(input);
  nonnegative(input.intervalSeconds, 'schedule interval', true); nonnegative(input.windowSeconds);
  if (!Number.isSafeInteger(input.jobs) || input.jobs < 0) throw new Error('Invalid job count');
  const offset = input.offsetSeconds ?? 0; nonnegative(offset);
  const remaining = subtract(input.windowSeconds, offset);
  const ticks = input.paused || compare(remaining, 0) <= 0 ? 0 : divide(ceilMultiple(remaining, input.intervalSeconds), input.intervalSeconds);
  return derived(multiply(ticks, input.jobs), 'count', 'Schedule ticks in a half-open window; job existence priced separately', input);
}
