import { randomUUID } from 'node:crypto';
let current = null, clock = null;
export const selectNodeInputs = (inputs, time = null) => { current = inputs; clock = time; };
export const nodeInputs = {
  id: actor => current ? current.id(actor) : randomUUID(),
  random: actor => current ? current.random(actor) : Math.random(),
  now: () => clock ? clock.now() : Date.now(),
  number: actor => clock && !actor.startsWith('server/') ? clock.now() : current ? current.number(actor) : Date.now(),
  date: (...args) => clock && !args.length ? new Date(clock.now()) : current ? current.date(...args) : new Date(...args),
};
