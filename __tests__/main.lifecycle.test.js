import fs from 'fs'
import os from 'os'
import path from 'path'
import { loadMain } from './helpers/loadMain.js'

describe('main.js Electron lifecycle', () => {
  test('loads env, registers IPC handlers, creates the dev window, and handles updates', async () => {
    const envBefore = process.env.NODE_ENV
    delete process.env.NODE_ENV
    const loaded = await loadMain()

    expect(loaded.dotenvConfig).toHaveBeenCalledWith({
      path: expect.stringMatching(/\.env$/),
    })
    expect([...loaded.handlers.keys()].sort()).toEqual([
      'delete-firebase-config',
      'open-external',
      'read-firebase-config',
      'save-csv-zip',
      'save-json-file',
      'save-zip-file',
      'start-oauth-flow',
      'write-firebase-config',
    ])

    await loaded.readyCallback()

    expect(loaded.BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
      width: 1200,
      height: 800,
      webPreferences: expect.objectContaining({
        preload: expect.stringMatching(/preload\.js$/),
      }),
    }))
    expect(loaded.windows[0].maximize).toHaveBeenCalled()
    expect(loaded.windows[0].loadURL).toHaveBeenCalledWith('http://localhost:5173')
    expect(loaded.autoUpdater.checkForUpdatesAndNotify).toHaveBeenCalled()

    loaded.dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })
    await loaded.updaterHandlers.get('update-downloaded')()
    expect(loaded.autoUpdater.quitAndInstall).toHaveBeenCalled()

    const windowClosedHandler = loaded.app.on.mock.calls.find(([event]) => event === 'window-all-closed')[1]
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'linux' })
    windowClosedHandler()
    expect(loaded.app.quit).toHaveBeenCalled()
    Object.defineProperty(process, 'platform', platform)

    if (envBefore === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = envBefore
    }
  })

  test('opens external URLs through IPC', async () => {
    const { handlers, shell } = await loadMain()
    await handlers.get('open-external')(null, 'https://example.com')
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')
  })

  test('uses production env, DB root, and loadFile when running from asar', async () => {
    const envBefore = process.env.NODE_ENV
    const dbRootBefore = process.env.DB_ROOT
    delete process.env.NODE_ENV
    delete process.env.DB_ROOT

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-prod-'))
    const loaded = await loadMain({
      userDataDir,
      fileURLPath: '/Applications/ExpBuilder.app/Contents/Resources/app.asar/main.js',
    })

    expect(process.env.NODE_ENV).toBe('production')
    expect(loaded.dotenvConfig).toHaveBeenCalledWith({
      path: '/Applications/ExpBuilder.app/Contents/Resources/app.asar/.env.production',
    })

    const resourcesPath = Object.getOwnPropertyDescriptor(process, 'resourcesPath')
    Object.defineProperty(process, 'resourcesPath', {
      value: '/Applications/ExpBuilder.app/Contents/Resources',
      configurable: true,
    })
    await loaded.readyCallback()
    expect(process.env.DB_ROOT).toBe(userDataDir)
    expect(loaded.windows[0].loadFile).toHaveBeenCalledWith(expect.stringContaining('client/dist/index.html'))
    if (resourcesPath) Object.defineProperty(process, 'resourcesPath', resourcesPath)
    else delete process.resourcesPath

    if (envBefore === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = envBefore
    if (dbRootBefore === undefined) delete process.env.DB_ROOT
    else process.env.DB_ROOT = dbRootBefore
  })

  test('does not quit on macOS window-all-closed', async () => {
    const loaded = await loadMain()
    const windowClosedHandler = loaded.app.on.mock.calls.find(([event]) => event === 'window-all-closed')[1]
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    windowClosedHandler()
    expect(loaded.app.quit).not.toHaveBeenCalled()
    Object.defineProperty(process, 'platform', platform)
  })
})
