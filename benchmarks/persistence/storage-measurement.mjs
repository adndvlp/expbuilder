import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import { documentStorage, validateIndexConfiguration } from './storage.mjs';

const require = createRequire(new URL('../../api/functions/package.json', import.meta.url));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const hash = value => createHash('sha256').update(value).digest('hex');

export async function storageMethod() {
  const definition = { id: 'firestore-standard-storage/2',
    sources: { 'benchmarks/persistence/storage.mjs': hash(await readFile(new URL('./storage.mjs', import.meta.url))) },
    sdk: { name: '@google-cloud/firestore', version: require('@google-cloud/firestore/package.json').version } };
  return { ...definition, sha256: hash(canonical(definition)) };
}
export async function storageMeasurement(config) {
  validateIndexConfiguration(config);
  return { method: await storageMethod(), unit: 'byte', provenance: 'derived',
    source: 'Native Firestore inventory with documented document, single-field and composite index formulas; not JSON byte length or billing telemetry',
    documentation: ['https://firebase.google.com/docs/firestore/storage-size',
      'https://firebase.google.com/docs/firestore/query-data/index-overview#automatic_index_defaults',
      'https://firebase.google.com/docs/reference/firestore/indexes'],
    indexConfiguration: { value: globalThis.structuredClone(config), sha256: hash(canonical(config)),
      provenance: 'observed', source: 'api/firestore.indexes.json' } };
}
export function storageInventory(documents, config) {
  validateIndexConfiguration(config);
  const groups = {};
  for (const [path, data] of documents) {
    const group = path.split('/').at(-2), size = documentStorage(path, data, config);
    const entry = groups[group] ||= { documents: 0, documentBytes: 0,
      automaticIndexBytes: 0, automaticIndexEntries: 0, compositeBytes: 0, compositeIndexEntries: 0,
      indexBytes: 0, indexEntries: 0, storedBytes: 0 };
    for (const key of Object.keys(entry)) entry[key] += key === 'documents' ? 1 : size[key];
  }
  return groups;
}
