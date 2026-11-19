import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { add, decimal, nonnegative } from './decimal.mjs';
import { quantity, quantityValue } from './quantity.mjs';

export function createMeter({ scenario, environment, clock = () => performance.now(),
  sampleMemory = () => process.memoryUsage().rss, maxEvidencePerMetric = 64 } = {}) {
  if (!scenario?.trim() || !environment?.trim()) throw new Error('Scenario and environment required');
  if (!Number.isSafeInteger(maxEvidencePerMetric) || maxEvidencePerMetric < 1) throw new Error('Invalid evidence limit');
  const metrics = new Map(), functions = new Map(), issues = new Set(), context = new AsyncLocalStorage();
  function accumulate(map, name, amount, metadata) {
    const current = map.get(name);
    if (current && current.unit !== metadata.unit) throw new Error('Metric unit changed: ' + name);
    const inputs = current?.inputs || new Map();
    const evidence = { provenance: metadata.provenance, source: metadata.source, environment: metadata.environment,
      ...(metadata.inputs && { inputs: metadata.inputs }) };
    const identity = JSON.stringify(evidence);
    if (inputs.has(identity) || inputs.size < maxEvidencePerMetric) inputs.set(identity, evidence);
    else issues.add('Metric evidence limit exceeded: ' + name);
    map.set(name, { unit: metadata.unit, known: add(current?.known || 0, amount),
      unknown: current?.unknown || false, inputs });
  }
  function view(map) {
    return Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)).map(([name, entry]) => {
      const inputs = [...entry.inputs.values()], first = inputs[0];
      const provenance = entry.unknown ? 'unknown' : inputs.length === 1 ? first.provenance : 'derived';
      return [name, { ...quantity(entry.unknown ? null : decimal(entry.known), entry.unit, {
        provenance, environment, source: inputs.length === 1 ? first.source : 'Aggregated instrumented operations', inputs,
      }), ...(entry.unknown && { knownValue: decimal(entry.known) }) }];
    }));
  }
  const meter = {
    add(name, value, metadata = {}) {
      if (!/^[a-z][\w.-]*$/i.test(name)) throw new Error('Invalid metric name');
      const descriptor = { provenance: 'observed', source: 'Instrumented SDK/adaptor boundary', environment, unit: 'count', ...metadata };
      const validated = quantity(value, descriptor.unit, descriptor);
      const amount = quantityValue(validated);
      if (descriptor.unit === 'count' && amount.d !== 1n) throw new Error('A counter must be integral');
      quantity(decimal(amount), descriptor.unit, descriptor);
      accumulate(metrics, name, amount, descriptor);
      const active = context.getStore();
      if (active) {
        accumulate(functions.get(active).metrics, name, amount, descriptor);
        if (functions.get(active).observer) delete functions.get(active).observer.zeroMetrics[name];
      }
    },
    addQuantity(name, input) {
      const validated = quantity(input.value, input.unit, input);
      if (validated.value === null) meter.unknown(name, validated.unit, validated.source);
      else meter.add(name, validated.value, validated);
    },
    declare(names) { for (const name of names) if (!metrics.has(name)) meter.add(name, 0); },
    declareFunction(name, { origin, metricUnits = {} } = {}) {
      if (!name?.trim() || !['http', 'firestore', 'database', 'schedule', 'task', 'other'].includes(origin)) throw new Error('Function identity/origin required');
      if (functions.has(name)) return;
      const entry = { metrics: new Map(), origins: new Set([origin]), sampledRssMaxBytes: 0,
        observer: { source: 'Registered handler observers initialized before scenario delivery', environment, zeroMetrics: { ...metricUnits } } };
      functions.set(name, entry);
      for (const metric of ['functions.invocations', 'functions.failures']) {
        delete entry.observer.zeroMetrics[metric];
        accumulate(entry.metrics, metric, 0, { unit: 'count', provenance: 'observed', source: entry.observer.source, environment });
      }
    },
    unknown(name, unit, reason) {
      if (!metrics.has(name)) meter.add(name, 0, { unit, source: reason });
      if (metrics.get(name).unit !== unit) throw new Error('Unknown metric unit changed');
      metrics.get(name).unknown = true;
      const active = context.getStore();
      if (active) {
        if (!functions.get(active).metrics.has(name)) accumulate(functions.get(active).metrics, name, 0,
          { unit, provenance: 'observed', source: reason, environment });
        functions.get(active).metrics.get(name).unknown = true;
      }
      issues.add(reason);
    },
    unsupported(operation) {
      const reason = 'Unobserved operation: ' + operation; issues.add(reason); throw new Error(reason);
    },
    wrapFunction(name, handler, { origin } = {}) {
      if (!name?.trim() || !['http', 'firestore', 'database', 'schedule', 'task', 'other'].includes(origin)) throw new Error('Function identity/origin required');
      return async function (...args) {
        if (!functions.has(name)) functions.set(name, { metrics: new Map(), origins: new Set(), sampledRssMaxBytes: 0 });
        const entry = functions.get(name); entry.origins.add(origin);
        return context.run(name, async () => {
          meter.add('functions.invocations', 1);
          const readClock = () => {
            try { const now = clock(); nonnegative(now); return now; }
            catch { meter.unknown('functions.localDurationMs', 'millisecond', 'Local timing sample unavailable'); return null; }
          };
          const start = readClock();
          const sample = () => {
            try {
              const bytes = sampleMemory();
              if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid memory sample');
              entry.sampledRssMaxBytes = Math.max(entry.sampledRssMaxBytes, bytes);
            } catch { meter.unknown('functions.sampledRssBytes', 'byte', 'Local memory sampling incomplete'); }
          };
          sample();
          try { return await handler.apply(this, args); }
          catch (error) { meter.add('functions.failures', 1); throw error; }
          finally {
            const end = readClock();
            if (start !== null && end !== null && end >= start) meter.add('functions.localDurationMs', decimal(nonnegative(end - start)),
              { unit: 'millisecond', source: 'Local monotonic handler wall time, not cloud billed duration' });
            else meter.unknown('functions.localDurationMs', 'millisecond', 'Local timing samples incomplete or non-monotonic');
            sample();
          }
        });
      };
    },
    snapshot() {
      return globalThis.structuredClone({ scenario, environment, metrics: view(metrics), coverageIssues: [...issues],
        functions: Object.fromEntries([...functions].map(([name, entry]) => [name, {
          metrics: view(entry.metrics), origins: [...entry.origins], sampledRssMaxBytes: entry.sampledRssMaxBytes,
          memoryScope: 'Local benchmark process RSS at handler start/end; not allocated cloud memory',
          ...(entry.observer && { observer: entry.observer }),
        }])) });
    },
  };
  // Declared zero counts describe this observer only, not uninstrumented code.
  meter.declare(['functions.invocations', 'functions.failures']);
  return meter;
}
