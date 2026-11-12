import { jest } from '@jest/globals';
import { store, base, token, setup, request, create, resume, activate, presence, connection, event } from './lifecycle-test-harness.js';

let time = 100000;
beforeEach(() => { setup(); time = 100000; jest.spyOn(Date, 'now').mockImplementation(() => time); });
afterEach(() => jest.restoreAllMocks());
const append = (generation = 1, id = 'C1', sequence = 0) => request({ action: 'appendEvents', ...connection(id, generation), data: { protocolVersion: 1, events: [event(sequence)] } });
async function connected() { const result = await create(); presence('C1', 1, true, time); await activate(); return result; }
const timeout = async payload => (await import('../../../experiment/sessions/timeout/tasks.js')).handleSessionTimeoutTask(payload);
describe('one authoritative session deadline and writer generation', () => {
  test('freezes published batching, destination and validation at creation', async () => {
    const result = await create();
    expect(result.statusCode).toBe(201);
    expect(store.records.get(base)).toMatchObject({ sessionProtocolVersion: 3,
      configuration: { batchConfig: { useIndexedDB: true, batchSize: 1, resumeTimeoutMinutes: 1 } },
      exportDestination: { folder: 'original-folder' }, connectionGeneration: 1, connectionId: 'C1' });
    expect(result.jsonBody.connection).toMatchObject({ generation: 1, id: 'C1' });
  });
  test('cannot produce responses before its presence is armed and confirmed', async () => {
    await create();
    expect((await append()).statusCode).toBe(409);
    presence('C1', 1, true, time); expect((await activate()).statusCode).toBe(200);
    expect((await append()).statusCode).toBe(201);
  });
  test('resumes just before expiry with the same participant and invalidates the old task', async () => {
    await connected(); presence('C1', 1, false, 120000); time = 179999;
    const result = await resume();
    expect(result.statusCode).toBe(200); expect(result.jsonBody.decision).toBe('resume_allowed');
    expect(result.jsonBody.participantNumber).toBe(0);
    presence('C2', 2, true, time); await activate('C2', 2); time = 180001;
    await timeout({ experimentID: 'EID', sessionId: 'S1', expiresAt: 180000, connectionId: 'C1', connectionGeneration: 1 });
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'active', connectionId: 'C2', connectionGeneration: 2 });
    expect(store.records.get('experiments/EID').sessions).toBe(1);
  });
  test.each(['resume', 'append', 'complete', 'status'])('%s applies the exact deadline even if its presence trigger and worker have not run', async action => {
    await connected(); presence('C1', 1, false, 120000); time = 180000;
    let result;
    if (action === 'resume') result = await resume();
    if (action === 'append') result = await append();
    if (action === 'complete') result = await request({ action: 'completeSession', ...connection(), expectedEventCount: 0, expectedLastSequence: -1,
      eventsHash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' });
    if (action === 'status') result = await request({ action: 'sessionStatus' });
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'expired', closedAt: new Date(180000).toISOString() });
    expect(result.jsonBody.lifecycle).toBe('expired');
    expect(store.records.has(base + '/trials/event-0')).toBe(false);
    expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ status: 'empty' });
  });
  test('rejects a second active tab and denies the prior generation after a valid resume', async () => {
    await connected(); expect((await resume()).jsonBody.decision).toBe('session_in_use');
    presence('C1', 1, false, 120000); time = 130000; await resume(); presence('C2', 2, true, time); await activate('C2', 2);
    expect((await append(1, 'C1')).statusCode).toBe(409);
    expect((await append(2, 'C2')).statusCode).toBe(201);
  });
  test('a valid old disconnect cannot close the newer connection or reset its deadline', async () => {
    await connected(); presence('C1', 1, false, 120000); time = 130000; await resume(); presence('C2', 2, true, time); await activate('C2', 2);
    const { handleConnectionPresence } = await import('../../../experiment/sessions/lifecycle/presence.js');
    time = 200000; await handleConnectionPresence({ experimentID: 'EID', sessionId: 'S1', connectionId: 'C1' },
      { connected: false, generation: 1, changedAt: 120000, token });
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'active', connectionGeneration: 2 });
  });
  test('republication allows resume without changing the session configuration', async () => {
    await connected(); presence('C1', 1, false, 120000); time = 130000;
    const experiment = store.records.get('experiments/EID');
    store.records.set('experiments/EID', { ...experiment, publishedConfiguration: { ...experiment.publishedConfiguration,
      batchConfig: { useIndexedDB: false, batchSize: 20, resumeTimeoutMinutes: 30 } } });
    const result = await resume();
    expect(result.jsonBody).toMatchObject({ decision: 'resume_allowed', participantNumber: 0,
      configuration: { batchConfig: { useIndexedDB: true, batchSize: 1, resumeTimeoutMinutes: 1 } } });
    expect(result.jsonBody).not.toHaveProperty('artifactUrl');
    expect(store.records.get('experiments/EID').sessions).toBe(1);
  });
  test('recovery after expiry validates with the frozen configuration and never reopens execution', async () => {
    await connected(); presence('C1', 1, false, 120000); time = 180000; await resume();
    store.records.set('experiments/EID', { ...store.records.get('experiments/EID'), useValidation: true, allowJSON: true, requiredFields: ['new_required'] });
    const response = await request({ action: 'recoverEvents', data: { protocolVersion: 1, events: [event(0)] } });
    expect(response.statusCode).toBe(201);
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'expired', participantNumber: 0, connectionGeneration: 1 });
  });
});
