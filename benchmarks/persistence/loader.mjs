// Test process only. Deployed source and dependencies are never rewritten.
import { URL } from 'node:url';
import { instrumentInputs } from './instrument-inputs.mjs';
const app = new URL('../../api/functions/app.js', import.meta.url).href;
const bridge = new URL('./bridge.mjs', import.meta.url).href;
const root = new URL('../../', import.meta.url).href;
const inputs = new URL('./node-inputs.mjs', import.meta.url).href;
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
  const loaded = await next(url, context);
  const relative = url.startsWith(root) ? url.slice(root.length).split('?')[0] : '';
  if (loaded.format === 'module' && /^(api\/functions\/experiment\/|server\/routes\/).*\.js$/.test(relative)) {
    return { ...loaded, source: `import { nodeInputs as __costInputs } from ${JSON.stringify(inputs)};\n` + instrumentInputs(loaded.source.toString(), { scope: relative }) };
  }
  return loaded;
}
