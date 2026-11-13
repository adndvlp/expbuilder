import { createScenarioInputs } from './inputs.mjs';

export function installBrowserInputs(window, conditions) {
  const fallback = new Map(), prefix = '__cost-inputs:' + JSON.stringify(conditions) + ':';
  const counters = {
    get(key) { return window.localStorage ? Number(window.localStorage.getItem(prefix + key) || 0) : fallback.get(key); },
    set(key, value) { if (window.localStorage) window.localStorage.setItem(prefix + key, String(value)); else fallback.set(key, value); },
  };
  const inputs = createScenarioInputs({ ...conditions, scenario: conditions.scenario + '/participant-' + (conditions.participant || 1), counters });
  window.__costInputs = {
    ...inputs,
    initJsPsych(options) {
      const update = options.on_data_update;
      return window.initJsPsych({ ...options, on_data_update(data) {
        // Declared synthetic participant timing, before the public callback hashes/sends.
        // Runtime/SDK timers and performance diagnostics continue using native clocks.
        const completed = inputs.number('completed-data-timing') - inputs.epoch + 1;
        if (typeof data.rt === 'number') data.rt = inputs.responseMs;
        if (typeof data.time_elapsed === 'number') data.time_elapsed = completed * inputs.responseMs;
        return update?.call(this, data);
      } });
    },
  };
  return window.__costInputs;
}
