// Keep timestamp writes native so the actual RTDB rules still validate them.
// Calendar views wrap the observer's returned snapshots, after raw-byte accounting.
export function controlDatabaseTimestamps(database, { disconnectAt = () => {}, cancelled = () => {}, readPresence = (_path, value) => value } = {}) {
  const objects = new WeakMap();
  function snapshot(native, path) {
    return new Proxy(native, { get(target, key) {
      if (key === 'val') return () => readPresence(path, target.val());
      const item = Reflect.get(target, key, target); return typeof item === 'function' ? item.bind(target) : item;
    } });
  }
  function wrap(native, path = '', disconnect = false) {
    if (objects.has(native)) return objects.get(native);
    const proxy = new Proxy(native, { get(target, key) {
      if (key === 'ref' || key === 'child' || key === 'refFromURL') return (...args) => {
        const ref = target[key](...args), refPath = new globalThis.URL(ref.toString()).pathname;
        return wrap(ref, refPath);
      };
      if (key === 'onDisconnect') return () => wrap(target.onDisconnect(), path, true);
      if (disconnect && ['set','update','setWithPriority'].includes(key)) return (...args) => { disconnectAt(path); return target[key](...args); };
      if (disconnect && key === 'cancel') return async (...args) => { const result = await target.cancel(...args); cancelled(path); return result; };
      if (key === 'once' || key === 'get') return async (...args) => snapshot(await target[key](...args), path);
      const item = Reflect.get(target, key, target);
      return typeof item === 'function' ? item.bind(target) : item;
    } });
    objects.set(native, proxy); return proxy;
  }
  return wrap(database);
}
