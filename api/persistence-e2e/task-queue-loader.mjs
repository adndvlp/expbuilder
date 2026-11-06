// Cloud Tasks is the only Firebase service replaced in this harness. HTTP
// handlers, Firestore transactions, RTDB rules and provider adapters stay real.
export async function resolve(specifier, context, next) {
  if (specifier === 'firebase-admin/functions') return { url: new URL('./task-queue.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
