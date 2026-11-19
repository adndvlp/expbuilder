import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import { log } from 'node:console';
import { calculateBudget, renderBudget } from '../core/budget.mjs';
import { quantity } from '../core/quantity.mjs';
import { functionUsage } from '../core/models.mjs';

export function buildKnownBudget() {
  const profile = JSON.parse(readFileSync(new URL('../profiles/google-cloud-usd-2026-11-13.json', import.meta.url), 'utf8'));
  const assumed = { provenance: 'assumed', source: 'Arithmetic example only: declared quantities, not measured persistence' };
  const q = (value, unit = 'count') => quantity(value, unit, assumed);
  const compute = functionUsage({ ...assumed, cpu: 1, memoryMiB: 512, roundingMs: 100,
    intervals: [{ instance: 'serial-example', phase: 'active', startMs: 0, endMs: 100 }] }).active;
  const item = (id, rate, amount, scope = 'per-session', category) => ({
    id, rate, quantity: amount, scope, category,
    service: profile.rates[rate].service, location: profile.rates[rate].location,
  });
  return calculateBudget({
    name: 'Referencia aritmética: recursos declarados',
    scope: 'Arithmetic reference only; not a public persistence benchmark. Declared document operations, active compute and one paused job. Storage, network, deployments and supporting services excluded.',
    profile, windowSeconds: 31 * 86400, volumes: [0, 1, 1000, 10000],
    items: [
      item('reads', 'reads', q(3)), item('writes', 'writes', q(3)),
      item('requests', 'requests', q(1)),
      item('cpu', 'cpu', compute.cpuSeconds, 'per-session', 'active'),
      item('memory', 'memory', compute.memoryGiBSeconds, 'per-session', 'active'),
      item('paused-job', 'scheduler', q(31, 'job-day'), 'window'),
    ],
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--json')) throw new Error('Only --json is supported by this arithmetic example');
  const budget = buildKnownBudget();
  log(process.argv.includes('--json') ? JSON.stringify(budget, null, 2) : renderBudget(budget));
}
