import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import { createRepeatabilityContract } from '../core/repeatability.mjs';
import { storageMethod } from './storage-measurement.mjs';

const root = new URL('../../', import.meta.url);
async function sourcesIn(directory) {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? sourcesIn(directory + entry.name + '/')
    : entry.name.endsWith('.mjs') ? [directory + entry.name] : []))).flat();
}
export async function persistenceRepeatability(scenarios) {
  // Fixture/coordination definitions and the measurement method. Product sources
  // and index configuration remain separately recorded, comparable observations.
  const names = [
    ...['inputs', 'browser-inputs', 'node-inputs', 'instrument-inputs', 'input-transport', 'loader', 'clock', 'clock-database', 'controller', 'dispatcher', 'scenarios.e2e', 'storage-measurement']
      .map(name => 'benchmarks/persistence/' + name + '.mjs'),
    'api/persistence-e2e/harness.mjs', 'api/persistence-e2e/authoring.mjs',
    'benchmarks/persistence/function-inventory.mjs', 'benchmarks/persistence/model.mjs', 'benchmarks/core/attribution.mjs', 'benchmarks/core/meter.mjs',
    ...await sourcesIn('api/mock-providers/'),
  ].sort();
  const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, createHash('sha256').update(await readFile(new URL(name, root))).digest('hex')])));
  return createRepeatabilityContract(scenarios, { id: 'public-persistence/1', sources, storageMethod: await storageMethod() });
}
