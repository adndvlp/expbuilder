import CSV from 'csv-string';
import { setup, store, base, providerHttp, event, append, close, processJob, requestExport, recover, status } from './export-test-harness.js';

function providerFixture(provider) {
  let csv = null, version = 0, writes = 0, loseResponse = false;
  const osfEntity = { id: 'file', attributes: { name: 'EID_S1.csv' }, links: {
    upload: 'https://files.osf.io/file/upload?kind=file', download: 'https://files.osf.io/file/download',
  } };
  const response = (body, code = 200, headers = {}) => ({ ok: code >= 200 && code < 300, status: code,
    json: async () => body, text: async () => typeof body === 'string' ? body : JSON.stringify(body), headers: new Map(Object.entries(headers)) });
  const commit = body => { csv = body; version++; writes++; if (loseResponse) { loseResponse = false; throw new Error('Response lost after provider commit'); } };
  providerHttp.mockImplementation(async (value, options) => {
    const url = new URL(value), method = options.method;
    if (provider === 'googledrive') {
      if (url.pathname.endsWith('/generateIds')) return response({ ids: ['reserved'] });
      if (method === 'GET' && url.searchParams.has('q')) return response({ files: [] });
      if (method === 'GET') return csv === null ? response({}, 404) : url.searchParams.get('alt') === 'media'
        ? response(csv) : response({ id: 'reserved' }, 200, { etag: '"v' + version + '"' });
      if (method === 'POST') {
        expect(csv).toBeNull(); expect(options.body).toContain('"id":"reserved"');
        commit(options.body.match(/Content-Type: text\/csv\r\n\r\n([\s\S]*)\r\n--expbuilder-[^\r\n]+--$/)[1]);
      } else {
        if (options.headers['If-Match'] !== '"v' + version + '"') return response({}, 412);
        commit(options.body);
      }
      return response({ id: 'reserved' });
    }
    if (provider === 'dropbox') {
      const args = JSON.parse(options.headers['Dropbox-API-Arg']);
      if (url.pathname.endsWith('/download')) return csv === null ? response({ error_summary: 'path/not_found/.' }, 409)
        : response(csv, 200, { 'dropbox-api-result': JSON.stringify({ id: 'id:file', rev: 'r' + version }) });
      expect(args.autorename).toBe(false); expect(args.strict_conflict).toBe(true);
      if (csv === null) expect(args.mode).toBe('add'); else expect(args.mode).toEqual({ '.tag': 'update', update: 'r' + version });
      commit(options.body); return response({ id: 'id:file', rev: 'r' + version });
    }
    if (method === 'GET' && url.searchParams.has('meta')) return response({ data: csv === null ? [] : [osfEntity] });
    if (method === 'GET') return csv === null ? response({}, 404) : response(csv);
    expect(method).toBe('PUT'); expect(url.searchParams.get('kind')).toBe('file');
    if (url.searchParams.has('name')) expect(csv).toBeNull();
    commit(options.body); return response({ data: osfEntity });
  });
  return { get csv() { return csv; }, get writes() { return writes; }, loseNextResponse() { loseResponse = true; } };
}

describe.each(['googledrive', 'dropbox', 'osf'])('full exporter through the real %s HTTP adapter', provider => {
  beforeEach(() => {
    setup(provider);
    store.records.set('experiments/EID', { ...store.records.get('experiments/EID'), osfUploadLink: 'https://files.osf.io/v1/resources/node/providers/osfstorage/' });
  });
  test('downloads the complete A–E CSV from one logical resource after a partial export and recovery', async () => {
    const remote = providerFixture(provider);
    await append([event(0, 'A'), event(1, 'B'), event(2, 'C')]);
    store.records.set(base, { ...store.records.get(base), lifecycle: 'expired' }); await requestExport(); await processJob(1);
    const id = store.records.get(base).exportReceipt.resource.id;
    await recover([event(3, 'D'), event(4, 'E')]); await processJob(2);
    const rows = CSV.parse(remote.csv), column = rows[0].indexOf('response');
    expect(rows.slice(1).map(row => row[column])).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(store.records.get(base).exportReceipt.resource.id).toBe(id);
    expect(store.records.get(base).exportReceipt.eventCount).toBe(5);
    expect(remote.writes).toBe(2);
  });
  test('reconciles a lost upload response by reading the stored bytes instead of repeating its mutation', async () => {
    const remote = providerFixture(provider); await append([event(0, 'A')]); await close([event(0, 'A')]);
    remote.loseNextResponse(); await expect(processJob(1)).rejects.toThrow('Response lost');
    await processJob(1);
    expect((await status()).jsonBody.completion.confirmed).toBe(true);
    expect(remote.writes).toBe(1);
    expect(CSV.parse(remote.csv)).toHaveLength(2);
  });
});
