import { Buffer } from 'node:buffer';
import { convertQuantity } from './quantity.mjs';
import { taskUnits } from './models.mjs';

const owners = new WeakMap();
export const payloadJsonBytes = payload => Buffer.byteLength(JSON.stringify(payload ?? null), 'utf8');
function existing(target, meter, kind) {
  const owner = owners.get(target);
  if (!owner) return null;
  if (owner.meter !== meter || owner.kind !== kind) throw new Error('Adapter already observed with another context');
  return target;
}
function owned(target, meter, kind, get) {
  const proxy = new Proxy(target, { get });
  owners.set(proxy, { meter, kind }); return proxy;
}
function plainValue(target, key, meter, service) {
  const value = Reflect.get(target, key, target);
  return typeof value === 'function' ? () => meter.unsupported(service + '.' + String(key)) : value;
}

export function observeOperations(adapter, meter, { service, operations }) {
  if (!/^[\w.-]+$/.test(service) || !Array.isArray(operations)) throw new Error('Service operations required');
  const previous = existing(adapter, meter, service); if (previous) return previous;
  return owned(adapter, meter, service, (target, key) => {
    if (!operations.includes(key)) return plainValue(target, key, meter, service);
    return async (...args) => {
      meter.add(service + '.' + key + '.calls', 1, { source: 'Provider adapter method; not an HTTP request counter' });
      try { return await target[key](...args); }
      catch (error) { meter.add(service + '.' + key + '.failures', 1); throw error; }
    };
  });
}

function modelTaskAccounting(meter, options, context) {
  if (context.classification === 'local' || context.classification === 'platform') {
    meter.add('tasks.billableUnits', 0, { provenance: 'assumed', source: 'Caller-supplied task failure classification: ' + context.classification });
    return;
  }
  if (!['success', 'client'].includes(context.classification)) {
    meter.unknown('tasks.billableUnits', 'count', 'Failed task operation billing classification unknown'); return;
  }
  if (context.operation === 'delete') {
    meter.add('tasks.billableUnits', 1, { provenance: 'derived', source: 'Flat per-task deletion operation' }); return;
  }
  if (!options.billableBytes) {
    meter.unknown('tasks.billableUnits', 'count', 'Task payload/envelope billing size not modeled'); return;
  }
  const bytes = convertQuantity(options.billableBytes(context), 'byte');
  meter.addQuantity('tasks.modeledBytes', bytes);
  meter.addQuantity('tasks.billableUnits', taskUnits(bytes, options.blockBytes));
}
function taskAccounting(meter, options, context) {
  try { modelTaskAccounting(meter, options, context); }
  catch { meter.unknown('tasks.billableUnits', 'count', 'Task billing model unavailable'); }
}
export function observeTaskQueue(queue, meter, options = {}) {
  const previous = existing(queue, meter, 'tasks'); if (previous) return previous;
  meter.declare(['tasks.enqueueAttempts', 'tasks.enqueued', 'tasks.enqueueFailures', 'tasks.deleteAttempts', 'tasks.deleted']);
  return owned(queue, meter, 'tasks', (target, key) => {
    if (!['enqueue', 'delete'].includes(key)) return plainValue(target, key, meter, 'tasks');
    return async (...args) => {
      meter.add(key === 'enqueue' ? 'tasks.enqueueAttempts' : 'tasks.deleteAttempts', 1);
      if (key === 'enqueue') meter.add('tasks.payloadJsonBytes', payloadJsonBytes(args[0]), { unit: 'byte', source: 'Serialized task payload; excludes protocol/envelope overhead' });
      let result;
      try { result = await target[key](...args); }
      catch (error) {
        meter.add('tasks.' + key + 'Failures', 1);
        try {
          taskAccounting(meter, options, { operation: key, payload: args[0], options: args[1],
            classification: options.classifyError?.(error) || 'unknown' });
        } catch { meter.unknown('tasks.billableUnits', 'count', 'Failed task operation billing model unavailable'); }
        throw error;
      }
      meter.add(key === 'enqueue' ? 'tasks.enqueued' : 'tasks.deleted', 1);
      taskAccounting(meter, options, { operation: key, payload: args[0], options: args[1], result, classification: 'success' });
      return result;
    };
  });
}
export function observeTaskHandler(handler, meter, options) {
  return meter.wrapFunction(options.name, async function (request, ...args) {
    meter.add('tasks.deliveries', 1);
    meter.add('tasks.deliveryPayloadJsonBytes', payloadJsonBytes(request.data), { unit: 'byte', source: 'Serialized delivered payload; excludes protocol/envelope overhead' });
    taskAccounting(meter, options, { operation: 'delivery', payload: request.data, classification: 'success' });
    return handler.call(this, request, ...args);
  }, { origin: 'task' });
}

export function observeRealtimeDatabase(database, meter, { transferBytes } = {}) {
  const previous = existing(database, meter, 'rtdb'); if (previous) return previous;
  const refs = new WeakMap();
  meter.declare(['rtdb.readCalls', 'rtdb.readFailures', 'rtdb.writeAttempts', 'rtdb.writeFailures',
    'rtdb.writes', 'rtdb.listenerRegistrations', 'rtdb.listenerDeliveries', 'rtdb.listenerFailures']);
  function wire(context) {
    let modeled;
    try { modeled = transferBytes?.(context); } catch { /* Keep SDK results/errors; report missing measurement. */ }
    for (const direction of ['download', 'upload']) {
      try {
        if (!modeled?.[direction]) throw new Error('Missing transfer quantity');
        meter.addQuantity('rtdb.' + direction + 'Bytes', convertQuantity(modeled[direction], 'byte'));
      } catch { meter.unknown('rtdb.' + direction + 'Bytes', 'byte', 'Realtime ' + direction + ' including protocol/TLS was not modeled'); }
    }
  }
  function snapshot(native) {
    return new Proxy(native, { get(target, key) {
      if (key === 'ref') return ref(target.ref);
      if (key === 'child') return (...args) => snapshot(target.child(...args));
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  function delivered(native, listener = false) {
    if (listener) meter.add('rtdb.listenerDeliveries', 1);
    const jsonBytes = payloadJsonBytes(native.val());
    meter.add('rtdb.payloadReadBytes', jsonBytes, { unit: 'byte', source: 'Decoded JSON content; not downloaded protocol bytes' });
    wire({ direction: 'read', outcome: 'success', payloadJsonBytes: jsonBytes });
    return snapshot(native);
  }
  function ref(native) {
    if (!native) return native;
    if (refs.has(native)) return refs.get(native);
    const listeners = new Map();
    const builders = new Set(['child', 'orderByChild', 'orderByKey', 'orderByValue', 'orderByPriority',
      'equalTo', 'startAt', 'startAfter', 'endAt', 'endBefore', 'limitToFirst', 'limitToLast']);
    const proxy = new Proxy(native, { get(target, key) {
      if (key === 'parent' || key === 'root') return ref(target[key]);
      if (builders.has(key)) return (...args) => ref(target[key](...args));
      if (key === 'get' || key === 'once') return async (...args) => {
        meter.add('rtdb.readCalls', 1);
        let seen = false;
        const consume = value => { if (seen) return snapshot(value); seen = true; return delivered(value); };
        if (key === 'once' && typeof args[1] === 'function') {
          const callback = args[1];
          args[1] = function (value, ...extra) { return callback.call(this, consume(value), ...extra); };
        }
        let result;
        try { result = await target[key](...args); }
        catch (error) {
          if (!seen) { meter.add('rtdb.readFailures', 1); wire({ direction: 'read', outcome: 'failure' }); }
          throw error;
        }
        return consume(result);
      };
      if (['set', 'update', 'remove'].includes(key)) return async (...args) => {
        meter.add('rtdb.writeAttempts', 1);
        const bytes = key === 'remove' ? 0 : payloadJsonBytes(args[0]);
        meter.add('rtdb.payloadWriteBytes', bytes, { unit: 'byte', source: 'Submitted JSON content; not wire/download volume' });
        let result;
        try { result = await target[key](...args); }
        catch (error) {
          meter.add('rtdb.writeFailures', 1); wire({ direction: 'write', outcome: 'failure', payloadJsonBytes: bytes });
          throw error;
        }
        meter.add('rtdb.writes', 1); wire({ direction: 'write', outcome: 'success', payloadJsonBytes: bytes }); return result;
      };
      if (key === 'on') return (event, callback, ...args) => {
        meter.add('rtdb.listenerRegistrations', 1);
        const map = listeners.get(event) || new Map();
        const observed = map.get(callback) || function (value, ...extra) { return callback.call(this, delivered(value, true), ...extra); };
        map.set(callback, observed); listeners.set(event, map);
        if (typeof args[0] === 'function') {
          const cancelled = args[0];
          args[0] = function (error, ...extra) {
            meter.add('rtdb.listenerFailures', 1);
            wire({ direction: 'read', outcome: 'failure', listener: true });
            return cancelled.call(this, error, ...extra);
          };
        }
        const result = target.on(event, observed, ...args);
        return result === observed ? callback : result;
      };
      if (key === 'off') return (event, callback, ...args) => {
        const map = listeners.get(event), observed = map?.get(callback) || callback;
        const result = target.off(event, observed, ...args);
        if (!event) listeners.clear(); else if (!callback) listeners.delete(event); else map?.delete(callback);
        return result;
      };
      if (key === 'toString' || key === 'isEqual') return target[key].bind(target);
      return plainValue(target, key, meter, 'rtdb');
    } });
    refs.set(native, proxy); return proxy;
  }
  return owned(database, meter, 'rtdb', (target, key) => {
    if (key === 'ref' || key === 'refFromURL') return (...args) => ref(target[key](...args));
    if (key === 'goOnline' || key === 'goOffline') return (...args) => {
      meter.add('rtdb.' + key + 'Requests', 1); return target[key](...args);
    };
    return plainValue(target, key, meter, 'rtdb');
  });
}

