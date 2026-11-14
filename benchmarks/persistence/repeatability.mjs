import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import { createRepeatabilityContract } from '../core/repeatability.mjs';

const root = new URL('../../', import.meta.url);
async function sourcesIn(directory) {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? sourcesIn(directory + entry.name + '/')
    : entry.name.endsWith('.mjs') ? [directory + entry.name] : []))).flat();
}
export async function persistenceRepeatability(scenarios) {
  // Fixture/coordination definitions only. Product sources and measurement results
  // have separate fingerprints and must remain comparable when consumption changes.
  const names = [
    ...['inputs', 'browser-inputs', 'node-inputs', 'instrument-inputs', 'input-transport', 'loader', 'clock', 'clock-database', 'controller', 'dispatcher', 'scenarios.e2e']
      .map(name => 'benchmarks/persistence/' + name + '.mjs'),
    'api/persistence-e2e/harness.mjs', 'api/persistence-e2e/authoring.mjs',
    ...await sourcesIn('api/mock-providers/'),
  ].sort();
  const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, createHash('sha256').update(await readFile(new URL(name, root))).digest('hex')])));
  return createRepeatabilityContract(scenarios, { id: 'public-persistence/1', sources });
}
