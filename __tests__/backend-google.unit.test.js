import { jest } from '@jest/globals'
import fs from 'fs'
import os from 'os'
import path from 'path'

describe('server/backend-google', () => {
  let backendGoogle
  const fetchMock = jest.fn()

  beforeAll(async () => {
    global.fetch = fetchMock
    backendGoogle = await import('../server/backend-google.js')
  })

  beforeEach(() => {
    fetchMock.mockReset()
  })

  function jsonResponse(body, ok = true, status = 200) {
    return {
      ok,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body,
    }
  }

  test('refreshes an access token and lists projects, billing, and auth', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-1', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ projectId: 'lab', displayName: 'Lab', projectNumber: '1' }] }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ billingEnabled: false }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({
        billingAccounts: [{ name: 'billingAccounts/abc', displayName: 'Lab billing', open: true }],
      }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ billingEnabled: true }))

    const listed = await backendGoogle.handleBackendSetupApi(
      { action: 'listProjects', token: '1//tok' },
      '/tmp/unused.json',
    )
    expect(listed).toEqual({
      success: true,
      projects: [{ projectId: 'lab', displayName: 'Lab', projectNumber: '1' }],
    })

    const billing = await backendGoogle.handleBackendSetupApi(
      { action: 'checkBilling', token: '1//tok', projectId: 'lab' },
      '/tmp/unused.json',
    )
    expect(billing).toEqual({ success: true, enabled: false })

    const accounts = await backendGoogle.handleBackendSetupApi(
      { action: 'listBillingAccounts', token: '1//tok', projectId: 'lab' },
      '/tmp/unused.json',
    )
    expect(accounts.accounts[0].name).toBe('billingAccounts/abc')

    const linked = await backendGoogle.handleBackendSetupApi(
      { action: 'linkBilling', token: '1//tok', projectId: 'lab', billingAccountName: 'billingAccounts/abc' },
      '/tmp/unused.json',
    )
    expect(linked).toEqual({ success: true, enabled: true })
  })

  test('enables email/password and reports Google console fallback', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-2', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ defaultSupportedIdpConfigs: [] }))
      .mockResolvedValueOnce(jsonResponse({ projectNumber: '99' }))
      .mockResolvedValueOnce(jsonResponse({ defaultSupportedIdpConfigs: [] }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockRejectedValueOnce(new Error('iap denied'))

    const result = await backendGoogle.handleBackendSetupApi(
      { action: 'enableAuth', token: '1//tok-2', projectId: 'lab' },
      '/tmp/unused.json',
    )
    expect(result.success).toBe(true)
    expect(result.emailEnabled).toBe(true)
    expect(result.googleNeedsConsole).toBe(true)
  })

  test('reads and writes setup state and rejects unknown actions', async () => {
    const statePath = path.join(os.tmpdir(), `backend-state-${Date.now()}.json`)
    expect(await backendGoogle.handleBackendSetupApi({ action: 'readState' }, statePath)).toEqual({
      success: true,
      state: null,
    })
    expect(await backendGoogle.handleBackendSetupApi({
      action: 'writeState',
      state: { projectId: 'lab', deployed: true },
    }, statePath)).toEqual({ success: true })
    expect(await backendGoogle.handleBackendSetupApi({ action: 'readState' }, statePath)).toEqual({
      success: true,
      state: { projectId: 'lab', deployed: true },
    })
    expect(await backendGoogle.handleBackendSetupApi({ action: 'nope', token: 'x' }, statePath)).toEqual({
      success: false,
      error: 'Unknown action: nope',
    })
    expect(await backendGoogle.handleBackendSetupApi({ action: 'listProjects' }, statePath)).toEqual({
      success: false,
      error: 'Not signed in with Google',
    })
    fs.unlinkSync(statePath)
  })
})
