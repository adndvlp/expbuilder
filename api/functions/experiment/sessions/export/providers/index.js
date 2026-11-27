import { googleDriveExportAdapter } from './google-drive.js';
import { dropboxExportAdapter } from './dropbox.js';
import { osfExportAdapter } from './osf.js';
import { exportError } from '../contract.js';

export async function createExportAdapter(destination, tokenOverride) {
  let token = tokenOverride;
  if (!token) {
    const { getValidToken } = await import('../../../../oauth/index.js');
    const result = await getValidToken(destination.provider, destination.owner);
    if (!result.success) {
      if (result.retryable) {
        throw exportError('Storage credentials temporarily unavailable', {
          status: 503,
          retryable: true,
          code: result.code || 'OAUTH_UNKNOWN',
        });
      }
      throw exportError('Storage credentials require attention', {
        status: 401,
        code: result.code || 'OAUTH_UNKNOWN',
      });
    }
    token = result.access_token;
  }
  const factory = { googledrive: googleDriveExportAdapter, dropbox: dropboxExportAdapter, osf: osfExportAdapter }[destination.provider];
  if (!factory) throw exportError('Unknown storage provider', { attention: true });
  return factory(destination, token);
}
