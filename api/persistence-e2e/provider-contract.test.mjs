import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleGoogleDrive } from '../mock-providers/providers/google-drive.mjs';
import { handleDropbox } from '../mock-providers/providers/dropbox.mjs';
import { handleOsf } from '../mock-providers/providers/osf.mjs';
import { readBody } from '../mock-providers/http-utils.mjs';
import { store } from '../mock-providers/store.mjs';

const servers = [], adapters = {}, resources = {};
export async function listen(handler) {
  const server = http.createServer(async (req, res) => {
    try { await handler(req, res, new URL(req.url, `http://${req.headers.host}`), await readBody(req), req.headers['content-type']); }
    catch (error) { res.writeHead(500); res.end(error.message); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server); return `http://127.0.0.1:${server.address().port}`;
}
before(async () => {
  process.env.GOOGLE_DRIVE_API_BASE = await listen(handleGoogleDrive);
  process.env.DROPBOX_CONTENT_BASE = await listen(handleDropbox);
  const osf = await listen(handleOsf);
  store.drive.tokens.set('token', {}); store.dropbox.tokens.set('token', {}); store.osf.tokens.set('token', {});
  store.osf.nodes.set('folder', { id: 'folder', attributes: {}, kind: 'nodes' });
  adapters.googledrive = (await import('../functions/experiment/sessions/export/providers/google-drive.js')).googleDriveExportAdapter({ folder: 'folder', name: 'session.csv' }, 'token');
  adapters.dropbox = (await import('../functions/experiment/sessions/export/providers/dropbox.js')).dropboxExportAdapter({ folder: '/folder', name: 'session.csv' }, 'token');
  adapters.osf = (await import('../functions/experiment/sessions/export/providers/osf.js')).osfExportAdapter({ folder: osf + '/v2/nodes/folder/files/osfstorage/', name: 'session.csv' }, 'token');
});
after(async () => { for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } });
for (const provider of ['googledrive', 'dropbox', 'osf']) {
  test(`${provider}: reserve, create, verify, update and download one stable file`, async () => {
    const adapter = adapters[provider], resource = await adapter.reserve();
    const empty = await adapter.read(resource); assert.equal(empty.exists, false);
    const created = await adapter.write(resource, 'event_id,event_sequence,response\nA,0,"a,b"', empty);
    const first = await adapter.read(created); assert.equal(first.csv, 'event_id,event_sequence,response\nA,0,"a,b"');
    const updated = await adapter.write(first.resource, first.csv + '\nB,1,b', first);
    const second = await adapter.read(updated); resources[provider] = second.resource;
    assert.equal(second.resource.id, first.resource.id); assert.equal(second.csv, first.csv + '\nB,1,b');
    if (provider === 'dropbox') await assert.rejects(adapter.write(first.resource, 'stale', first), error => error.status === 409);
    assert.equal((provider === 'googledrive' ? store.drive.files : provider === 'dropbox' ? store.dropbox.files : store.osf.files).size, 1);
  });
  test(`${provider}: inspection is read-only and finds the existing stable resource`, async () => {
    const before = JSON.stringify([...store.drive.files, ...store.dropbox.files, ...store.osf.files]);
    const result = await adapters[provider].inspect();
    assert.equal(result.exists, true);
    assert.equal(JSON.stringify([...store.drive.files, ...store.dropbox.files, ...store.osf.files]), before);
  });

}

test('Dropbox refuses a different file that has been rebound to its saved path', async () => {
  store.dropbox.entries.get('/folder/session.csv').id = 'id:replacement';
  await assert.rejects(adapters.dropbox.read(resources.dropbox), error => error.attention === true);
});
