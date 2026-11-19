import { readFileSync } from 'node:fs';
const rules = JSON.parse(readFileSync(new URL('../../../../database.rules.json', import.meta.url))).rules;
function snapshot(value) {
  return { child: key => snapshot(value?.[key]), val: () => value ?? null, exists: () => value != null,
    hasChildren: keys => keys.every(key => value?.[key] != null), isNumber: () => typeof value === 'number',
    isBoolean: () => typeof value === 'boolean', isString: () => typeof value === 'string' };
}
function permits(old, next, lease = { active: true, token: 'secret'.repeat(8), generation: 2 }) {
  const policy = rules.session_connections?.$experimentID.$sessionId.$connectionId;
  if (!policy) return false;
  const root = snapshot({ session_connection_leases: { EID: { S1: { C1: lease } } } });
  return ['.write', '.validate'].every(key => new Function('data', 'newData', 'root', 'now', '$experimentID', '$sessionId', '$connectionId',
    `return (${policy[key]});`)(snapshot(old), snapshot(next), root, 100000, 'EID', 'S1', 'C1'));
}
const active = { connected: true, generation: 2, token: 'secret'.repeat(8), changedAt: 100000 };
test('only a server-issued connection can publish presence with a server timestamp', () => {
  expect(permits(null, active)).toBe(true);
  expect(permits(null, { ...active, token: 'wrong' })).toBe(false);
  expect(permits(null, { ...active, generation: 1 })).toBe(false);
  expect(permits(null, { ...active, changedAt: 99999 })).toBe(false);
});
test('disconnect cannot be replayed to extend a deadline or used to reopen the same generation', () => {
  const disconnected = { ...active, connected: false };
  expect(permits(active, disconnected)).toBe(true);
  expect(permits(disconnected, disconnected)).toBe(false);
  expect(permits(disconnected, active)).toBe(false);
  expect(permits(active, null)).toBe(false);
});
test('a later generation can reconnect, and an obsolete onDisconnect cannot overwrite it', () => {
  const old = { ...active, generation: 1, connected: false };
  expect(permits(old, active)).toBe(true);
  expect(permits(active, old)).toBe(false);
});
