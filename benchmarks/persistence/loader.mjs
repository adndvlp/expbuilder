// Test process only. Deployed source and dependencies are never rewritten.
import { URL } from 'node:url';
const app = new URL('../../api/functions/app.js', import.meta.url).href;
const bridge = new URL('./bridge.mjs', import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (specifier === 'firebase-admin/functions') return { url: bridge + '?tasks', shortCircuit: true };
  if (specifier === 'firebase-admin/database') return { url: bridge + '?database', shortCircuit: true };
  if (specifier === 'node-fetch') return { url: bridge + '?fetch', shortCircuit: true };
  const resolved = await next(specifier, context);
  if (resolved.url === app) return { url: app + '?benchmark', shortCircuit: true };
  return resolved;
}
export async function load(url, context, next) {
  if (url === app + '?benchmark') return { format: 'module', shortCircuit: true, source:
    `import { app, db as native } from ${JSON.stringify(app + '?native')}; import { database } from ${JSON.stringify(bridge)}; export {app}; export const db=database(native);` };
  // All substitutions share a single state, independent of the requested facade.
  if (url.startsWith(bridge + '?')) return { format: 'module', shortCircuit: true, source:
    `export {getFunctions,getDatabase,default} from ${JSON.stringify(bridge)};` };
  return next(url, context);
}
