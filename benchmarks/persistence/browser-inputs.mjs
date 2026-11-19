import { createScenarioInputs } from './inputs.mjs';

export function installBrowserInputs(window, conditions) {
  const timed = typeof window.__benchmarkTime === 'function';
  let currentTime;
  let responsesSettled = () => Promise.resolve();
  const now = () => timed ? currentTime : (window.Date || Date).now();
  const synchronize = async (action, data) => {
    if (!timed) return;
    await window.__benchmarkDrain?.(); currentTime = Math.max(currentTime, await window.__benchmarkTime(action, data));
  };
  const fallback = new Map(), prefix = '__cost-inputs:' + JSON.stringify(conditions) + ':';
  const counters = {
    get(key) { return window.localStorage ? Number(window.localStorage.getItem(prefix + key) || 0) : fallback.get(key); },
    set(key, value) { if (window.localStorage) window.localStorage.setItem(prefix + key, String(value)); else fallback.set(key, value); },
  };
  const inputs = createScenarioInputs({ ...conditions, scenario: conditions.scenario + '/participant-' + (conditions.participant || 1), counters,
    ...(timed && {now}) });
  currentTime = inputs.epoch;
  const disconnects = new Map();
  window.__costInputs = {
    ...inputs,
    now,
    number: actor => timed ? now() : inputs.number(actor),
    ready: synchronize('sync'),
    whenResponsesSettled: () => responsesSettled(),
    disconnectAt(path) { if (!disconnects.has(path)) disconnects.set(path, now() + conditions.timing.disconnectAfterMs); return disconnects.get(path); },
    cancelDisconnect: path => disconnects.delete(path),
    async prepareDisconnect() {
      if (!disconnects.size) throw new Error('No native disconnect registration is pending');
      const [path, at] = [...disconnects].sort((a,b)=>a[1]-b[1])[0];
      await synchronize('disconnect', {path, at});
    },
    async fetch(...args) {
      const body = args[1]?.body;
      const request = typeof body === 'string' ? JSON.parse(body) : null;
      if (request?.action === 'activateConnection') {
        const {experimentID,sessionId,connectionId,connectionGeneration} = request;
        await synchronize('presence', {experimentID,sessionId,connectionId,connectionGeneration});
      } else await synchronize('sync');
      const response = await window.fetch(...args); await synchronize('sync'); return response;
    },
    initJsPsych(options) {
      const update = options.on_data_update;
      let instance, previousUpdate = Promise.resolve();
      responsesSettled = () => previousUpdate;
      instance = window.initJsPsych({ ...options, on_data_update(data) {
        // Declared synthetic participant timing, before the public callback hashes/sends.
        // Runtime/SDK timers and performance diagnostics continue using native clocks.
        const submit = () => {
          const completed = inputs.number('completed-data-timing') - inputs.epoch + 1;
          if (typeof data.rt === 'number') data.rt = inputs.responseMs;
          if (typeof data.time_elapsed === 'number') data.time_elapsed = timed ? now() - inputs.epoch : completed * inputs.responseMs;
          return update?.call(this, data);
        };
        if (!timed) return submit();
        const token = window.ExpBuilderPersistence.start(); instance.pauseExperiment();
        const operation = previousUpdate.then(() => synchronize('response')).then(() => {
          try { return submit(); } finally { window.ExpBuilderPersistence.finish(token); }
        }, error => { window.ExpBuilderPersistence.finish(token); throw error; });
        previousUpdate = operation; return operation;
      } });
      return instance;
    },
  };
  return window.__costInputs;
}
