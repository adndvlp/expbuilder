/**
 * SDD-EXP-OAUTH-001 · T12–T17, T24 at export-job level.
 * Classified token failures flow into retry_wait/needs_attention with
 * lastErrorCode lifecycle, preserving the writing phase and integrity errors.
 */
import { store, base, setup, event, append, close, status, request, setTokenResolver, resetTokenResolver, providerHttp } from './export-test-harness.js';
import { jest } from '@jest/globals';
import CSV from 'csv-string';

const enqueuedTasks = [];
jest.unstable_mockModule('firebase-admin/functions', () => ({
  getFunctions: () => ({ taskQueue: () => ({ enqueue: async payload => { enqueuedTasks.push(payload); } }) }),
}));

const { processSessionExport } = await import('../../../experiment/sessions/export/process.js');

const temporaryFailure = () => ({
  success: false,
  error: 'Storage credentials temporarily unavailable',
  code: 'OAUTH_TEMPORARY',
  retryable: true,
});
const reauthPendingFailure = () => ({
  success: false,
  error: 'Storage authorization may need to be reconnected',
  code: 'OAUTH_REAUTH_PENDING',
  retryable: true,
});
const configurationFailure = () => ({
  success: false,
  error: 'Storage OAuth configuration requires attention',
  code: 'OAUTH_CONFIGURATION',
  retryable: false,
});

const job = (revision = 1) => store.records.get(`${base}/export_jobs/${revision}`);
const session = () => store.records.get(base);
const run = (revision = 1) =>
  processSessionExport({ experimentID: 'EID', sessionId: 'S1', revision }, { now: () => Date.now() });

beforeEach(() => {
  setup('googledrive');
  resetTokenResolver();
  enqueuedTasks.length = 0;
});

describe('classified OAuth failures at the export worker', () => {
  test('T12: transient token failure → retry_wait with lastErrorCode, lease released, trials intact', async () => {
    const events = [event(0, 'A')];
    await append(events);
    await close(events);

    setTokenResolver(async () => temporaryFailure());
    await expect(run(1)).rejects.toThrow('Storage credentials temporarily unavailable');

    expect(job()).toMatchObject({
      status: 'retry_wait',
      dispatchDue: true,
      lastError: 'Storage credentials temporarily unavailable',
      lastErrorCode: 'OAUTH_TEMPORARY',
      attempts: 1,
    });
    expect(job().nextDispatchAt).toBeGreaterThan(Date.now());
    expect(session().exportLeaseUntil).toBe(0);
    expect(session().exportStatus).toBe('retry_wait');
    expect(store.records.has(`${base}/trials/event-0`)).toBe(true);
    expect((await status()).jsonBody.export.lastErrorCode).toBe('OAUTH_TEMPORARY');
  });

  test('T13: same revision resumes after credentials recover; retryExport resets the code', async () => {
    await append([event(0, 'A')]);
    await close([event(0, 'A')]);

    setTokenResolver(async () => reauthPendingFailure());
    await expect(run(1)).rejects.toThrow();
    expect(job().status).toBe('retry_wait');

    // retryExport reactivates the same revision and clears lastErrorCode.
    resetTokenResolver();
    const retry = await request({ action: 'retryExport' });
    expect(retry.statusCode).toBe(200);
    expect(job()).toMatchObject({ status: 'pending', attempts: 0, lastError: null, lastErrorCode: null, dispatchDue: true });
    expect(retry.jsonBody.export.revision).toBe(1);
  });

  test('T13: automatic recovery through reconciler → dispatch → worker, without Retry saving', async () => {
    await append([event(0, 'A')]);
    await close([event(0, 'A')]);

    setTokenResolver(async () => reauthPendingFailure());
    await expect(run(1)).rejects.toThrow();
    expect(job()).toMatchObject({ status: 'retry_wait', dispatchDue: true });

    // Credenciales restauradas; el tiempo avanza más allá de nextDispatchAt.
    resetTokenResolver();
    store.records.set(`${base}/export_jobs/1`, { ...job(), nextDispatchAt: Date.now() - 1000 });

    const { reconcileSessionExports } = await import('../../../experiment/sessions/export/dispatch.js');
    await reconcileSessionExports(Date.now());
    expect(enqueuedTasks).toHaveLength(1);
    expect(enqueuedTasks[0]).toMatchObject({ experimentID: 'EID', sessionId: 'S1', revision: 1 });

    // Doble del handler de tarea: el worker procesa el payload encolado.
    const { fakeAdapter, processJob } = await import('./export-test-harness.js');
    const adapter = fakeAdapter();
    const result = await processJob(enqueuedTasks[0].revision, adapter);
    expect(result.status).toBe('confirmed');
    expect(adapter.rows().map(row => row.response)).toEqual(['A']);
    expect(adapter.write).toHaveBeenCalledTimes(1);
    expect((await status()).jsonBody.completion.confirmed).toBe(true);
    expect(store.records.has(`${base}/trials/event-0`)).toBe(false);
  });

  test('Firestore unavailability classified upstream produces retry_wait, not needs_attention', async () => {
    await append([event(0, 'A')]);
    await close([event(0, 'A')]);

    setTokenResolver(async () => ({
      success: false,
      error: 'Token storage temporarily unavailable',
      code: 'TOKEN_STORE_TEMPORARY',
      retryable: true,
    }));
    await expect(run(1)).rejects.toThrow('Storage credentials temporarily unavailable');
    expect(job()).toMatchObject({
      status: 'retry_wait',
      dispatchDue: true,
      lastErrorCode: 'TOKEN_STORE_TEMPORARY',
    });
    expect(store.records.has(`${base}/trials/event-0`)).toBe(true);
  });

  test('T14: permanent configuration failure → needs_attention, no auto-retry', async () => {
    await append([event(0, 'A')]);
    await close([event(0, 'A')]);

    setTokenResolver(async () => configurationFailure());
    const result = await run(1);

    expect(result.status).toBe('needs_attention');
    expect(job()).toMatchObject({
      status: 'needs_attention',
      dispatchDue: false,
      lastError: 'Storage credentials require attention',
      lastErrorCode: 'OAUTH_CONFIGURATION',
    });
    expect(store.records.has(`${base}/trials/event-0`)).toBe(true);
  });

  test('T15: eight consecutive transient failures exhaust the per-job budget without a ninth attempt', async () => {
    await append([event(0, 'A')]);
    await close([event(0, 'A')]);

    const resolver = jest.fn(async () => temporaryFailure());
    setTokenResolver(resolver);

    for (let i = 0; i < 8; i += 1) {
      if (i < 7) {
        await expect(run(1)).rejects.toThrow();
        expect(job().status).toBe('retry_wait');
      } else {
        const result = await run(1);
        expect(result.status).toBe('needs_attention');
      }
    }
    expect(resolver).toHaveBeenCalledTimes(8);
    expect(job()).toMatchObject({ status: 'needs_attention', attempts: 8, dispatchDue: false, lastErrorCode: 'OAUTH_TEMPORARY' });

    // A ninth dispatch would exhaust without calling the resolver again.
    const ninth = await run(1);
    expect(ninth.status).toBe('needs_attention');
    expect(resolver).toHaveBeenCalledTimes(8);
    expect(store.records.has(`${base}/trials/event-0`)).toBe(true);
  });

  test('T16: effective full-CSV write, lost HTTP response, OAuth failure during reconciliation, then byte-level reconciliation without a repeated write', async () => {
    const events = [event(0, 'A'), event(1, 'B'), event(2, 'C')];
    await append(events);
    await close(events);

    // Drive simulado sobre el fetch del proveedor: la escritura multipart
    // aplica el CSV en el "remoto" y después pierde la respuesta HTTP.
    const drive = { csv: null, uploads: 0, version: 1 };
    providerHttp.mockImplementation(async (url, options = {}) => {
      const u = String(url);
      const resp = (status, body, etag = null) => ({
        ok: status < 300, status, json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body ?? {})),
        headers: { get: () => etag },
      });
      if (u.includes('/drive/v3/files/generateIds')) return resp(200, { ids: ['stable-file'] });
      if (u.includes('/drive/v3/files?q=')) return resp(200, { files: [] });
      if (u.includes('/upload/drive/v3/files?uploadType=multipart')) {
        drive.uploads += 1;
        const body = String(options.body ?? '');
        const marker = 'Content-Type: text/csv\r\n\r\n';
        const start = body.indexOf(marker);
        const end = body.lastIndexOf('\r\n--');
        drive.csv = start >= 0 && end > start ? body.slice(start + marker.length, end) : drive.csv;
        drive.version += 1;
        // Respuesta perdida: la escritura quedó aplicada en el remoto.
        throw new Error('HTTP response lost');
      }
      if (u.includes('/drive/v3/files/stable-file?fields=')) {
        if (drive.csv === null) return resp(404, {});
        return resp(200, { id: 'stable-file', name: 'EID_S1.csv', version: String(drive.version), trashed: false }, 'etag-1');
      }
      if (u.includes('/drive/v3/files/stable-file?alt=media')) {
        if (drive.csv === null) return resp(404, {});
        return resp(200, drive.csv);
      }
      return resp(404, {});
    });

    // 1) Escritura efectiva con pérdida de respuesta → fase writing conservada.
    await expect(run(1)).rejects.toThrow('HTTP response lost');
    expect(job()).toMatchObject({ status: 'reconciling', phase: 'writing' });
    expect(drive.uploads).toBe(1);
    expect(store.records.has(`${base}/trials/event-0`)).toBe(true);

    // 2) Fallo OAuth durante la reconciliación: fase/escritura no se pierden.
    setTokenResolver(async () => temporaryFailure());
    await expect(run(1)).rejects.toThrow('Storage credentials temporarily unavailable');
    expect(job()).toMatchObject({ status: 'reconciling', phase: 'writing', lastErrorCode: 'OAUTH_TEMPORARY' });

    // 3) Credenciales recuperadas: reconciliación por bytes, sin repetir la mutación.
    resetTokenResolver();
    const result = await run(1);
    expect(result).toMatchObject({ status: 'confirmed', reconciled: true });
    expect(drive.uploads).toBe(1);

    // CSV íntegro: todas las respuestas originales, exactamente una vez.
    const table = CSV.parse(drive.csv);
    const rows = table.slice(1).map(row => Object.fromEntries(table[0].map((key, i) => [key, row[i]])));
    expect(rows.map(row => row.response)).toEqual(['A', 'B', 'C']);

    // Hashes y receipts corresponden al intent confirmado.
    const receipt = session().exportReceipt;
    expect(receipt).toMatchObject({ revision: 1, eventCount: 3 });
    expect(receipt.csvHash).toBe(job().intent.csvHash);
    expect(job()).toMatchObject({ status: 'confirmed', lastErrorCode: null });

    // Solo tras la confirmación verificada se limpian los trials.
    expect(store.records.has(`${base}/trials/event-0`)).toBe(false);
    expect(store.records.has(`${base}/trials/event-1`)).toBe(false);
    expect(store.records.has(`${base}/trials/event-2`)).toBe(false);
  });

  test('T17: integrity errors stay needs_attention without an OAuth lastErrorCode', async () => {
    await append([event(0, 'A')]);
    await close([event(0, 'A')]);
    const { processJob } = await import('./export-test-harness.js');
    const adapter = {
      conditional: false,
      reserve: async () => {
        throw Object.assign(new Error('Existing Drive file needs an export receipt before adoption'), { attention: true });
      },
    };
    const result = await processJob(1, adapter);
    expect(result.status).toBe('needs_attention');
    expect(job().lastErrorCode).toBe(null);
    expect(job().lastError).toBe('Existing Drive file needs an export receipt before adoption');
  });
});
