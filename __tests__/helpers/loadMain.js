import fs from 'fs'
import os from 'os'
import path from 'path'
import { jest } from '@jest/globals'

export const loadMain = async (options = {}) => {
  jest.resetModules()

  const handlers = new Map()
  const updaterHandlers = new Map()
  const windows = []
  let readyCallback

  const userDataDir = options.userDataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-'))
  const app = {
    getPath: jest.fn(() => userDataDir),
    on: jest.fn(),
    quit: jest.fn(),
    whenReady: jest.fn(() => ({
      then: (cb) => {
        readyCallback = cb
        return Promise.resolve()
      },
    })),
  }
  const BrowserWindow = jest.fn((config) => {
    const win = {
      config,
      maximize: jest.fn(),
      loadFile: jest.fn(),
      loadURL: jest.fn(),
    }
    windows.push(win)
    return win
  })
  const ipcMain = {
    handle: jest.fn((channel, handler) => {
      handlers.set(channel, handler)
    }),
  }
  const shell = {
    openExternal: jest.fn().mockResolvedValue(undefined),
  }
  const dialog = {
    showMessageBox: jest.fn().mockResolvedValue({ response: 1 }),
    showSaveDialog: jest.fn().mockResolvedValue({ canceled: true }),
  }
  const autoUpdater = {
    checkForUpdatesAndNotify: jest.fn(),
    on: jest.fn((event, handler) => {
      updaterHandlers.set(event, handler)
    }),
    quitAndInstall: jest.fn(),
  }
  const dotenvConfig = jest.fn()
  const createOAuthCallbackServer = jest
    .fn()
    .mockResolvedValue(options.oauthResult ?? { code: 'code-123', state: 'state-123' })
  const isPortAvailable = jest
    .fn()
    .mockResolvedValue(options.portAvailable ?? true)

  jest.unstable_mockModule('electron', () => ({
    app,
    BrowserWindow,
    ipcMain,
    shell,
    dialog,
  }))
  jest.unstable_mockModule('dotenv', () => ({
    default: { config: dotenvConfig },
  }))
  jest.unstable_mockModule('electron-updater', () => ({
    default: { autoUpdater },
  }))
  if (options.fileURLPath) {
    jest.unstable_mockModule('url', () => ({
      fileURLToPath: jest.fn(() => options.fileURLPath),
    }))
  }
  jest.unstable_mockModule('../../oauth-handler.js', () => ({
    createOAuthCallbackServer,
    isPortAvailable,
  }))
  jest.unstable_mockModule('../../server/api.js', () => ({
    io: {},
  }))

  await import('../../main.js')

  return {
    app,
    BrowserWindow,
    createOAuthCallbackServer,
    dialog,
    dotenvConfig,
    handlers,
    isPortAvailable,
    readyCallback,
    shell,
    updaterHandlers,
    autoUpdater,
    userDataDir,
    windows,
  }
}
