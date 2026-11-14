import defaults from '../profiles/persistence-timing.json' with { type: 'json' };
const categories = {
  'functions.invocations': 'function', 'firestore.readCalls': 'firestoreRead',
  'firestore.transactionAttempts': 'firestoreCommit', 'firestore.batchAttempts': 'firestoreCommit', 'firestore.directWriteCalls': 'firestoreCommit',
  'rtdb.readCalls': 'realtime', 'rtdb.writeAttempts': 'realtime', 'rtdb.disconnectRegistrations': 'realtime', 'rtdb.disconnectCancellations': 'realtime',
};
export function createScenarioClock({ epoch = 1794528000000, operationMs = defaults.operationMs } = {}) {
  if (!Number.isSafeInteger(epoch) || epoch < 0 || Object.keys(operationMs).sort().join() !== Object.keys(defaults.operationMs).sort().join()
      || Object.values(operationMs).some(value => !Number.isSafeInteger(value) || value < 1)) throw new Error('Invalid scenario clock inputs');
  const durations = {...operationMs}, operations = {}, actions = {}, samples = [];
  let elapsed = 0;
  const add = ms => { if (!Number.isSafeInteger(ms) || ms < 0 || !Number.isSafeInteger(epoch + elapsed + ms)) throw new Error('Invalid scenario advance'); elapsed += ms; };
  const clock = {
    now: () => epoch + elapsed,
    elapsedMs: () => elapsed,
    advance(ms, reason = 'explicit-wait') {
      if (typeof reason !== 'string' || !reason) throw new Error('Advance reason required');
      add(ms); const item = actions[reason] ||= { count:0, milliseconds:0 }; item.count++; item.milliseconds += ms;
    },
    advanceTo(at, reason) { if (at < clock.now()) throw new Error('Scenario clock cannot move backward'); clock.advance(at - clock.now(), reason); },
    observe(name, count) {
      const category = categories[name] || (/^provider\.[^.]+\.requests$/.test(name) ? 'provider' : null);
      if (!category || Number(count) === 0) return;
      if (!Number.isSafeInteger(Number(count)) || Number(count) < 0) throw new Error('Invalid timed operation count');
      add(durations[category] * Number(count)); operations[name] = (operations[name] || 0) + Number(count);
    },
    sample(bytes) {
      if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid observed stored bytes');
      const sample = {atSeconds: elapsed / 1000, bytes};
      if (samples.at(-1)?.atSeconds === sample.atSeconds) samples[samples.length - 1] = sample;
      else samples.push(sample);
    },
    samples: () => globalThis.structuredClone(samples),
    conditions: () => ({epoch, operationMs:{...durations}, provenance:'assumed', source:defaults.source, disconnectAfterMs:defaults.disconnectAfterMs, httpDelivery:defaults.httpDelivery, participantSchedule:defaults.participantSchedule, realtimeCalendar:defaults.realtimeCalendar}),
    snapshot: () => ({epoch, elapsedMs:elapsed, operationMs:{...durations}, operations:{...operations}, actions:globalThis.structuredClone(actions),
      provenance:'assumed', source:defaults.source, disconnectAfterMs:defaults.disconnectAfterMs, httpDelivery:defaults.httpDelivery, participantSchedule:defaults.participantSchedule, realtimeCalendar:defaults.realtimeCalendar}),
  };
  return clock;
}
export function timeMeter(meter, clock) {
  const add = meter.add;
  meter.add = (name, value, metadata = {}) => { const result = add.call(meter, name, value, metadata); if (!metadata.unit || metadata.unit === 'count') clock.observe(name, value); return result; };
  return meter;
}
