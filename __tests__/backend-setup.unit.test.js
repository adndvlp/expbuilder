import fs from 'fs'
import os from 'os'
import path from 'path'
import { jest } from '@jest/globals'

const spawnMock = jest.fn()
jest.unstable_mockModule('child_process', () => ({ spawn: spawnMock }))

let backendSetup

async function fakeChild() {
  const { EventEmitter } = await import('events')
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdin = { write: jest.fn(), writableEnded: false }
  child.kill = jest.fn()
  return child
}

describe('server/backend-setup', () => {
  beforeAll(async () => {
    backendSetup = await import('../server/backend-setup.js')
  })

  beforeEach(() => {
    spawnMock.mockReset()
  })

  test('spawns the firebase CLI through Electron as Node with token and env', async () => {
    const child = await fakeChild()
    spawnMock.mockReturnValue(child)
    const onOutput = jest.fn()

    const handle = backendSetup.startFirebaseCommand({
      args: ['projects:list'],
      token: 'tok-123',
      cwd: '/tmp/api',
      onOutput,
    })

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      [backendSetup.getFirebaseCliPath(), '--interactive', '--token', 'tok-123', 'projects:list'],
      {
        cwd: '/tmp/api',
        env: expect.objectContaining({
          ELECTRON_RUN_AS_NODE: '1',
          FORCE_COLOR: '0',
          CI: '',
        }),
      },
    )

    child.stdout.emit('data', Buffer.from('out-line\n'))
    child.stderr.emit('data', Buffer.from('err-line\n'))
    child.emit('close', 0)
    const result = await handle.done

    expect(onOutput).toHaveBeenCalledWith({ stream: 'stdout', text: 'out-line\n' })
    expect(onOutput).toHaveBeenCalledWith({ stream: 'stderr', text: 'err-line\n' })
    expect(result).toEqual({
      code: 0,
      error: null,
      output: 'out-line\nerr-line\n',
    })
  })

  test('resolves spawn errors and supports stdin writes and kills', async () => {
    const child = await fakeChild()
    spawnMock.mockReturnValue(child)

    const handle = backendSetup.startFirebaseCommand({ args: ['--version'], cwd: '/tmp' })
    handle.write('code-from-user\n')
    expect(child.stdin.write).toHaveBeenCalledWith('code-from-user\n')

    handle.kill()
    expect(child.kill).toHaveBeenCalled()

    child.emit('error', new Error('binary not found'))
    const result = await handle.done
    expect(result).toEqual({
      code: null,
      error: 'binary not found',
      output: '',
    })
  })

  test('writes and merges functions/.env files', () => {
    const apiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-env-'))
    fs.mkdirSync(path.join(apiDir, 'functions'))
    fs.writeFileSync(
      path.join(apiDir, 'functions', '.env'),
      '# comment\nFIREBASE_PROJECT_ID=old-project\nKEEP_ME=yes\n',
      'utf8',
    )

    const envPath = backendSetup.writeBackendEnvFile(apiDir, {
      FIREBASE_PROJECT_ID: 'new-project',
      GITHUB_CLIENT_ID: 'gh-id',
    })

    expect(envPath).toBe(path.join(apiDir, 'functions', '.env'))
    const content = fs.readFileSync(envPath, 'utf8')
    expect(content).not.toContain('FIREBASE_PROJECT_ID')
    expect(content).toContain('KEEP_ME=yes')
    expect(content).toContain('GITHUB_CLIENT_ID=gh-id')

    fs.rmSync(apiDir, { recursive: true, force: true })
  })

  test('strips reserved firebase-tools env prefixes', () => {
    expect(backendSetup.isReservedFunctionsEnvKey('FIREBASE_PROJECT_ID')).toBe(true)
    expect(backendSetup.isReservedFunctionsEnvKey('FIREBASE_APP_BASE_URL')).toBe(true)
    expect(backendSetup.isReservedFunctionsEnvKey('X_GOOGLE_FOO')).toBe(true)
    expect(backendSetup.isReservedFunctionsEnvKey('GITHUB_CLIENT_ID')).toBe(false)

    const apiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-env-reserved-'))
    const envPath = backendSetup.writeBackendEnvFile(apiDir, {
      FIREBASE_PROJECT_ID: 'blocked',
      FIREBASE_APP_BASE_URL: 'https://blocked.firebaseapp.com',
      GITHUB_CLIENT_ID: 'gh-id',
    })
    const content = fs.readFileSync(envPath, 'utf8')
    expect(content).toBe('GITHUB_CLIENT_ID=gh-id\n')
    fs.rmSync(apiDir, { recursive: true, force: true })
  })

  test('surfaces the last specific error from firebase-debug.log', () => {
    const apiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-debug-'))
    expect(backendSetup.formatFirebaseDebugError(apiDir)).toBe('')
    fs.writeFileSync(
      path.join(apiDir, 'firebase-debug.log'),
      [
        '[debug] Error: Cannot find module \'firebase-functions\'',
        '[error]',
        '[error] Error: An unexpected error has occurred.',
        '',
      ].join('\n'),
      'utf8',
    )
    expect(backendSetup.formatFirebaseDebugError(apiDir)).toBe(
      "Error: Cannot find module 'firebase-functions'",
    )
    fs.rmSync(apiDir, { recursive: true, force: true })
  })

  test('creates functions/.env when the functions dir does not exist yet', () => {
    const apiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-env-new-'))
    const envPath = backendSetup.writeBackendEnvFile(apiDir, { OSF_CLIENT_ID: 'osf-id' })
    expect(fs.existsSync(envPath)).toBe(true)
    expect(fs.readFileSync(envPath, 'utf8')).toBe('OSF_CLIENT_ID=osf-id\n')
    fs.rmSync(apiDir, { recursive: true, force: true })
  })

  test('resolves the api dir from the override, production path and cwd', () => {
    process.env.BACKEND_API_DIR = '/override/api'
    expect(backendSetup.getApiDir(false)).toBe('/override/api')
    delete process.env.BACKEND_API_DIR

    expect(backendSetup.getApiDir(true)).toBe(
      path.join(process.resourcesPath ?? process.cwd(), 'api'),
    )
    expect(backendSetup.getApiDir(false)).toBe(path.join(process.cwd(), 'api'))
  })

  describe('ensureWritableApiDir', () => {
    const makeSourceApi = () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-src-'))
      const sourceDir = path.join(root, 'api')
      fs.mkdirSync(path.join(sourceDir, 'functions'), { recursive: true })
      fs.writeFileSync(path.join(sourceDir, 'firebase.json'), '{}\n', 'utf8')
      fs.writeFileSync(
        path.join(sourceDir, 'functions', 'index.js'),
        'export const x = 1\n',
        'utf8',
      )
      fs.mkdirSync(path.join(sourceDir, 'node_modules', 'some-dep'), { recursive: true })
      fs.writeFileSync(
        path.join(sourceDir, 'node_modules', 'some-dep', 'index.js'),
        'module.exports = {}\n',
        'utf8',
      )
      return { root, sourceDir }
    }

    const withResourcesPath = (sourceRoot, fn) => {
      const previous = process.resourcesPath
      Object.defineProperty(process, 'resourcesPath', {
        configurable: true,
        value: sourceRoot,
      })
      try {
        return fn()
      } finally {
        if (previous === undefined) {
          delete process.resourcesPath
        } else {
          Object.defineProperty(process, 'resourcesPath', {
            configurable: true,
            value: previous,
          })
        }
      }
    }

    test('prefers BACKEND_API_DIR and dev cwd without touching the disk', () => {
      process.env.BACKEND_API_DIR = '/override/api'
      expect(
        backendSetup.ensureWritableApiDir({ isProduction: true, userDataDir: '/nope', appVersion: '1' }),
      ).toBe('/override/api')
      delete process.env.BACKEND_API_DIR

      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-user-'))
      expect(
        backendSetup.ensureWritableApiDir({ isProduction: false, userDataDir, appVersion: '1' }),
      ).toBe(path.join(process.cwd(), 'api'))
      expect(fs.existsSync(path.join(userDataDir, 'api'))).toBe(false)
      fs.rmSync(userDataDir, { recursive: true, force: true })
    })

    test('stages the bundled api dir under userData, excluding node_modules', () => {
      const { root } = makeSourceApi()
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-user-'))
      const staged = withResourcesPath(root, () =>
        backendSetup.ensureWritableApiDir({ isProduction: true, userDataDir, appVersion: '2.5.2' }),
      )
      expect(staged).toBe(path.join(userDataDir, 'api'))
      expect(fs.readFileSync(path.join(staged, 'firebase.json'), 'utf8')).toBe('{}\n')
      expect(fs.readFileSync(path.join(staged, 'functions', 'index.js'), 'utf8')).toBe('export const x = 1\n')
      expect(fs.existsSync(path.join(staged, 'node_modules'))).toBe(false)
      expect(
        fs.readFileSync(path.join(staged, backendSetup.STAGED_API_VERSION_FILENAME), 'utf8'),
      ).toBe('2.5.2')
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(userDataDir, { recursive: true, force: true })
    })

    test('skips re-staging when the version stamp matches', () => {
      const { root } = makeSourceApi()
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-user-'))
      const options = { isProduction: true, userDataDir, appVersion: '2.5.2' }
      withResourcesPath(root, () => backendSetup.ensureWritableApiDir(options))
      const stampPath = path.join(userDataDir, 'api', backendSetup.STAGED_API_VERSION_FILENAME)
      const before = fs.statSync(stampPath).mtimeMs
      withResourcesPath(root, () => backendSetup.ensureWritableApiDir(options))
      expect(fs.statSync(stampPath).mtimeMs).toBe(before)
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(userDataDir, { recursive: true, force: true })
    })

    test('re-stages on version bump but preserves a saved functions/.env', () => {
      const { root } = makeSourceApi()
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-user-'))
      withResourcesPath(root, () =>
        backendSetup.ensureWritableApiDir({ isProduction: true, userDataDir, appVersion: '2.5.1' }),
      )
      const stagedEnv = path.join(userDataDir, 'api', 'functions', '.env')
      backendSetup.writeBackendEnvFile(path.join(userDataDir, 'api'), { OSF_CLIENT_ID: 'saved-id' })

      withResourcesPath(root, () =>
        backendSetup.ensureWritableApiDir({ isProduction: true, userDataDir, appVersion: '2.5.2' }),
      )
      expect(fs.readFileSync(stagedEnv, 'utf8')).toBe('OSF_CLIENT_ID=saved-id\n')
      expect(
        fs.readFileSync(path.join(userDataDir, 'api', backendSetup.STAGED_API_VERSION_FILENAME), 'utf8'),
      ).toBe('2.5.2')
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(userDataDir, { recursive: true, force: true })
    })

    test('throws a clear error when userDataDir is missing or the bundle lacks api', () => {
      expect(() =>
        backendSetup.ensureWritableApiDir({ isProduction: true, appVersion: '1' }),
      ).toThrow(/userDataDir is required/)
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-empty-'))
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-user-'))
      expect(() =>
        withResourcesPath(empty, () =>
          backendSetup.ensureWritableApiDir({ isProduction: true, userDataDir, appVersion: '1' }),
        ),
      ).toThrow(/Bundled backend not found/)
      fs.rmSync(empty, { recursive: true, force: true })
      fs.rmSync(userDataDir, { recursive: true, force: true })
    })
  })

  test('resolves the firebase CLI entry point', () => {
    expect(backendSetup.getFirebaseCliPath()).toContain('firebase-tools')
  })

  test('reads and writes backend setup state', () => {
    const filePath = path.join(os.tmpdir(), `backend-setup-state-${Date.now()}.json`)
    expect(backendSetup.readBackendSetupState(filePath)).toBeNull()
    backendSetup.writeBackendSetupState(filePath, { projectId: 'lab' })
    expect(backendSetup.readBackendSetupState(filePath)).toEqual({ projectId: 'lab' })
    fs.writeFileSync(filePath, '{bad', 'utf8')
    expect(backendSetup.readBackendSetupState(filePath)).toBeNull()
    fs.unlinkSync(filePath)
  })
})
