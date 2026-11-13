import { observeRealtimeDatabase } from '../core/adapters.mjs';
import { quantity } from '../core/quantity.mjs';
const { window } = globalThis;
const pending = new Set();
function emit(method, ...args) {
  const promise = window.__benchmarkMetric(method, args);
  pending.add(promise); promise.finally(() => pending.delete(promise));
}
const meter = {
  declare(names) { for (const name of names) emit('add', name, 0); },
  add: (...args) => emit('add', ...args), addQuantity: (...args) => emit('addQuantity', ...args),
  unknown: (...args) => emit('unknown', ...args), unsupported(operation) { emit('unknown', 'browser.coverage', 'count', operation); throw new Error(operation); },
};
// JSON is observed. Protocol/TLS is a declared model, never labelled wire measurement.
const transferBytes = ({ direction, payloadJsonBytes = 0 }) => ({
  download: quantity((direction === 'read' ? payloadJsonBytes : 0) + 512, 'byte', { provenance: 'assumed', source: 'RTDB decoded JSON plus 512 bytes per exchange including protocol; connection TLS budgeted separately' }),
  upload: quantity((direction === 'write' ? payloadJsonBytes : 0) + 256, 'byte', { provenance: 'assumed', source: 'RTDB decoded JSON plus 256 bytes outbound protocol' }),
});
const native = window.firebase.database;
const databases = new WeakMap();
function observedDatabase(...args) {
  const database = native(...args);
  if (!databases.has(database)) databases.set(database, observeRealtimeDatabase(database, meter, { transferBytes }));
  return databases.get(database);
}
Object.setPrototypeOf(observedDatabase, native);
window.firebase.database = observedDatabase;
window.__benchmarkDrain = async () => { while (pending.size) await Promise.all([...pending]); };
