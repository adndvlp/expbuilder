import fs from 'fs'
import path from 'path'
import vm from 'vm'
import { jest } from '@jest/globals'

describe('preload.js', () => {
  test('exposes the expected Electron bridge methods', () => {
    const exposeInMainWorld = jest.fn()
    const invoke = jest.fn((channel, payload) => ({ channel, payload }))
    const on = jest.fn((channel, listener) => listener)
    const removeListener = jest.fn()
    const filename = path.resolve(process.cwd(), 'preload.js')
    const source = fs.readFileSync(filename, 'utf8')

    vm.runInNewContext(source, {
      require: (moduleName) => {
        if (moduleName !== 'electron') {
          throw new Error(`Unexpected require: ${moduleName}`)
        }
        return {
          contextBridge: { exposeInMainWorld },
          ipcRenderer: { invoke, on, removeListener },
        }
      },
    }, { filename })

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)
    const [namespace, api] = exposeInMainWorld.mock.calls[0]
    expect(namespace).toBe('electron')

    expect(api.openExternal('https://example.com')).toEqual({
      channel: 'open-external',
      payload: 'https://example.com',
    })
    expect(api.startOAuthFlow({ provider: 'github' })).toEqual({
      channel: 'start-oauth-flow',
      payload: { provider: 'github' },
    })
    expect(api.saveCsvZip([{ name: 'a.csv', content: 'a' }], 'sessions.zip')).toEqual({
      channel: 'save-csv-zip',
      payload: { files: [{ name: 'a.csv', content: 'a' }], defaultName: 'sessions.zip' },
    })
    expect(api.saveZipFile(Buffer.from('zip'), 'backup.zip')).toEqual({
      channel: 'save-zip-file',
      payload: { buffer: Buffer.from('zip'), defaultName: 'backup.zip' },
    })
    expect(api.saveJsonFile('{"ok":true}', 'db.json')).toEqual({
      channel: 'save-json-file',
      payload: { content: '{"ok":true}', defaultName: 'db.json' },
    })
    expect(api.readFirebaseConfig()).toEqual({
      channel: 'read-firebase-config',
      payload: undefined,
    })
    expect(api.writeFirebaseConfig({ apiKey: 'key' })).toEqual({
      channel: 'write-firebase-config',
      payload: { apiKey: 'key' },
    })
    expect(api.deleteFirebaseConfig()).toEqual({
      channel: 'delete-firebase-config',
      payload: undefined,
    })
    expect(api.readOauthConfig()).toEqual({
      channel: 'read-oauth-config',
      payload: undefined,
    })
    expect(api.writeOauthConfig({ githubClientId: 'gh' })).toEqual({
      channel: 'write-oauth-config',
      payload: { githubClientId: 'gh' },
    })
    expect(api.deleteOauthConfig()).toEqual({
      channel: 'delete-oauth-config',
      payload: undefined,
    })
    expect(api.startBackendSetup(['projects:list'], 'tok')).toEqual({
      channel: 'backend-setup:start',
      payload: { args: ['projects:list'], token: 'tok' },
    })
    expect(api.writeBackendSetupInput('id-1', 'code')).toEqual({
      channel: 'backend-setup:write',
      payload: { id: 'id-1', text: 'code' },
    })
    expect(api.killBackendSetup('id-1')).toEqual({
      channel: 'backend-setup:kill',
      payload: { id: 'id-1' },
    })
    expect(api.writeBackendEnv({ FIREBASE_PROJECT_ID: 'x' })).toEqual({
      channel: 'backend-setup:write-env',
      payload: { env: { FIREBASE_PROJECT_ID: 'x' } },
    })
    const outputCallback = jest.fn()
    const unsubscribe = api.onBackendSetupOutput(outputCallback)
    expect(on).toHaveBeenCalledWith('backend-setup:output', expect.any(Function))
    unsubscribe()
    expect(removeListener).toHaveBeenCalledWith(
      'backend-setup:output',
      expect.any(Function),
    )
    const exitCallback = jest.fn()
    api.onBackendSetupExit(exitCallback)
    expect(on).toHaveBeenCalledWith('backend-setup:exit', expect.any(Function))
  })
})
