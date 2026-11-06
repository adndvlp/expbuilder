import { checkedFetch, headers, rawFetch, requireResource } from './common.js';
import { exportError } from '../contract.js';

function resourceFrom(entity, previous) {
  requireResource(entity?.id && entity.links?.upload && entity.links?.download, 'OSF response lacks a reusable resource');
  return { ...previous, id: entity.id, uploadUrl: entity.links.upload, downloadUrl: entity.links.download, fileUrl: entity.links.download };
}
export function osfExportAdapter(destination, token) {
  return {
    // WaterButler documents versioned PUT, but no conditional update contract.
    // An uncertain update is read and reconciled; it is never blindly repeated.
    conditional: false,
    async reserve() { return { provider: 'osf', folder: destination.folder, name: destination.name, id: null, fileUrl: null }; },
    async read(resource) {
      let current = resource;
      if (!current.downloadUrl) {
        const url = new URL(current.folder); url.searchParams.set('meta', '');
        let next = url.toString(); const visited = new Set(); const matches = [];
        while (next) {
          if (visited.has(next) || visited.size >= 1000) throw exportError('OSF folder pagination is incomplete', { attention: true });
          visited.add(next);
          const result = await (await checkedFetch(next, { method: 'GET', headers: headers(token) })).json();
          requireResource(Array.isArray(result.data), 'Invalid OSF folder listing');
          matches.push(...result.data.filter(item => item.attributes?.name === current.name));
          next = result.links?.next || null;
        }
        if (!matches.length) return { exists: false, csv: null, resource: current, version: null };
        requireResource(matches.length === 1, 'Ambiguous OSF file identity');
        current = resourceFrom(matches[0], current);
      }
      const response = await rawFetch(current.downloadUrl, { method: 'GET', headers: headers(token) });
      if (response.status === 404) return { exists: false, csv: null, resource: current, version: null };
      if (!response.ok) throw exportError(`OSF download failed (${response.status})`, { status: response.status });
      return { exists: true, csv: await response.text(), resource: current, version: null };
    },
    async write(resource, csv, base) {
      let url = resource.uploadUrl;
      if (!base.exists) {
        const create = new URL(resource.folder); create.searchParams.set('kind', 'file'); create.searchParams.set('name', resource.name); url = create.toString();
      }
      requireResource(url, 'OSF update lacks its existing upload URL');
      const response = await checkedFetch(url, { method: 'PUT', headers: headers(token, { 'Content-Type': 'text/csv' }), body: csv });
      return resourceFrom((await response.json()).data, resource);
    },
  };
}
