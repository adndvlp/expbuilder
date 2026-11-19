import { jest } from '@jest/globals';
import { makeTransactionalFirestore } from '../../helpers/transactional-firestore.js';
const store = makeTransactionalFirestore();
jest.unstable_mockModule('../../../app.js', () => ({ db: store.db }));
const { buildHistoricalPlan } = await import('../../../experiment/sessions/recovery/plan.js');
const { applyHistoricalPlan } = await import('../../../experiment/sessions/recovery/apply.js');
const base = 'experiments/EID/sessions/SID';
let plan;
beforeEach(() => {
  store.reset();
  const experiment = { owner: 'owner', storageProvider: 'googledrive', driveFolderId: 'folder', sessions: 26 };
  const session = { participantNumber: 23, condition: 0, createdAt: '2026-11-05T00:00:00Z', trialCount: 1 };
  const source = { trialsData: JSON.stringify([{ response: 'A', trial_index: 0 }, { response: 'B', trial_index: 1 }]) };
  store.records.set('experiments/EID', experiment); store.records.set(base, session); store.records.set(base + '/trials/old', source);
  plan = buildHistoricalPlan({ projectId: 'demo-test', experimentID: 'EID', sessionId: 'SID', experiment, session, metadata: {}, sources: [{ id: 'old', data: source }], remote: { exists: false } });
});
const apply = () => applyHistoricalPlan(plan, { projectId: 'demo-test', inspectRemote: async () => ({ exists: false }) });
test('applies once, preserves original payloads and identity, and requests one repeatable export', async () => {
  await apply(); await apply();
  expect(store.records.get(base)).toMatchObject({ participantNumber: 23, condition: 0, lifecycle: 'expired', receivedEventCount: 2, exportRequestedRevision: 1 });
  expect(store.records.get('experiments/EID').sessions).toBe(26);
  expect(store.records.get(base + '/recovery_sources/old').data).toEqual(plan.sources[0].data);
  expect(store.records.has(base + '/trials/old')).toBe(false);
  expect([...store.records.keys()].filter(key => key.startsWith(base + '/event_receipts/'))).toHaveLength(2);
});
test('a changed source blocks apply before any write', async () => {
  store.records.set(base + '/trials/old', { trialsData: '[]' }); const before = structuredClone([...store.records]);
  await expect(apply()).rejects.toThrow(); expect([...store.records]).toEqual(before);
});
test('a failed conversion resumes its journal with the same IDs and no duplicate counts', async () => {
  const run = store.db.runTransaction.getMockImplementation(); let calls = 0;
  const spy = jest.spyOn(store.db, 'runTransaction').mockImplementation(callback => { if (++calls === 4) return Promise.reject(new Error('interrupted')); return run(callback); });
  await expect(apply()).rejects.toThrow('interrupted'); spy.mockImplementation(run);
  expect(store.records.has(base + '/recovery_sources/old')).toBe(true);
  await apply(); expect(store.records.get(base).receivedEventCount).toBe(2);
  expect(store.records.get(base).exportRequestedRevision).toBe(1);
});
test('another project or an unexpected remote file cannot mutate the session', async () => {
  const before = structuredClone([...store.records]);
  await expect(applyHistoricalPlan(plan, { projectId: 'different', inspectRemote: async () => ({ exists: false }) })).rejects.toThrow();
  await expect(applyHistoricalPlan(plan, { projectId: 'demo-test', inspectRemote: async () => ({ exists: true }) })).rejects.toThrow();
  expect([...store.records]).toEqual(before);
});
test('receipts arriving after inspection block conversion before any source identity is replaced', async () => {
  store.records.set(base + '/event_receipts/existing', { eventId: 'existing', sequence: 0, payloadHash: 'old-hash' });
  const before = structuredClone([...store.records]);
  await expect(apply()).rejects.toThrow(); expect([...store.records]).toEqual(before);
});
