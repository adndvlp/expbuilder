// Synthetic fixture data only. No browser, SDK or process globals are replaced.
export function createScenarioInputs({ scenario, seed = 'persistence-content-1', epoch = 1794528000000, responseMs = 125, counters = new Map() } = {}) {
  if (typeof scenario !== 'string' || !scenario.trim() || typeof seed !== 'string' || !seed.trim()
      || !Number.isSafeInteger(epoch) || epoch < 0 || !Number.isSafeInteger(responseMs) || responseMs < 1) throw new Error('Invalid controlled scenario inputs');
  const next = actor => {
    if (typeof actor !== 'string' || !actor) throw new Error('An input actor is required');
    const value = counters.get(actor) || 0;
    if (value >= 0xffffffff) throw new Error('Fixture input sequence exhausted');
    counters.set(actor, value + 1); return value;
  };
  const prefix = actor => {
    const text = JSON.stringify([seed, scenario, actor]);
    return [2166136261, 2246822519, 3266489917].map(initial => {
      let value = initial;
      for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
      return (value >>> 0).toString(16).padStart(8, '0');
    }).join('');
  };
  return {
    scenario, seed, epoch, responseMs,
    id(actor) {
      const hex = prefix(actor) + next('id:' + actor).toString(16).padStart(8, '0');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
    },
    number(actor) { return epoch + next('number:' + actor); },
    random(actor) {
      const value = Number.parseInt(prefix(actor).slice(0, 8), 16) ^ next('random:' + actor);
      return (Math.imul(value ^ (value >>> 16), 2246822519) >>> 0) / 0x100000000;
    },
    date(...args) { return args.length ? new Date(...args) : new Date(epoch); },
    conditions() { return { scenario, seed, epoch, responseMs }; },
  };
}
