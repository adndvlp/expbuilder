const owners = new WeakMap();
const builders = new Set(['collection', 'collectionGroup', 'doc', 'where', 'orderBy', 'limit', 'limitToLast',
  'offset', 'select', 'startAt', 'startAfter', 'endAt', 'endBefore', 'withConverter']);
const mutations = new Set(['set', 'create', 'update', 'delete']);

export function observeFirestore(database, meter, { queryIndexReads } = {}) {
  if (owners.has(database)) {
    if (owners.get(database) !== meter) throw new Error('Firestore object already observed by another meter');
    return database;
  }
  const wrapped = new WeakMap(), originals = new WeakMap();
  const unwrap = ref => originals.get(ref) || ref;
  meter.declare(['firestore.readCalls', 'firestore.readFailures', 'firestore.queries', 'firestore.documentsReturned',
    'firestore.writeAttempts', 'firestore.deleteAttempts', 'firestore.writes', 'firestore.deletes',
    'firestore.writeFailures', 'firestore.transactionAttempts', 'firestore.transactionFailures',
    'firestore.batchAttempts', 'firestore.batchFailures']);
  meter.add('firestore.readUnits', 0, { provenance: 'derived', source: 'Document reads with query minimums' });
  const attempt = type => meter.add(type === 'delete' ? 'firestore.deleteAttempts' : 'firestore.writeAttempts', 1);
  const committed = operations => {
    for (const type of operations) meter.add(type === 'delete' ? 'firestore.deletes' : 'firestore.writes', 1);
  };
  function snapshot(result) {
    return new Proxy(result, { get(target, key) {
      if (key === 'ref') return wrap(target.ref, 'document');
      if (key === 'query') return wrap(target.query, 'query');
      if (key === 'docs') return target.docs.map(snapshot);
      if (key === 'forEach') return (callback, thisArg) => target.docs.map(snapshot).forEach(callback, thisArg);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  async function record(result) {
    if (Array.isArray(result)) return Promise.all(result.map(record));
    if (Array.isArray(result.docs)) {
      meter.add('firestore.queries', 1);
      meter.add('firestore.documentsReturned', result.docs.length);
      meter.add('firestore.readUnits', Math.max(1, result.docs.length), { provenance: 'derived', source: 'Document reads with query minimums' });
      if (queryIndexReads) {
        try { meter.addQuantity('firestore.indexReadUnits', convertQuantity(await queryIndexReads({ documentsReturned: result.docs.length }), 'count')); }
        catch { meter.unknown('firestore.indexReadUnits', 'count', 'Query index billing model failed'); }
      } else meter.unknown('firestore.indexReadUnits', 'count', 'Query index billing was not modeled');
    } else {
      meter.add('firestore.documentsReturned', result.exists ? 1 : 0);
      meter.add('firestore.readUnits', 1, { provenance: 'derived', source: 'Document reads with query minimums' });
    }
    return snapshot(result);
  }
  async function read(operation) {
    meter.add('firestore.readCalls', 1);
    let result;
    try { result = await operation(); }
    catch (error) { meter.add('firestore.readFailures', 1); throw error; }
    return record(result);
  }
  function writer(native, operations, batch = false) {
    let proxy, commits = 0;
    proxy = new Proxy(native, { get(target, key) {
      if (key === 'get') return (ref, ...args) => read(() => target.get(unwrap(ref), ...args));
      if (key === 'getAll') return (...refs) => read(() => target.getAll(...refs.map(unwrap)));
      if (mutations.has(key)) return (ref, ...args) => {
        attempt(key);
        try { target[key](unwrap(ref), ...args); operations.push(key); }
        catch (error) { meter.add('firestore.writeFailures', 1); throw error; }
        return proxy;
      };
      if (key === 'commit' && batch) return async () => {
        meter.add('firestore.batchAttempts', 1);
        if (commits++) for (const type of operations) attempt(type);
        try { const result = await target.commit(); committed(operations); return result; }
        catch (error) { meter.add('firestore.batchFailures', 1); meter.add('firestore.writeFailures', 1); throw error; }
      };
      return meter.unsupported('firestore.writer.' + String(key));
    } });
    return proxy;
  }
  function wrap(native, kind = 'database') {
    if (!native || typeof native !== 'object') return native;
    if (wrapped.has(native)) return wrapped.get(native);
    const proxy = new Proxy(native, { get(target, key) {
      if (key === 'firestore') return wrap(database);
      if (key === 'parent') return wrap(target.parent, kind === 'document' ? 'query' : 'document');
      if (key === 'runTransaction') return async (callback, ...args) => {
        let operations;
        try {
          const result = await target.runTransaction(async transaction => {
            meter.add('firestore.transactionAttempts', 1); operations = [];
            return callback(writer(transaction, operations));
          }, ...args);
          committed(operations); return result;
        } catch (error) { meter.add('firestore.transactionFailures', 1); throw error; }
      };
      if (key === 'batch') return () => writer(target.batch(), [], true);
      if (key === 'get') return (...args) => read(() => target.get(...args));
      if (key === 'getAll') return (...refs) => read(() => target.getAll(...refs.map(unwrap)));
      if (mutations.has(key)) return async (...args) => {
        attempt(key);
        try { const result = await target[key](...args); committed([key]); return result; }
        catch (error) { meter.add('firestore.writeFailures', 1); throw error; }
      };
      if (key === 'add') return async (...args) => {
        attempt('set');
        try { const result = await target.add(...args); committed(['set']); return wrap(result, 'document'); }
        catch (error) { meter.add('firestore.writeFailures', 1); throw error; }
      };
      if (builders.has(key)) return (...args) => wrap(target[key](...args.map(unwrap)), key === 'doc' ? 'document' : 'query');
      if (['count', 'aggregate', 'stream', 'onSnapshot', 'bulkWriter', 'recursiveDelete'].includes(key)) {
        return () => meter.unsupported('firestore.' + key);
      }
      const value = Reflect.get(target, key, target);
      if (typeof value === 'function') {
        if (['isEqual', 'toString', 'toJSON'].includes(key)) return value.bind(target);
        return () => meter.unsupported('firestore.' + String(key));
      }
      return value;
    } });
    wrapped.set(native, proxy); originals.set(proxy, native); owners.set(proxy, meter);
    return proxy;
  }
  return wrap(database);
}
import { convertQuantity } from './quantity.mjs';

