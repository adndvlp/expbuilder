import fetch from '../../../../utils/fetch-with-timeout.js';
import { exportError } from '../contract.js';

export function headers(token, extra = {}) { return { Authorization: `Bearer ${token}`, ...extra }; }
export async function checkedFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok || response.status === 202) {
    throw exportError(`Storage request failed (${response.status})`, { status: response.status,
      noEffect: response.status >= 400 && response.status < 500 && response.status !== 408 });
  }
  return response;
}
export async function rawFetch(url, options) { return fetch(url, options); }
export function requireResource(value, message = 'Invalid provider resource') {
  if (!value) throw exportError(message, { attention: true });
}
export function strongEtag(response) {
  const value = response.headers.get('etag');
  return value && !value.startsWith('W/') ? value : null;
}
