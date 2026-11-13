import { convertQuantity } from './quantity.mjs';
const owners = new WeakMap();
const builders = new Set(['collection', 'collectionGroup', 'doc', 'where', 'orderBy', 'limit', 'limitToLast',
  'offset', 'select', 'startAt', 'startAfter', 'endAt', 'endBefore', 'withConverter']);
const mutations = new Set(['set', 'create', 'update', 'delete']);

export function observeFirestore(database, meter, { queryIndexReads, onCommitted } = {}) {
  if (owners.has(database)) {
    if (owners.get(database) !== meter) throw new Error('Firestore object already observed by another meter');
    return database;
  }
  const wrapped = new WeakMap(), originals = new WeakMap(), shapes = new WeakMap();
  const unwrap = ref => originals.get(ref) || ref;
  meter.declare(['firestore.readCalls', 'firestore.readFailures', 'firestore.queries', 'firestore.documentsReturned',
    'firestore.writeAttempts', 'firestore.deleteAttempts', 'firestore.writes', 'firestore.deletes',
    'firestore.writeFailures', 'firestore.transactionAttempts', 'firestore.transactionFailures',
    'firestore.batchAttempts', 'firestore.batchFailures', 'firestore.directWriteCalls']);
  meter.add('firestore.readUnits', 0, { provenance: 'derived', source: 'Document reads with query minimums' });
  const attempt = type => meter.add(type === 'delete' ? 'firestore.deleteAttempts' : 'firestore.writeAttempts', 1);
  const committed = async operations => {
    for (const { type } of operations) meter.add(type === 'delete' ? 'firestore.deletes' : 'firestore.writes', 1);
    if (onCommitted && operations.length) {
      try { await onCommitted(operations); }
      catch { meter.unknown('firestore.commitObservation', 'count', 'Commit observer failed; trigger/storage coverage incomplete'); }
    }
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
  async function record(result, query) {
    if (Array.isArray(result)) return Promise.all(result.map(record));
    if (Array.isArray(result.docs)) {
      meter.add('firestore.queries', 1);
      meter.add('firestore.documentsReturned', result.docs.length);
      meter.add('firestore.readUnits', Math.max(1, result.docs.length), { provenance: 'derived', source: 'Document reads with query minimums' });
      if (queryIndexReads) {
        try { meter.addQuantity('firestore.indexReadUnits', convertQuantity(await queryIndexReads({ documentsReturned: result.docs.length, query: shapes.get(query) || { filters: [], orderBy: [], offset: 0 } }), 'count')); }
        catch { meter.unknown('firestore.indexReadUnits', 'count', 'Query index billing model failed'); }
      } else meter.unknown('firestore.indexReadUnits', 'count', 'Query index billing was not modeled');
    } else {
      meter.add('firestore.documentsReturned', result.exists ? 1 : 0);
      meter.add('firestore.readUnits', 1, { provenance: 'derived', source: 'Document reads with query minimums' });
    }
    return snapshot(result);
  }
  async function read(operation, query) {
    meter.add('firestore.readCalls', 1);
    let result;
    try { result = await operation(); }
    catch (error) { meter.add('firestore.readFailures', 1); throw error; }
    return record(result, query);
  }
  function writer(native, operations, batch = false) {
    let proxy, commits = 0;
    proxy = new Proxy(native, { get(target, key) {
      if (key === 'get') return (ref, ...args) => read(() => target.get(unwrap(ref), ...args), unwrap(ref));
      if (key === 'getAll') return (...refs) => read(() => target.getAll(...refs.map(unwrap)));
      if (mutations.has(key)) return (ref, ...args) => {
        attempt(key);
        try { target[key](unwrap(ref), ...args); operations.push({ type: key, ref: unwrap(ref) }); }
        catch (error) { meter.add('firestore.writeFailures', 1); throw error; }
        return proxy;
      };
      if (key === 'commit' && batch) return async () => {
        meter.add('firestore.batchAttempts', 1);
        if (commits++) for (const { type } of operations) attempt(type);
        try { const result = await target.commit(); await committed(operations); return result; }
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
          await committed(operations); return result;
        } catch (error) { meter.add('firestore.transactionFailures', 1); throw error; }
      };
      if (key === 'batch') return () => writer(target.batch(), [], true);
      if (key === 'get') return (...args) => read(() => target.get(...args), target);
      if (key === 'getAll') return (...refs) => read(() => target.getAll(...refs.map(unwrap)));
      if (mutations.has(key)) return async (...args) => {
        meter.add('firestore.directWriteCalls', 1);
        attempt(key);
        try { const result = await target[key](...args); await committed([{ type: key, ref: target }]); return result; }
        catch (error) { meter.add('firestore.writeFailures', 1); throw error; }
      };
      if (key === 'add') return async (...args) => {
        meter.add('firestore.directWriteCalls', 1);
        attempt('set');
        try { const result = await target.add(...args); await committed([{ type: 'set', ref: result }]); return wrap(result, 'document'); }
        catch (error) { meter.add('firestore.writeFailures', 1); throw error; }
      };
      if (builders.has(key)) return (...args) => {
        const next = target[key](...args.map(unwrap));
        const shape = shapes.get(target) || { filters: [], orderBy: [], offset: 0 };
        shapes.set(next, { filters: key === 'where' ? [...shape.filters, { field: String(args[0]), operator: args[1] }] : shape.filters,
          orderBy: key === 'orderBy' ? [...shape.orderBy, String(args[0])] : shape.orderBy,
          offset: key === 'offset' ? args[0] : shape.offset });
        return wrap(next, key === 'doc' ? 'document' : 'query');
      };
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

