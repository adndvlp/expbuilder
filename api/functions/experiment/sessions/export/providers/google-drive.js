import { randomUUID } from 'node:crypto';
import { PROVIDER_ENDPOINTS } from '../../../../utils/provider-endpoints.js';
import { checkedFetch, headers, rawFetch, requireResource, strongEtag } from './common.js';
import { exportError } from '../contract.js';

export function googleDriveExportAdapter(destination, token) {
  const root = PROVIDER_ENDPOINTS.googleDrive.apiBase;
  const fileUrl = id => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  const escape = value => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return {
    async inspect() {
      const query = new URLSearchParams({ q: `name='${escape(destination.name)}' and '${escape(destination.folder)}' in parents and trashed=false`, fields: 'files(id),nextPageToken' });
      const found = await (await checkedFetch(`${root}/drive/v3/files?${query}`, { method: 'GET', headers: headers(token) })).json();
      requireResource(Array.isArray(found.files) && !found.nextPageToken && found.files.length <= 1, 'Ambiguous or incomplete Drive lookup');
      if (!found.files.length) return { exists: false };
      return this.read({ provider: 'googledrive', id: found.files[0].id, folder: destination.folder, name: destination.name, fileUrl: fileUrl(found.files[0].id) });
    },
    conditional: false,
    // Reserved IDs make repeated creates safe. Do not infer a guaranteed v3
    // media-update CAS from an ETag alone; reconcile uncertain updates by read.
    canRetryWrite: base => !base.exists,
    async reserve() {
      const query = new URLSearchParams({ q: `name='${escape(destination.name)}' and '${escape(destination.folder)}' in parents and trashed=false`, fields: 'files(id),nextPageToken' });
      const existing = await (await checkedFetch(`${root}/drive/v3/files?${query}`, { method: 'GET', headers: headers(token) })).json();
      if (!Array.isArray(existing.files)) throw exportError('Invalid Drive lookup response', { attention: true });
      if (existing.files.length || existing.nextPageToken) throw exportError('Existing Drive file needs an export receipt before adoption', { attention: true });
      const reserved = await (await checkedFetch(`${root}/drive/v3/files/generateIds?count=1&space=drive&type=files`, { method: 'GET', headers: headers(token) })).json();
      requireResource(typeof reserved.ids?.[0] === 'string', 'Drive did not reserve a file ID');
      return { provider: 'googledrive', id: reserved.ids[0], folder: destination.folder, name: destination.name, fileUrl: fileUrl(reserved.ids[0]) };
    },
    async read(resource) {
      const endpoint = `${root}/drive/v3/files/${encodeURIComponent(resource.id)}`;
      const response = await rawFetch(`${endpoint}?fields=id,name,version,trashed`, { method: 'GET', headers: headers(token) });
      if (response.status === 404) return { exists: false, csv: null, resource, version: null };
      if (!response.ok) throw exportError(`Drive metadata read failed (${response.status})`, { status: response.status });
      const data = await response.json();
      requireResource(data.id === resource.id && !data.trashed, 'Drive resource is missing or has changed identity');
      const version = strongEtag(response);
      const content = await checkedFetch(`${endpoint}?alt=media`, { method: 'GET', headers: headers(token, version ? { 'If-Match': version } : {}) });
      return { exists: true, csv: await content.text(), resource, version };
    },
    async write(resource, csv, base) {
      if (!base.exists) {
        const boundary = 'expbuilder-' + randomUUID();
        const metadata = { id: resource.id, name: resource.name, mimeType: 'text/csv', parents: [resource.folder] };
        const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--`;
        const response = await checkedFetch(`${root}/upload/drive/v3/files?uploadType=multipart`, {
          method: 'POST', headers: headers(token, { 'Content-Type': `multipart/related; boundary=${boundary}` }), body,
        });
        const result = await response.json(); requireResource(result.id === resource.id, 'Drive creation did not confirm its reserved identity');
      } else {
        await checkedFetch(`${root}/upload/drive/v3/files/${encodeURIComponent(resource.id)}?uploadType=media`, {
          method: 'PATCH', headers: headers(token, { 'Content-Type': 'text/csv', ...(base.version && { 'If-Match': base.version }) }), body: csv,
        });
      }
      return { ...resource, fileUrl: fileUrl(resource.id) };
    },
  };
}
