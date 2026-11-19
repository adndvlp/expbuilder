import fetchMock from '../../../helpers/fetch-mock.js';

const adapter = async provider => (await import('../../../../experiment/sessions/export/providers/index.js')).createExportAdapter({
  provider, owner: 'owner', folder: provider === 'osf' ? 'https://files.osf.io/v1/resources/node/providers/osfstorage/folder/' : 'folder', name: 'EID_S1.csv',
}, 'token');
beforeEach(() => fetchMock.__reset());
describe('verified export provider contracts', () => {
  test('Drive reserves an ID without creating or modifying a CSV', async () => {
    fetchMock.__setMockResponses([{ body: { files: [] } }, { body: { ids: ['reserved-id'] } }]);
    const provider = await adapter('googledrive'), resource = await provider.reserve();
    expect(resource.id).toBe('reserved-id');
    expect(fetchMock.__getCalls().every(call => call.options.method === 'GET')).toBe(true);
    expect(fetchMock.__getCalls()[1].url).toContain('generateIds');
  });
  test('Drive creates with the reserved ID, then uses that ID and a strong ETag for updates', async () => {
    const provider = await adapter('googledrive'), resource = { provider: 'googledrive', id: 'reserved-id', folder: 'folder', name: 'EID_S1.csv' };
    fetchMock.__setMockResponses([{ body: { id: 'reserved-id' } }]);
    expect((await provider.write(resource, 'csv', { exists: false, version: null })).id).toBe('reserved-id');
    expect(fetchMock.__getCalls()[0].options.body).toContain('"id":"reserved-id"');
    fetchMock.__setMockResponses([{ body: { id: 'reserved-id' }, headers: { etag: '"v1"' } }, { body: 'csv' }, { body: { id: 'reserved-id' } }]);
    const previous = await provider.read(resource);
    expect(previous).toMatchObject({ csv: 'csv', version: '"v1"' });
    await provider.write(resource, 'new csv', previous);
    const upload = fetchMock.__getCalls().at(-1);
    expect(upload.options).toMatchObject({ method: 'PATCH', headers: { 'If-Match': '"v1"' } });
    expect(upload.url).toContain('/reserved-id?');
  });
  test('Drive never adopts an unverified same-name file or treats a failed search as absence', async () => {
    const provider = await adapter('googledrive');
    fetchMock.__setMockResponses([{ status: 503, body: {} }]);
    await expect(provider.reserve()).rejects.toThrow();
    expect(fetchMock.__getCalls()).toHaveLength(1);
    fetchMock.__setMockResponses([{ body: { files: [{ id: 'existing' }] } }]);
    await expect(provider.reserve()).rejects.toMatchObject({ attention: true });
  });
  test('a failed Drive download does not authorize another create or an empty replacement', async () => {
    const provider = await adapter('googledrive');
    fetchMock.__setMockResponses([{ body: { id: 'file' }, headers: { etag: '"v1"' } }, { status: 503 }]);
    await expect(provider.read({ id: 'file' })).rejects.toThrow();
    expect(fetchMock.__getCalls().every(call => call.options.method === 'GET')).toBe(true);
  });
  test('Drive only automatically repeats an uncertain creation, whose reserved ID prevents duplication', async () => {
    const provider = await adapter('googledrive');
    expect(provider.canRetryWrite({ exists: false })).toBe(true);
    expect(provider.canRetryWrite({ exists: true, version: '"etag"' })).toBe(false);
  });
  test('Dropbox uses strict revision updates without renaming or overwriting unconditionally', async () => {
    const provider = await adapter('dropbox'), resource = await provider.reserve();
    fetchMock.__setMockResponses([{ body: 'csv', headers: { 'dropbox-api-result': JSON.stringify({ id: 'id:file', rev: 'rev1', path_display: '/folder/EID_S1.csv' }) } },
      { body: { id: 'id:file', rev: 'rev2', path_display: '/folder/EID_S1.csv' } }]);
    const previous = await provider.read(resource); await provider.write(previous.resource, 'new csv', previous);
    const upload = fetchMock.__getCalls().at(-1);
    expect(JSON.parse(upload.options.headers['Dropbox-API-Arg'])).toMatchObject({
      mode: { '.tag': 'update', update: 'rev1' }, autorename: false, strict_conflict: true,
    });
    expect(fetchMock.__getCalls()).toHaveLength(2); // A shared link is not a persistence receipt.
  });
  test('Dropbox creates at a stable path with strict add, including retried creation', async () => {
    const provider = await adapter('dropbox'), resource = await provider.reserve();
    fetchMock.__setMockResponses([{ body: { id: 'file', rev: 'r1' } }, { status: 409, body: { error_summary: 'conflict' } }]);
    await provider.write(resource, 'csv', { exists: false });
    await expect(provider.write(resource, 'csv', { exists: false })).rejects.toMatchObject({ noEffect: true, status: 409 });
    const args = fetchMock.__getCalls().map(call => JSON.parse(call.options.headers['Dropbox-API-Arg']));
    expect(args[0]).toMatchObject({ mode: 'add', autorename: false, strict_conflict: true });
    expect(args[1].path).toBe(args[0].path);
  });
  test('OSF creates with kind=file and updates the returned resource without deleting it', async () => {
    const provider = await adapter('osf'), resource = await provider.reserve();
    const entity = { id: 'file', links: { upload: 'https://files.osf.io/file/upload?kind=file', download: 'https://files.osf.io/file/download' } };
    fetchMock.__setMockResponses([{ body: { data: entity } }, { body: { data: entity } }]);
    const saved = await provider.write(resource, 'csv', { exists: false });
    await provider.write(saved, 'new csv', { exists: true });
    const calls = fetchMock.__getCalls();
    expect(new URL(calls[0].url).searchParams.get('kind')).toBe('file');
    expect(new URL(calls[0].url).searchParams.get('name')).toBe('EID_S1.csv');
    expect(calls[1].url).toBe(entity.links.upload);
    expect(calls.every(call => call.options.method === 'PUT')).toBe(true);
    expect(provider.conditional).toBe(false);
  });
  test('OSF searches every folder page and reads the exact discovered resource', async () => {
    const provider = await adapter('osf'), resource = await provider.reserve();
    const entity = { id: 'file', attributes: { name: 'EID_S1.csv' }, links: { upload: 'https://files.osf.io/upload', download: 'https://files.osf.io/download' } };
    fetchMock.__setMockResponses([{ body: { data: [], links: { next: 'https://files.osf.io/next' } } },
      { body: { data: [entity], links: { next: null } } }, { body: 'complete csv' }]);
    expect(await provider.read(resource)).toMatchObject({ exists: true, csv: 'complete csv', resource: { id: 'file' } });
    expect(fetchMock.__getCalls().at(-1).url).toBe(entity.links.download);
  });
  test.each([401, 429, 503, 202])('provider HTTP %s never means content confirmed', async status => {
    const provider = await adapter('osf'), resource = await provider.reserve();
    fetchMock.__setMockResponses([{ status, body: {} }]);
    await expect(provider.write(resource, 'csv', { exists: false })).rejects.toMatchObject({ status });
  });
});
