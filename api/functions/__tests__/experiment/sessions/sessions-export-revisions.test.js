import { store, base, setup, fakeAdapter, event, expected, append, recover, close, status, processJob, requestExport, request } from './export-test-harness.js';

beforeEach(() => setup());
describe('durable export revisions', () => {
  test('normal closure atomically creates a job; only confirmed remote bytes authorize success', async () => {
    const events = [event(0, 'A'), event(1, 'B')]; await append(events);
    const response = await close(events);
    expect(response.statusCode).toBe(202);
    expect(response.jsonBody.completion).toMatchObject({ confirmed: false, ...expected(events) });
    expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ status: 'pending', dispatchDue: true, revision: 1 });
    const adapter = fakeAdapter(); await processJob(1, adapter);
    expect((await status()).jsonBody.completion).toMatchObject({ confirmed: true, ...expected(events) });
    expect(adapter.rows().map(row => row.response)).toEqual(['A', 'B']);
    expect(adapter.rows().map(row => row.session_state)).toEqual(['completed', 'completed']);
    expect(store.records.get(base)).toMatchObject({ participantNumber: 23, condition: 0 });
    expect(store.records.get('experiments/EID').sessions).toBe(1);
    expect(store.records.has(base + '/trials/event-0')).toBe(false);
    await processJob(1, adapter); await close(events);
    expect(adapter.write).toHaveBeenCalledTimes(1);
  });

  test.each(['googledrive', 'dropbox', 'osf'])('%s: A–C then recovered D–E becomes A–E once in the same file', async provider => {
    setup(provider);
    const adapter = fakeAdapter(provider !== 'osf');
    await append([event(0, 'A'), event(1, 'B'), event(2, 'C')]);
    store.records.set(base, { ...store.records.get(base), lifecycle: 'expired', closedAt: '2026-11-05T01:00:00Z' });
    await requestExport(); await processJob(1, adapter);
    const original = store.records.get(base).exportReceipt.resource.id;
    expect((await recover([event(3, 'D'), event(4, 'E')])).jsonBody.acknowledged).toHaveLength(2);
    await processJob(2, adapter);
    expect(adapter.rows().map(row => row.response)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(new Set(adapter.rows().map(row => row.event_id)).size).toBe(5);
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'expired', participantNumber: 23, condition: 0,
      exportReceipt: { revision: 2, eventCount: 5, resource: { id: original } } });
    await recover([event(3, 'D'), event(4, 'E')]); await processJob(2, adapter);
    expect(adapter.write).toHaveBeenCalledTimes(2);
    expect(store.records.get('experiments/EID').sessions).toBe(1);
  });

  test('H07: loss of a successful upload response reconciles without appending or uploading twice', async () => {
    const events = [event(0, 'A')]; await append(events); await close(events);
    const adapter = fakeAdapter(), write = adapter.write.getMockImplementation();
    adapter.write.mockImplementationOnce(async (...args) => { await write(...args); throw new Error('HTTP response lost'); });
    await expect(processJob(1, adapter)).rejects.toThrow();
    expect(store.records.has(base + '/trials/event-0')).toBe(true);
    expect(store.records.get(base + '/export_jobs/1').status).toBe('reconciling');
    await processJob(1, adapter);
    expect((await status()).jsonBody.completion.confirmed).toBe(true);
    expect(adapter.rows().map(row => row.response)).toEqual(['A']);
    expect(adapter.write).toHaveBeenCalledTimes(1);
  });

  test('a definitive transient rejection retries the same job, snapshot and identity', async () => {
    await append([event(0)]); await close([event(0)]);
    const adapter = fakeAdapter();
    adapter.write.mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429, noEffect: true }));
    await expect(processJob(1, adapter)).rejects.toThrow();
    expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ dispatchDue: true, status: 'retry_wait' });
    await processJob(1, adapter);
    expect(adapter.write.mock.calls[0][0]).toEqual(adapter.write.mock.calls[1][0]);
    expect(adapter.write.mock.calls[0][1]).toBe(adapter.write.mock.calls[1][1]);
    expect((await status()).jsonBody.completion.confirmed).toBe(true);
  });

  test('a failed read of the confirmed resource never becomes an empty file or a new file', async () => {
    const adapter = fakeAdapter(); await append([event(0, 'A')]); await requestExport(); await processJob(1, adapter);
    await append([event(1, 'B')]); await close([event(0, 'A'), event(1, 'B')]);
    adapter.read.mockRejectedValueOnce(new Error('download unavailable'));
    await expect(processJob(2, adapter)).rejects.toThrow();
    expect(adapter.write).toHaveBeenCalledTimes(1);
    expect(adapter.reserve).toHaveBeenCalledTimes(1);
    expect(store.records.has(base + '/trials/event-1')).toBe(true);
    expect(adapter.rows().map(row => row.response)).toEqual(['A']);
  });

  test('detects a changed or missing confirmed file without overwriting or discarding pending responses', async () => {
    const adapter = fakeAdapter(); await append([event(0, 'A')]); await requestExport(); await processJob(1, adapter);
    await append([event(1, 'B')]); await close([event(0, 'A'), event(1, 'B')]);
    adapter.csv = 'changed externally';
    await processJob(2, adapter);
    expect(store.records.get(base + '/export_jobs/2').status).toBe('needs_attention');
    expect(adapter.write).toHaveBeenCalledTimes(1);
    expect(store.records.has(base + '/trials/event-1')).toBe(true);
  });

  test('recovery during an upload creates a later frozen revision and cannot be erased by the older cleanup', async () => {
    const adapter = fakeAdapter(); await append([event(0, 'A')]);
    store.records.set(base, { ...store.records.get(base), lifecycle: 'expired' }); await requestExport();
    const write = adapter.write.getMockImplementation(); let release, entered;
    const blocked = new Promise(resolve => { release = resolve; }), arrived = new Promise(resolve => { entered = resolve; });
    adapter.write.mockImplementationOnce(async (...args) => { entered(); await blocked; return write(...args); });
    const first = processJob(1, adapter); await arrived;
    try {
      await recover([event(1, 'B')]);
      await expect(processJob(2, adapter)).rejects.toThrow();
    } finally { release(); await first; }
    expect(store.records.has(base + '/trials/event-1')).toBe(true);
    expect(store.records.get(base).exportReceipt.eventCount).toBe(1);
    await processJob(2, adapter);
    expect(adapter.rows().map(row => row.response)).toEqual(['A', 'B']);
  });

  test('cleanup can resume after confirmation without uploading its rows again', async () => {
    const adapter = fakeAdapter(); await append([event(0)]); await close([event(0)]);
    store.failNextDeleteOf('/trials/', new Error('cleanup unavailable'));
    await expect(processJob(1, adapter)).rejects.toThrow('cleanup unavailable');
    expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ status: 'confirmed', cleanupPending: true });
    await processJob(1, adapter);
    expect(adapter.write).toHaveBeenCalledTimes(1);
    expect(store.records.has(base + '/trials/event-0')).toBe(false);
  });

  test('recovery cannot change participant, checkpoint, lifecycle or reuse an occupied sequence', async () => {
    await append([event(0, 'A')]); store.records.set(base, { ...store.records.get(base), lifecycle: 'expired' });
    expect((await recover([{ ...event(1, 'B'), checkpoint: { completed: 'must not advance' } }])).statusCode).toBe(201);
    expect(store.records.get(base)).toMatchObject({ lifecycle: 'expired', participantNumber: 23, resumeCheckpoint: { completed: 'A' } });
    expect((await recover([{ ...event(1, 'B'), eventId: 'different-id' }])).statusCode).toBe(409);
    expect((await append([event(2)])).statusCode).toBe(409);
  });

  test('status and retry do not allocate another session or erase an exhausted job', async () => {
    await append([event(0)]); await close([event(0)]);
    store.records.set(base + '/export_jobs/1', { ...store.records.get(base + '/export_jobs/1'), status: 'needs_attention', dispatchDue: false, attempts: 8 });
    expect((await status()).jsonBody.export.status).toBe('needs_attention');
    expect((await request({ action: 'retryExport' })).jsonBody.export.revision).toBe(1);
    expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ dispatchDue: true, attempts: 0 });
    expect(store.records.get('experiments/EID').sessions).toBe(1);
  });

  test.each([true, false])('an expired lease fences the older worker; conditional writes=%s', async conditional => {
    let time = 0; const now = () => time;
    const adapter = fakeAdapter(conditional); await append([event(0)]); await close([event(0)]);
    const write = adapter.write.getMockImplementation(); let release, entered;
    const blocked = new Promise(resolve => { release = resolve; }), arrived = new Promise(resolve => { entered = resolve; });
    adapter.write.mockImplementationOnce(async (...args) => { entered(); await blocked; return write(...args); });
    const first = processJob(1, adapter, now); await arrived;
    try {
      time = 400_000;
      await processJob(1, adapter, now);
      expect(store.records.get(base + '/export_jobs/1').status).toBe(conditional ? 'confirmed' : 'needs_attention');
      if (!conditional) {
        await recover([event(1)]);
        expect((await status()).jsonBody.export.status).toBe('needs_attention');
        expect((await request({ action: 'retryExport' })).jsonBody.export.revision).toBe(1);
      }
    } finally { release(); }
    expect(await first).toMatchObject({ status: 'superseded' });
    if (conditional) expect(adapter.rows().map(row => row.event_id)).toEqual(['event-0']);
  });

  test('a close can attach to the already requested terminal revision without waiting for a nonexistent revision', async () => {
    await append([event(0)]); store.records.set(base, { ...store.records.get(base), lifecycle: 'completed' });
    await requestExport();
    expect((await close([event(0)])).jsonBody.completion.revision).toBe(1);
    await processJob(1, fakeAdapter());
    expect((await status()).jsonBody.completion.confirmed).toBe(true);
  });
  test('old finish and raw-upload actions cannot bypass the event set of a registered versioned session', async () => {
    await append([event(0)]);
    expect((await request({ action: 'finish' })).statusCode).toBe(409);
    expect((await request({ data: { response: 'unverified legacy row' } })).statusCode).toBe(409);
    const { apiDataComplete } = await import('../../../experiment/sessions/api/data-complete.js');
    const { makeReq, makeRes } = await import('../../helpers/firestore-mock.js');
    const response = makeRes();
    await apiDataComplete(makeReq({ body: { experimentID: 'EID', sessionId: 'S1', trialsData: [{ response: 'unverified' }] } }), response);
    expect(response.statusCode).toBe(409);
    expect(store.records.get(base).exportRequestedRevision).toBeUndefined();
  });
  test('exhausted automatic attempts retain data, and explicit retry uses that same job', async () => {
    await append([event(0)]); await close([event(0)]);
    const adapter = fakeAdapter(), read = adapter.read.getMockImplementation();
    adapter.read.mockRejectedValue(new Error('storage unavailable'));
    for (let attempt = 1; attempt <= 8; attempt++) {
      if (attempt < 8) await expect(processJob(1, adapter)).rejects.toThrow(); else await processJob(1, adapter);
    }
    expect(store.records.get(base + '/export_jobs/1')).toMatchObject({ status: 'needs_attention', attempts: 8, dispatchDue: false });
    expect(store.records.has(base + '/trials/event-0')).toBe(true);
    await request({ action: 'retryExport' }); adapter.read.mockImplementation(read); await processJob(1, adapter);
    expect((await status()).jsonBody.completion.confirmed).toBe(true);
  });
  test('a large frozen CSV is chunked durably instead of exceeding one Firestore document', async () => {
    const events = [event(0, 'A'.repeat(650000)), event(1, 'B'.repeat(650000))]; await append(events); await close(events);
    const adapter = fakeAdapter(), write = adapter.write.getMockImplementation(); let release, entered;
    const blocked = new Promise(resolve => { release = resolve; }), arrived = new Promise(resolve => { entered = resolve; });
    adapter.write.mockImplementationOnce(async (...args) => { entered(); await blocked; return write(...args); });
    const worker = processJob(1, adapter); await arrived;
    try {
      const chunks = [...store.records.entries()].filter(([key]) => key.startsWith(base + '/export_jobs/1/chunks/'));
      expect(chunks.length).toBeGreaterThan(1);
      expect(Math.max(...chunks.map(([, value]) => Buffer.byteLength(value.data)))).toBeLessThan(400000);
    } finally { release(); await worker; }
    expect(adapter.rows().map(row => row.response.length)).toEqual([650000, 650000]);
  });
  test('unreceipted legacy payloads are preserved and never certified as an empty session', async () => {
    store.records.set(base + '/trials/legacy', { response: 'legacy' });
    await requestExport();
    expect(store.records.get(base).exportStatus).toBe('needs_attention');
    expect(store.records.get(base).exportReceipt).toBeUndefined();
    expect(store.records.has(base + '/trials/legacy')).toBe(true);
  });
  test('a closed pre-exporter session without a durable job asks for reconciliation instead of waiting on nonexistent work', async () => {
    store.records.set(base, { ...store.records.get(base), lifecycle: 'completed', completion: { status: 'running', confirmed: false } });
    expect((await status()).jsonBody.export.status).toBe('needs_attention');
    expect(store.records.get(base).completion.confirmed).toBe(false);
  });
});
