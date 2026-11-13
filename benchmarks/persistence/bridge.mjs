import { createRequire } from 'node:module';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { observeTaskQueue, payloadJsonBytes } from '../core/adapters.mjs';
import { taskOptions } from './dispatcher.mjs';
import { deliveries } from '../../api/persistence-e2e/task-queue.mjs';
const require = createRequire(new URL('../../api/functions/package.json', import.meta.url));
const nativeDatabase = require('firebase-admin/database').getDatabase;
const fetchModule = require('node-fetch'), fetch = fetchModule.default || fetchModule;
export const state = { active: null, nativeDb: null, failEnqueue: false };
export function database(native) {
  state.nativeDb = native;
  return new Proxy(native, { get(target, key) {
    const object = state.active?.observedDb || target;
    const value = Reflect.get(object, key, object);
    return typeof value === 'function' ? value.bind(object) : value;
  } });
}
export function getDatabase(...args) {
  const db = nativeDatabase(...args);
  return state.active ? state.active.realtime(db) : db;
}
export const getFunctions = () => ({ taskQueue: name => {
  const queue = { async enqueue(data, options = {}) {
    if (state.failEnqueue) { state.failEnqueue = false; throw Object.assign(new Error('Injected task service unavailable'), { code: 'BENCHMARK_TASK_PLATFORM_FAILURE' }); }
    deliveries.push({ name, data, due: options.scheduleTime?.getTime() || Date.now() });
  } };
  return state.active ? observeTaskQueue(queue, state.active.meter, taskOptions) : queue;
} });
export default async function measuredFetch(url, options = {}) {
  const active = state.active;
  if (!active) return fetch(url, options);
  const endpoint = new URL(url);
  if (endpoint.hostname !== '127.0.0.1') throw new Error('Benchmark refuses external provider traffic');
  const provider = ['googledrive', 'dropbox', 'osf'].find(name => {
    const key = { googledrive: 'GOOGLE_DRIVE_API_BASE', dropbox: 'DROPBOX_API_BASE', osf: 'OSF_API_BASE' }[name];
    return process.env[key] === endpoint.origin;
  });
  if (!provider) throw new Error('Provider traffic outside measured scope: ' + endpoint.origin);
  const prefix = 'provider.' + provider, meter = active.meter;
  meter.add(prefix + '.requests', 1);
  const bodyBytes = options.body == null ? 0 : typeof options.body === 'string' || Buffer.isBuffer(options.body)
    ? Buffer.byteLength(options.body) : payloadJsonBytes(options.body);
  meter.add(prefix + '.requestContentBytes', bodyBytes, { unit: 'byte', source: 'HTTP entity body; excludes headers/TLS' });
  try {
    const response = await fetch(url, options);
    // Buffer the controlled fixture response so all body bytes (including error bodies) are counted once.
    const body = Buffer.from(await response.arrayBuffer());
    meter.add(prefix + '.responseContentBytes', body.byteLength, { unit: 'byte', source: 'HTTP entity body; excludes headers/TLS' });
    if (!response.ok) meter.add(prefix + '.httpErrors', 1);
    return new fetchModule.Response(body, { status: response.status, statusText: response.statusText, headers: response.headers, url: response.url });
  } catch (error) { meter.add(prefix + '.transportFailures', 1); throw error; }
}
