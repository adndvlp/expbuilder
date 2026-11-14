import { observeTaskHandler, payloadJsonBytes } from '../core/adapters.mjs';
import { quantity } from '../core/quantity.mjs';
export const taskOptions = {
  blockBytes: 32768,
  billableBytes: ({ payload }) => quantity(payloadJsonBytes(payload) + 1024, 'byte', {
    provenance: 'assumed', source: 'JSON task payload plus 1024 bytes of task HTTP/envelope; 32KiB billing chunks' }),
  classifyError: error => error.code === 'BENCHMARK_TASK_PLATFORM_FAILURE' ? 'platform' : 'unknown',
};
export function createDispatcher({ meter, definitions, queue, now = Date.now }) {
  const events = [], start = now(), schedules = new Map(), handlers = new Map();
  for (const definition of definitions) {
    handlers.set(definition.name, { ...definition, observed: definition.origin === 'task'
      ? observeTaskHandler(definition.handler, meter, { ...taskOptions, name: definition.name })
      : meter.wrapFunction(definition.name, definition.handler, { origin: definition.origin }) });
    if (definition.origin === 'schedule') schedules.set(definition.name, start + definition.intervalMs);
  }
  const event = (name, data, payloadBytes = payloadJsonBytes(data)) => {
    if (!handlers.has(name)) throw new Error('Unregistered event: ' + name);
    meter.add('events.published', 1);
    meter.add('events.publishedPayloadBytes', payloadBytes, { unit: 'byte', source: 'Event before/after JSON content; envelope and protobuf transport modeled separately' });
    events.push({ name, data, payloadBytes, due: now(), attempt: 0 });
  };
  async function deliver(item, isTask) {
    const name = item.name.split('/').at(-1), definition = handlers.get(name);
    if (!definition) throw new Error('Unregistered delivery: ' + name);
    if (definition.origin === 'firestore' || definition.origin === 'database') {
      meter.add('events.deliveredPayloadBytes', item.payloadBytes, { unit: 'byte', source: 'Event delivery JSON content; envelope and protobuf transport modeled separately' });
    }
    if (item.attempt) meter.add(isTask ? 'tasks.retries' : 'events.retries', 1);
    try { await definition.observed(isTask ? { data: item.data, retryCount: item.attempt || 0 } : item.data); }
    catch (error) {
      const retry = definition.retry, attempt = (item.attempt || 0) + 1;
      if (!retry || attempt >= retry.maxAttempts) throw new Error('Delivery exhausted: ' + name, { cause: error });
      const delay = Math.min(retry.maxBackoffSeconds, retry.minBackoffSeconds * 2 ** Math.min(attempt - 1, retry.maxDoublings));
      (isTask ? queue : events).push({ ...item, attempt, due: now() + delay * 1000 });
    }
  }
  return { event,
    async pump() {
      // New events produced by a commit are drained in order before delivering the next task.
      let iterations = 0;
      while (true) {
        if (++iterations > 10000) throw new Error('Dispatcher did not reach quiescence');
        for (const [name, due] of schedules) {
          let next = due;
          while (next <= now()) { events.push({ name, due: next, data: {}, attempt: 0 }); next += handlers.get(name).intervalMs; }
          schedules.set(name, next);
        }
        const index = events.findIndex(item => item.due <= now());
        if (index >= 0) { await deliver(events.splice(index, 1)[0], false); continue; }
        const task = queue.findIndex(item => item.due <= now());
        if (task < 0) break;
        await deliver(queue.splice(task, 1)[0], true);
      }
    },
    pending() { return { events: events.length, tasks: queue.length, futureTasks: queue.filter(item => item.due > now()).length }; },
  };
}
