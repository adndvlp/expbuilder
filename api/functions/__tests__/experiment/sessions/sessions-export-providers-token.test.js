/**
 * SDD-EXP-OAUTH-001 · FR-04 boundary. createExportAdapter maps classified
 * token failures: retryable → 503 (worker retries), non-retryable → 401
 * (needs_attention). tokenOverride and unknown providers are preserved.
 */
import { setTokenResolver, resetTokenResolver } from './export-test-harness.js';

const { createExportAdapter } = await import('../../../experiment/sessions/export/providers/index.js');

const destination = { provider: 'googledrive', owner: 'u1', folder: '/f', name: 'n.csv' };

beforeEach(() => resetTokenResolver());

describe('createExportAdapter — token failure mapping', () => {
  test('retryable token failure → 503 export error with code and retryable', async () => {
    setTokenResolver(async () => ({
      success: false, error: 'Storage credentials temporarily unavailable', code: 'OAUTH_TEMPORARY', retryable: true,
    }));
    await expect(createExportAdapter(destination)).rejects.toMatchObject({
      status: 503,
      retryable: true,
      code: 'OAUTH_TEMPORARY',
      message: 'Storage credentials temporarily unavailable',
    });
  });

  test('invalid_grant pending failure → 503 retryable with REAUTH_PENDING code', async () => {
    setTokenResolver(async () => ({
      success: false, error: 'Storage authorization may need to be reconnected', code: 'OAUTH_REAUTH_PENDING', retryable: true,
    }));
    await expect(createExportAdapter(destination)).rejects.toMatchObject({
      status: 503,
      retryable: true,
      code: 'OAUTH_REAUTH_PENDING',
    });
  });

  test('non-retryable failure → 401 with the historical message and code', async () => {
    setTokenResolver(async () => ({
      success: false, error: 'Storage OAuth configuration requires attention', code: 'OAUTH_CONFIGURATION', retryable: false,
    }));
    await expect(createExportAdapter(destination)).rejects.toMatchObject({
      status: 401,
      code: 'OAUTH_CONFIGURATION',
      message: 'Storage credentials require attention',
    });
  });

  test('successful token resolution builds the provider adapter', async () => {
    setTokenResolver(async () => ({ success: true, access_token: 'at' }));
    const adapter = await createExportAdapter(destination);
    expect(adapter).toHaveProperty('inspect');
    expect(adapter).toHaveProperty('write');
  });

  test('tokenOverride bypasses getValidToken entirely', async () => {
    setTokenResolver(async () => { throw new Error('must not be called'); });
    const adapter = await createExportAdapter(destination, 'manual-token');
    expect(adapter).toHaveProperty('write');
  });

  test('TOKEN_STORE_TEMPORARY failure → 503 retryable with the store code', async () => {
    setTokenResolver(async () => ({
      success: false, error: 'Token storage temporarily unavailable', code: 'TOKEN_STORE_TEMPORARY', retryable: true,
    }));
    await expect(createExportAdapter(destination)).rejects.toMatchObject({
      status: 503,
      retryable: true,
      code: 'TOKEN_STORE_TEMPORARY',
    });
  });

  test('TOKEN_STORE_CONFIGURATION failure → 401 permanent with the store code', async () => {
    setTokenResolver(async () => ({
      success: false, error: 'Token storage configuration requires attention', code: 'TOKEN_STORE_CONFIGURATION', retryable: false,
    }));
    await expect(createExportAdapter(destination)).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_STORE_CONFIGURATION',
    });
  });
});
