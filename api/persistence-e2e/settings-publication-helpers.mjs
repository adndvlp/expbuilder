import http from 'node:http';
import assert from 'node:assert/strict';
import { readBody } from '../mock-providers/http-utils.mjs';

// Hold the real publisher at the controlled GitHub HTTP boundary, while an owner saves settings.
export async function duringUpload(operation, onUpload) {
  const { PROVIDER_ENDPOINTS } = await import('../functions/utils/provider-endpoints.js');
  const previous = PROVIDER_ENDPOINTS.github.apiBase;
  assert.match(previous, /^http:\/\/127\.0\.0\.1:\d+$/);
  let intercepted = false, failure;
  const server = http.createServer(async (req, res) => {
    try {
      const body = await readBody(req);
      if (!intercepted && req.method === 'PUT' && req.url.endsWith('/contents/index.html')) {
        intercepted = true; await onUpload();
      }
      const response = await fetch(previous + req.url, { method: req.method, headers: { ...req.headers, host: new URL(previous).host },
        ...(!['GET', 'HEAD'].includes(req.method) && { body }) });
      res.writeHead(response.status, { 'Content-Type': 'application/json' }); res.end(await response.text());
    } catch (error) { failure = error; res.writeHead(500); res.end('{}'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  PROVIDER_ENDPOINTS.github.apiBase = `http://127.0.0.1:${server.address().port}`;
  try { await operation(); if (failure) throw failure; assert.equal(intercepted, true); }
  finally {
    PROVIDER_ENDPOINTS.github.apiBase = previous;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
