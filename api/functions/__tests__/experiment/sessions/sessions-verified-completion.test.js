import CSV from 'csv-string';
import { store, base, setup, fakeAdapter, event, expected, append, close, status, processJob, requestExport, request } from './export-test-harness.js';

beforeEach(() => setup());
describe('verified public completion', () => {
  test('confirms an empty session without creating a fake response file', async () => {
    expect((await close([])).jsonBody.completion).toMatchObject({ confirmed: true, status: 'empty', expectedEventCount: 0 });
    expect(store.records.get(base + '/export_jobs/1').dispatchDue).toBe(false);
  });
  test('confirms the complete set and provider bytes, then returns the same receipt on retry', async () => {
    const events = [event(0, 'A'), event(1, 'B')], adapter = fakeAdapter(); await append(events);
    expect((await close(events)).statusCode).toBe(202); await processJob(1, adapter);
    const response = await status();
    expect(response.jsonBody).toMatchObject({ success: true, sessionId: 'S1', completion: { confirmed: true, ...expected(events) } });
    const rows = CSV.parse(adapter.csv);
    expect(rows.slice(1).map(row => row[rows[0].indexOf('response')])).toEqual(['A', 'B']);
    expect(rows.slice(1).map(row => row[rows[0].indexOf('session_state')])).toEqual(['completed', 'completed']);
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'completed', participantNumber: 23, condition: 0 });
    expect(store.records.get('experiments/EID').sessions).toBe(1);
    expect(store.records.get('experiments/EID/session_metadata/S1').sessionName).toBe('Subject A');
    expect((await close(events)).jsonBody.completion).toEqual(response.jsonBody.completion);
    expect(adapter.write).toHaveBeenCalledTimes(1);
  });
  test('rejects closing while the final event has not arrived', async () => {
    await append([event(0)]);
    expect((await close([event(0), event(1)])).statusCode).toBe(409);
    expect(store.records.get(base).lifecycle).toBe('active');
  });
  test('normal completion updates an earlier partial file to completed without duplicating its rows', async () => {
    const events = [event(0)], adapter = fakeAdapter(); await append(events);
    await requestExport(); await processJob(1, adapter);
    await close(events); await processJob(2, adapter);
    expect((await status()).jsonBody.completion.confirmed).toBe(true);
    expect(adapter.rows()).toHaveLength(1);
    expect(adapter.rows()[0].session_state).toBe('completed');
  });
  test('rejects a matching count with a different event set or payload hashes', async () => {
    await append([event(0)]);
    expect((await close([{ ...event(0), eventId: 'another-event' }])).statusCode).toBe(409);
    expect((await close([event(0, 'different')])).statusCode).toBe(409);
  });
  test('does not confirm a receipt whose payload is missing and was never exported', async () => {
    const events = [event(0), event(1)]; await append(events); store.records.delete(base + '/trials/event-0');
    expect((await close(events)).statusCode).toBe(409);
  });
  test('does not certify unaccounted legacy rows as part of the expected event set', async () => {
    await append([event(0)]); store.records.set(base + '/trials/legacy', { response: 'unaccounted' });
    expect((await close([event(0)])).statusCode).toBe(409);
  });
  test('can finish an OSF session containing both earlier exported responses and new pending responses', async () => {
    const adapter = fakeAdapter(false); await append([event(0, 'A')]); await requestExport(); await processJob(1, adapter);
    await append([event(1, 'B')]); expect((await close([event(0, 'A'), event(1, 'B')])).statusCode).toBe(202);
    await processJob(2, adapter);
    expect(adapter.rows().map(row => row.response)).toEqual(['A', 'B']);
    expect((await status()).jsonBody.completion.confirmed).toBe(true);
  });
  test('cannot close a set with a hole in its sequences', async () => {
    const events = [event(0), event(2)]; await append(events);
    expect((await request({ action: 'completeSession', ...expected(events), expectedLastSequence: 2 })).statusCode).toBe(409);
  });
  test('simultaneous closers share a job and see pending while its single exporter is running', async () => {
    const events = [event(0)], adapter = fakeAdapter(); await append(events);
    const [first, second] = await Promise.all([close(events), close(events)]);
    expect(first.statusCode).toBe(202); expect(second.statusCode).toBe(202);
    expect([...store.records.keys()].filter(key => key.startsWith(base + '/export_jobs/'))).toHaveLength(1);
    let release, entered; const blocked = new Promise(resolve => { release = resolve; }), arrived = new Promise(resolve => { entered = resolve; });
    const write = adapter.write.getMockImplementation();
    adapter.write.mockImplementationOnce(async (...args) => { entered(); await blocked; return write(...args); });
    const worker = processJob(1, adapter); await arrived;
    try { expect((await close(events)).jsonBody.completion.confirmed).toBe(false); }
    finally { release(); await worker; }
    expect(adapter.write).toHaveBeenCalledTimes(1);
  });
  test('a provider rejection preserves data and can retry the same closed identity', async () => {
    const events = [event(0)], adapter = fakeAdapter(); await append(events); await close(events);
    adapter.write.mockRejectedValueOnce(Object.assign(new Error('unavailable'), { status: 429, noEffect: true }));
    await expect(processJob(1, adapter)).rejects.toThrow();
    expect(store.records.has(base + '/trials/event-0')).toBe(true);
    expect((await status()).jsonBody.completion.confirmed).toBe(false);
    await processJob(1, adapter);
    expect((await status()).jsonBody.completion.confirmed).toBe(true);
    expect(store.records.get('experiments/EID').sessions).toBe(1);
  });
  test('rejects a new response after closure but acknowledges an identical retry', async () => {
    const a = event(0); await append([a]); await close([a]);
    expect((await append([event(1)])).statusCode).toBe(409);
    expect((await append([a])).statusCode).toBe(200);
  });
  test('stores checkpoint and response atomically, with no advancement on failed commit', async () => {
    await append([event(0, 'A')]); store.failNextCommit(new Error('commit failed'));
    expect((await append([event(1, 'B')])).jsonBody.success).toBe(false);
    expect(store.records.get(base).resumeCheckpoint).toEqual({ completed: 'A' });
  });
  test('restores loop checkpoints containing nested response arrays through registration', async () => {
    const checkpoint = { completed: 'A', cursor: { loops: [{ cycleRows: [{ response: [[1, 2], [3, 4]] }] }] } };
    expect((await append([{ ...event(0), checkpoint }])).statusCode).toBe(201);
    const resumed = await request({});
    expect(resumed.jsonBody.resumeCheckpoint).toEqual(checkpoint);
    expect(resumed.jsonBody.receivedEvents).toEqual([expect.objectContaining({ eventId: 'event-0', sequence: 0 })]);
  });
});
