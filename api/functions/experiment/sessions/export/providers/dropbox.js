import { PROVIDER_ENDPOINTS } from '../../../../utils/provider-endpoints.js';
import { checkedFetch, headers, rawFetch, requireResource } from './common.js';
import { exportError } from '../contract.js';

export function dropboxExportAdapter(destination, token) {
  const root = PROVIDER_ENDPOINTS.dropbox.contentBase;
  return {
    async inspect() { return this.read(await this.reserve()); },
    conditional: true,
    async reserve() {
      const path = '/' + `${destination.folder}/${destination.name}`.replace(/^\/+/, '').replace(/\/+/g, '/');
      return { provider: 'dropbox', path, id: path, fileUrl: null };
    },
    async read(resource) {
      const response = await rawFetch(`${root}/2/files/download`, {
        method: 'POST', headers: headers(token, { 'Dropbox-API-Arg': JSON.stringify({ path: resource.path }) }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        if (response.status === 409 && result.error_summary?.startsWith('path/not_found/')) return { exists: false, csv: null, resource, version: null };
        throw exportError(`Dropbox download failed (${response.status})`, { status: response.status });
      }
      let metadata;
      try { metadata = JSON.parse(response.headers.get('dropbox-api-result')); } catch { /* Validated below. */ }
      requireResource(metadata?.id && metadata?.rev, 'Dropbox download lacks a revision receipt');
      requireResource(!resource.id || resource.id === resource.path || resource.id === metadata.id, 'Dropbox path now points to a different file');
      return { exists: true, csv: await response.text(), resource: { ...resource, id: metadata.id, revision: metadata.rev }, version: metadata.rev };
    },
    async write(resource, csv, base) {
      if (base.exists) requireResource(base.version, 'Dropbox update requires its confirmed revision');
      const response = await checkedFetch(`${root}/2/files/upload`, {
        method: 'POST', headers: headers(token, { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({
          path: resource.path, mode: base.exists ? { '.tag': 'update', update: base.version } : 'add', autorename: false, strict_conflict: true, mute: true,
        }) }), body: csv,
      });
      const metadata = await response.json(); requireResource(metadata.id && metadata.rev, 'Dropbox upload lacks a revision receipt');
      if (base.exists) requireResource(metadata.id === base.resource.id, 'Dropbox update changed the file identity');
      return { ...resource, id: metadata.id, revision: metadata.rev };
    },
  };
}
