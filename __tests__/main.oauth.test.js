import { loadMain } from './helpers/loadMain.js'

describe('main.js OAuth IPC', () => {
  test.each([
    ['google-drive', 'accounts.google.com', { access_type: 'offline', prompt: 'consent' }],
    ['dropbox', 'www.dropbox.com', { token_access_type: 'offline' }],
    ['github', 'github.com', {}],
    ['osf', 'accounts.osf.io', { access_type: 'offline' }],
  ])('starts %s OAuth flow', async (provider, host, extraParams) => {
    const { createOAuthCallbackServer, handlers, isPortAvailable, shell } = await loadMain()

    const result = await handlers.get('start-oauth-flow')(null, {
      provider,
      clientId: 'client-123',
      scope: 'read write',
      state: 'nonce-1',
    })

    expect(result).toEqual({ success: true, code: 'code-123', state: 'state-123' })
    expect(isPortAvailable).toHaveBeenCalledWith(8888)
    expect(createOAuthCallbackServer).toHaveBeenCalledWith(8888)

    const openedUrl = new URL(shell.openExternal.mock.calls[0][0])
    expect(openedUrl.host).toBe(host)
    expect(openedUrl.searchParams.get('client_id')).toBe('client-123')
    expect(openedUrl.searchParams.get('redirect_uri')).toBe('http://localhost:8888/callback')
    expect(openedUrl.searchParams.get('scope')).toBe('read write')
    expect(openedUrl.searchParams.get('state')).toBe('nonce-1')
    for (const [key, value] of Object.entries(extraParams)) {
      expect(openedUrl.searchParams.get(key)).toBe(value)
    }
  })

  test('returns OAuth errors for unavailable ports and unsupported providers', async () => {
    const unavailable = await loadMain({ portAvailable: false })
    await expect(unavailable.handlers.get('start-oauth-flow')(null, {
      provider: 'github',
      clientId: 'id',
      scope: 'repo',
      state: 's',
    })).resolves.toEqual({
      success: false,
      error: 'Port 8888 is not available',
    })
    expect(unavailable.shell.openExternal).not.toHaveBeenCalled()

    const unsupported = await loadMain()
    const result = await unsupported.handlers.get('start-oauth-flow')(null, {
      provider: 'unknown',
      clientId: 'id',
      scope: 'repo',
      state: 's',
    })
    expect(result).toEqual({
      success: false,
      error: 'Unsupported provider: unknown',
    })
  })
})
