import { calculateBudget } from '../core/budget.mjs';
import { quantity } from '../core/quantity.mjs';
import { functionUsage, scheduledExecutions, storageUsage } from '../core/models.mjs';
import workload from '../profiles/persistence-30d.json' with { type: 'json' };
import { validateConditions } from '../core/calibration.mjs';

export const assumptions = workload;
const number = (metrics, name) => Number(metrics?.[name]?.value || 0);
const sumMetric = (metrics, suffix) => Object.entries(metrics || {}).filter(([key]) => key.startsWith('provider.') && key.endsWith(suffix)).reduce((sum, [, value]) => sum + Number(value.value || 0), 0);
const derived = (value, unit, source, inputs) => quantity(value, unit, { provenance: 'derived', source, inputs });
const assumed = (value, unit, source) => quantity(String(value), unit, { provenance: 'assumed', source });
function measurementIssues(scenario) {
  const issues = new Set(scenario.coverageIssues || []);
  for (const [context, metrics] of [['scenario', scenario.metrics], ...Object.entries(scenario.functions).map(([name, entry]) => [name, entry.metrics])]) {
    for (const [name, value] of Object.entries(metrics)) {
      quantity(value.value, value.unit, value);
      if (value.value === null) issues.add('Unknown measured quantity: ' + context + '/' + name);
    }
  }
  return [...issues];
}
function subtractBackground(scenario, idle) {
  const background = {}, functions = {};
  for (const [name, entry] of Object.entries(scenario.functions)) {
    const base = idle?.functions[name], baselineInvocations = number(base?.metrics, 'functions.invocations');
    const ticks = baselineInvocations ? number(entry.metrics, 'functions.invocations') / baselineInvocations : 0;
    const metrics = {};
    for (const [key, value] of Object.entries(entry.metrics)) {
      if (key === 'functions.localDurationMs') { metrics[key] = value; continue; }
      const removed = ticks * number(base?.metrics, key);
      background[key] = (background[key] || 0) + removed;
      const residual = Number(value.value || 0) - removed;
      if (residual < -1e-8) throw new Error('Reference has fewer operations than its idle workload: ' + name + '/' + key);
      metrics[key] = derived(String(Math.max(0, residual)), value.unit, 'Per-session handler operations after subtracting the independently measured empty schedule tick', { observed: value, idle: base?.metrics[key] || null, ticks });
    }
    functions[name] = { ...entry, metrics };
  }
  const metrics = Object.fromEntries(Object.entries(scenario.metrics).map(([key, value]) => {
    if (key === 'functions.localDurationMs') return [key, value]; // Descriptive only; not used as cloud allocation.
    const residual = Number(value.value || 0) - (background[key] || 0);
    if (residual < -1e-8) throw new Error('Invalid background subtraction: ' + key);
    return [key, derived(String(Math.max(0, residual)), value.unit, 'Scenario operations minus observed empty scheduler ticks', { observed: value, background: background[key] || 0 })];
  }));
  return { metrics, functions };
}
function itemsFor({ metrics, functions, registrations }, variant, scope, multiplier = 1, conditions = assumptions) {
  const model = conditions[variant], items = [];
  if (registrations.some(config => config.minInstances !== 0)) throw new Error('Review unsupported resource configuration: minimum instances need an idle allocation model');
  function item(id, rate, service, location, value, unit, source, category) {
    items.push({ id: scope + '-' + id, rate, scope, service, location, quantity: derived(String(value * multiplier), unit, source, { model: variant, multiplier }), ...(category && { category }) });
  }
  for (const [metric, rate] of [['readUnits', 'reads'], ['indexReadUnits', 'reads'], ['writes', 'writes'], ['deletes', 'deletes']]) {
    item('firestore-' + metric, rate, 'firestore', 'nam5', number(metrics, 'firestore.' + metric), 'count', 'Measured Firestore operations with document minimums and query index rule');
  }
  item('requests', 'requests', 'functions', 'us-central1', number(metrics, 'functions.invocations'), 'count', 'Every HTTP/event/task/scheduled invocation, including no-op handlers and retries');
  for (const [name, entry] of Object.entries(functions)) {
    const invocations = number(entry.metrics, 'functions.invocations');
    if (!invocations) {
      for (const phase of ['active', 'startup']) for (const suffix of ['cpu', 'memory']) items.push({
        id: `${scope}-${name}-${phase}-${suffix}`, rate: suffix, scope, service: 'functions', location: 'us-central1', category: 'active',
        quantity: quantity(0, suffix === 'cpu' ? 'vCPU-second' : 'GiB-second', { provenance: 'not-applicable', source: 'Explicit zero function invocations; no active/startup allocation' }),
      });
      continue;
    }
    const config = registrations.find(value => value.name === name);
    if (!config || typeof config.cpu !== 'number' || config.cpu <= 0 || config.cpu > 8 || config.minInstances !== 0
        || !Number.isSafeInteger(config.memoryMiB) || config.memoryMiB < 128 || config.memoryMiB > 32768
        || (config.location ?? 'us-central1') !== 'us-central1') throw new Error('Review unsupported resource configuration: ' + name);
    const totalWorkMs = invocations * model.baseMs + number(entry.metrics, 'firestore.readCalls') * model.firestoreReadMs
      + (number(entry.metrics, 'firestore.transactionAttempts') + number(entry.metrics, 'firestore.batchAttempts')
        + number(entry.metrics, 'firestore.directWriteCalls')) * model.firestoreCommitMs
      + (number(entry.metrics, 'rtdb.readCalls') + number(entry.metrics, 'rtdb.writeAttempts')) * model.realtimeMs
      + sumMetric(entry.metrics, '.requests') * model.providerMs;
    const perInvocation = Math.max(100, Math.ceil(totalWorkMs / invocations / 100) * 100);
    const input = { cpu: config.cpu, memoryMiB: config.memoryMiB, roundingMs: 100, provenance: 'assumed', source: conditions.compute,
      intervals: [{ instance: 'isolated-serial-workload', phase: 'active', startMs: 0, endMs: perInvocation * invocations },
        ...(model.coldFraction ? [{ instance: 'separate-startup-allocation', phase: 'startup', startMs: 0, endMs: invocations * model.coldFraction * model.startupMs }] : [])] };
    const usage = functionUsage(input);
    for (const phase of ['active', 'startup']) for (const [suffix, resource] of [['cpu', 'cpuSeconds'], ['memory', 'memoryGiBSeconds']]) {
      const q = usage[phase][resource];
      items.push({ id: `${scope}-${name}-${phase}-${suffix}`, rate: suffix, scope, service: 'functions', location: 'us-central1', category: 'active',
        quantity: derived(String(Number(q.value) * multiplier), q.unit, 'Operation-latency cloud allocation model: ' + name + '/' + phase, {
          variant, referenceFunction: name, operationCountsInReferenceJson: true,
          totalWorkMs, averageWorkMsRoundedPerInvocation: perInvocation, invocations,
          phase, cpu: config.cpu, memoryMiB: config.memoryMiB, roundingMs: 100,
          startupMs: model.startupMs, coldFraction: model.coldFraction, multiplier }) });
    }
  }
  item('tasks', 'task-operations', 'tasks', 'global', number(metrics, 'tasks.billableUnits'), 'count', 'Enqueues plus deliveries including retries, payload+envelope minimums; injected platform failure excluded by declared classification');
  const invocations = number(metrics, 'functions.invocations'), events = number(metrics, 'events.published');
  const deliveredEvents = Object.values(functions).filter(fn => fn.origins.some(origin => ['firestore', 'database'].includes(origin))).reduce((sum, fn) => sum + number(fn.metrics, 'functions.invocations'), 0);
  item('eventarc', 'eventarc-google', 'eventarc', 'global', events, 'count', 'Google-source Eventarc Standard; transport is separate');
  const eventBytes = number(metrics, 'events.publishedPayloadBytes') + number(metrics, 'events.deliveredPayloadBytes');
  item('pubsub', 'pubsub-throughput', 'pubsub', 'us-central1', Math.max(eventBytes * model.networkFactor + (events + deliveredEvents) * 1024, (events + deliveredEvents) * 1024), 'byte', conditions.network);
  const backendConnections = Object.values(functions).filter(fn => number(fn.metrics, 'rtdb.readCalls') + number(fn.metrics, 'rtdb.writeAttempts') > 0).reduce((sum, fn) => sum + number(fn.metrics, 'functions.invocations'), 0);
  const browserConnections = number(metrics, 'rtdb.disconnectRegistrations');
  item('rtdb-download', 'rtdb-download', 'rtdb', 'us-central1', number(metrics, 'rtdb.downloadBytes') * model.networkFactor + (backendConnections + browserConnections) * 3500, 'byte', conditions.network);
  const outgoing = sumMetric(metrics, '.requestContentBytes') + number(metrics, 'http.responseContentBytes');
  const exchanges = sumMetric(metrics, '.requests') + number(metrics, 'http.requests');
  item('internet', 'internet-egress', 'network', 'us-central1', outgoing * model.networkFactor + exchanges * model.protocolBytes, 'byte', conditions.network);
  item('internal-firestore', 'firestore-internal-egress', 'firestore', 'nam5', 0, 'byte', 'Assumed nam5/us-central1 placement within the same multi-region; no direct browser Firestore usage');
  item('logs', 'log-ingestion', 'logging', 'us-central1', invocations * model.logBytesPerInvocation, 'byte', conditions.logs);
  return items;
}
export function referenceBudgets(reference, profile, { windowSeconds = 2592000, volumes = [1, 1000, 10000], conditions = assumptions, calibration } = {}) {
  validateConditions(conditions);
  const idle = reference.scenarios.find(scenario => scenario.name === 'idle'), byName = [];
  const ticksForWindow = seconds => Number(scheduledExecutions({ jobs: 1, intervalSeconds: 60, windowSeconds: seconds, provenance: 'assumed', source: 'Configured every 1 minutes schedules, half-open window with phase offset zero' }).value);
  const idleWindows = [...new Set([60, 86400, windowSeconds])].map(seconds => {
    const source = idle || { metrics: {}, functions: {}, registrations: [] };
    const ticks = scheduledExecutions({ jobs: 1, intervalSeconds: 60, windowSeconds: seconds, provenance: 'assumed', source: 'Configured every 1 minutes schedules; 30-day reporting month' });
    const items = itemsFor(source, 'nominal', 'window', Number(ticks.value), conditions);
    items.push({ id: 'idle-shared-storage', rate: 'firestore-storage', scope: 'window', service: 'firestore', location: 'nam5', quantity: assumed((idle?.inventory.users?.storedBytes || 0) / 1073741824 * seconds / 2592000, 'GiB-month', 'Existing owner credential document retained through the idle window') });
    items.push({ id: 'scheduler-jobs', rate: 'scheduler', scope: 'window', service: 'scheduler', location: 'global', quantity: assumed(source.registrations.filter(entry => entry.intervalMs).length * seconds / 86400, 'job-day', 'Jobs exist throughout the declared period; billed once per job-day, even paused') });
    return calculateBudget({ name: 'Idle ' + seconds + ' seconds', scope: 'Runtime cloud resources, empty periodic jobs only', profile, windowSeconds: seconds, volumes: [0], items, coverageIssues: idle ? measurementIssues(idle) : ['Missing independently observed idle scenario'] });
  });
  for (const scenario of reference.scenarios.filter(value => value.name !== 'idle')) {
    const usage = subtractBackground(scenario, idle), result = { name: scenario.name };
    for (const variant of ['low', 'nominal', 'high']) {
      const fixed = itemsFor(idle || { metrics: {}, functions: {}, registrations: [] }, variant, 'window', ticksForWindow(windowSeconds), conditions);
      fixed.push({ id: 'scheduler-jobs', rate: 'scheduler', scope: 'window', service: 'scheduler', location: 'global', quantity: assumed((idle?.registrations.filter(entry => entry.intervalMs).length || 0) * windowSeconds / 86400, 'job-day', 'Registered schedule jobs, charged once per window') });
      const items = [...fixed, ...itemsFor({ ...scenario, ...usage }, variant, 'per-session', 1, conditions)];
      const sharedStorage = (scenario.inventory.experiments?.storedBytes || 0) + (scenario.inventory.logs?.storedBytes || 0) + (scenario.inventory.users?.storedBytes || 0);
      items.push({ id: 'shared-config-log-storage', rate: 'firestore-storage', scope: 'window', service: 'firestore', location: 'nam5', quantity: assumed(sharedStorage / 1073741824 * windowSeconds / 2592000, 'GiB-month', 'One experiment configuration, shared action log and owner credential document throughout window; single experiment, many sessions') });
      const samples = scenario.storageTimeline.length ? [...scenario.storageTimeline] : [{ atSeconds: 0, bytes: 0 }];
      // Initial inventory at time zero, then observed changes. Equal-time commits use their final state.
      const timeline = [{ atSeconds: 0, bytes: 0 }, ...samples];
      const unique = [...new Map(timeline.map(sample => [sample.atSeconds, sample])).values()].filter(sample => sample.atSeconds < windowSeconds);
      const storage = storageUsage({ samples: unique, windowSeconds, billingPeriodSeconds: 2592000, representation: 'stored-including-indexes', provenance: 'assumed',
        source: 'Observed stored bytes integrated over the capture timeline and declared retention horizon: ' + conditions.retention, timing:scenario.storageTiming });
      items.push({ id: 'session-firestore-storage', rate: 'firestore-storage', scope: 'per-session', service: 'firestore', location: 'nam5', quantity: storage });
      items.push({ id: 'session-rtdb-storage', rate: 'rtdb-storage', scope: 'per-session', service: 'rtdb', location: 'us-central1', quantity: assumed(scenario.retainedRtdbJsonBytes * conditions[variant].rtdbStoredFactor / 1e9 * windowSeconds / 2592000, 'GB-month', 'Retained RTDB JSON times declared metadata/index uplift, retained throughout window') });
      result[variant] = calculateBudget({ name: scenario.name + ' / ' + variant, scope: 'Public runtime Google Cloud consumption under declared resources, network and retention; excludes provider plan and publishing/deployment', profile, windowSeconds, volumes, items,
        coverageIssues: [...measurementIssues(scenario), ...(!idle ? ['Missing independently observed idle scenario'] : measurementIssues(idle)), ...(!scenario.functional.passed ? ['Functional CSV check failed'] : [])] });
    }
    byName.push(result);
  }
  return { assumptions: globalThis.structuredClone(conditions), ...(calibration && { calibration: globalThis.structuredClone(calibration) }), idle: idleWindows, scenarios: byName };
}

export function renderReference(reference, budgets) {
  const money = value => value === null ? 'incomplete' : Number(value).toFixed(8);
  const lines = ['# Referencia de persistencia pública', '', `Revisión base: ${reference.revision}. Fecha: ${reference.createdAt}.`, '',
    'Consumo actual medido en emuladores y presupuesto calculado antes de desplegar. Esta referencia no aprueba su consumo como objetivo.', '',
    'Alcance monetario: recursos de Google Cloud del runtime. Moneda USD, bruto antes de cuotas, descuentos e impuestos. Un experimento, sesiones al inicio del horizonte de 30 días. Plan/espacio del proveedor, publicación, construcción y despliegue fuera de este alcance.', '',
    '| Escenario | Eventos CSV | Lecturas | Escrituras | Borrados | Functions | Docs retenidos de sesión | USD variable/sesión | USD 1.000 sesiones + fijo | Rango 1.000 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const scenario of reference.scenarios.filter(value => value.name !== 'idle')) {
    const budget = budgets.scenarios.find(value => value.name === scenario.name), nominal = budget.nominal.projections;
    const docs = Object.entries(scenario.inventory).filter(([key]) => !['experiments', 'logs', 'users'].includes(key)).reduce((sum, [, value]) => sum + value.documents, 0);
    lines.push(`| ${scenario.name} | ${scenario.functional.events ?? 'failed'} | ${number(scenario.metrics, 'firestore.readUnits')} | ${number(scenario.metrics, 'firestore.writes')} | ${number(scenario.metrics, 'firestore.deletes')} | ${number(scenario.metrics, 'functions.invocations')} | ${docs} | ${money(nominal.find(row => row.sessions === 1)?.variable)} | ${money(nominal.find(row => row.sessions === 1000)?.total)} | ${money(budget.low.projections.find(row => row.sessions === 1000)?.total)}–${money(budget.high.projections.find(row => row.sessions === 1000)?.total)} |`);
  }
  lines.push('', '## Sin participantes', '', '| Ventana | USD fijo nominal |', '|---|---:|', ...budgets.idle.map(budget => `| ${budget.windowSeconds} segundos | ${money(budget.projections[0].total)} |`), '',
    'Las filas de escenarios incluyen las revisiones periódicas ejecutadas durante su ventana de prueba. Al presupuestar, se resta su trabajo vacío y se añade el costo fijo una sola vez por periodo. Los CSV se verifican en orden, completos y sin IDs duplicados; también se entregan las tareas obsoletas pendientes.', '',
    '## Condiciones del cálculo', '', '```json', JSON.stringify(budgets.assumptions, null, 2), '```', '',
    'Los contadores por función, inventario por colección, tamaños con índices, tareas pendientes y sobrecarga del benchmark están en reference.json. Las partidas, unidades, entradas y fuentes de tarifas están en budget.json. El rango cambia hipótesis declaradas; no es un intervalo estadístico ni una factura.', '');
  return lines.join('\n');
}
