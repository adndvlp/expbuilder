import { URL } from 'node:url';
const names = ['googledrive', 'dropbox', 'osf', 'github'];
export function createProviderTransport() {
  const routes = new Map();
  return {
    register(name, actual) {
      const index = names.indexOf(name), url = new URL(actual);
      if (index < 0 || url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || url.username || url.password) throw new Error('A known loopback provider is required');
      const logical = `http://127.0.0.1:${41000 + index}`;
      routes.set(logical, url.origin); return logical;
    },
    resolve(value) {
      const url = new URL(value), actual = routes.get(url.origin);
      if (!actual) throw new Error('Benchmark refuses unregistered provider traffic: ' + url.origin);
      return actual + url.pathname + url.search;
    },
  };
}
