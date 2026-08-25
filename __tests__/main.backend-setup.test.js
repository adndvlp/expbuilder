import fs from 'fs'
import os from 'os'
import path from 'path'
import { loadMain } from './helpers/loadMain.js'

function waitFor(predicate, timeoutMs = 30000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        if (predicate()) return resolve()
      } catch {}
      if (Date.now() - started > timeoutMs) {
        return reject(new Error('waitFor timed out'))
      }
      setTimeout(tick, 50)
    }
    tick()
  })
}

describe('main.js backend setup IPC', () => {
  test('writes the backend env file through the handler', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-ipc-'))
    const tmpApi = path.join(tmpDir, 'api')
    process.env.BACKEND_API_DIR = tmpApi
    const { handlers } = await loadMain({ userDataDir: tmpDir })

    await expect(handlers.get('backend-setup:write-env')(null, {
      env: { FIREBASE_PROJECT_ID: 'my-project', GITHUB_CLIENT_ID: 'gh' },
    })).resolves.toEqual({
      success: true,
      envPath: path.join(tmpApi, 'functions', '.env'),
    })

    const content = fs.readFileSync(path.join(tmpApi, 'functions', '.env'), 'utf8')
    expect(content).toContain('FIREBASE_PROJECT_ID=my-project')
    expect(content).toContain('GITHUB_CLIENT_ID=gh')

    delete process.env.BACKEND_API_DIR
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('reports backend env write errors', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-ipc-err-'))
    const fileAsApiDir = path.join(tmpDir, 'not-a-dir')
    fs.writeFileSync(fileAsApiDir, 'file')
    process.env.BACKEND_API_DIR = fileAsApiDir
    const { handlers } = await loadMain({ userDataDir: tmpDir })

    const result = await handlers.get('backend-setup:write-env')(null, {
      env: { FIREBASE_PROJECT_ID: 'x' },
    })
    expect(result.success).toBe(false)
    expect(result.error).toEqual(expect.any(String))

    delete process.env.BACKEND_API_DIR
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('rejects stdin writes and kills for unknown setup processes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-ipc-unk-'))
    const { handlers } = await loadMain({ userDataDir: tmpDir })

    await expect(handlers.get('backend-setup:write')(null, {
      id: 'missing',
      text: 'x',
    })).resolves.toEqual({
      success: false,
      error: 'Unknown backend setup process',
    })
    await expect(handlers.get('backend-setup:kill')(null, {
      id: 'missing',
    })).resolves.toEqual({
      success: false,
      error: 'Unknown backend setup process',
    })

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('runs firebase commands and streams output and exit events', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-backend-ipc-run-'))
    const { handlers } = await loadMain({ userDataDir: tmpDir })

    const events = []
    const event = {
      sender: {
        isDestroyed: () => false,
        send: (channel, data) => events.push([channel, data]),
      },
    }

    const { id } = await handlers.get('backend-setup:start')(event, {
      args: ['--version'],
    })
    expect(typeof id).toBe('string')

    await waitFor(() => events.some(([channel]) => channel === 'backend-setup:exit'))
    const exit = events.find(([channel]) => channel === 'backend-setup:exit')[1]
    expect(exit.id).toBe(id)
    expect(exit.code).toBe(0)
    expect(exit.output).toMatch(/\d+\.\d+\.\d+/)
    expect(events.some(([channel]) => channel === 'backend-setup:output')).toBe(true)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  }, 60000)
})
