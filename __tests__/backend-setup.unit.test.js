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
