import { randomUUID } from 'node:crypto';
let current = null;
export const selectNodeInputs = inputs => { current = inputs; };
export const nodeInputs = {
  id: actor => current ? current.id(actor) : randomUUID(),
  random: actor => current ? current.random(actor) : Math.random(),
  number: actor => current ? current.number(actor) : Date.now(),
  date: (...args) => current ? current.date(...args) : new Date(...args),
};
