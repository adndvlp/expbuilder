import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const makeChildProcess = (processes) => {
  const handlers = {}
  const stdoutHandlers = {}
  const stderrHandlers = {}
  const child = {
    stdout: {
      on: jest.fn((event, handler) => {
        stdoutHandlers[event] = handler
      }),
    },
    stderr: {
      on: jest.fn((event, handler) => {
        stderrHandlers[event] = handler
      }),
    },
    on: jest.fn((event, handler) => {
      handlers[event] = handler
    }),
    kill: jest.fn(),
    emitError: (error) => handlers.error?.(error),
    emitExit: () => handlers.exit?.(),
    emitStdout: (data) => stdoutHandlers.data?.(Buffer.from(data)),
    emitStderr: (data) => stderrHandlers.data?.(Buffer.from(data)),
  }
  processes.push(child)
  return child
}

const waitFor = async (predicate) => {
  for (let i = 0; i < 20; i += 1) {
    if (await predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for test condition')
}

const startRequest = (testRequest) =>
  new Promise((resolve, reject) => {
    testRequest.end((err, res) => {
      if (err) reject(err)
      else resolve(res)
    })
  })

const freshApp = async (seedFn) => {
  jest.resetModules()

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-tunnel-create-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  if (seedFn) seedFn(db.data)
  await db.write()

  const processes = []
  const mockSpawn = jest.fn(() => makeChildProcess(processes))
  const actualFs = await import('fs')
  const actualFsDefault = actualFs.default ?? actualFs
  const existsSync = jest.fn((targetPath) => {
    if (String(targetPath).includes('cloudflared')) return true
    return actualFsDefault.existsSync(targetPath)
  })

  jest.unstable_mockModule('child_process', () => ({
    spawn: mockSpawn,
  }))
  jest.unstable_mockModule('fs', () => ({
    ...actualFs,
    default: {
      ...actualFsDefault,
      existsSync,
    },
    existsSync,
  }))

  const router = (await import('../../routes/tunnel.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)

  await new Promise(resolve => setTimeout(resolve, 50))

  return {
    app,
    cleanup: () => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      delete process.env.DB_ROOT
    },
    db,
    existsSync,
    mockSpawn,
    processes,
  }
}

describe('POST /api/create-tunnel', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('creates a quick tunnel, persists its URL, and clears it on close', async () => {
    const { app, cleanup, db, mockSpawn, processes } = await freshApp((data) => {
      data.experiments.push({
        experimentID: 'E1',
        name: 'Exp1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })

    const pending = startRequest(request(app)
      .post('/api/create-tunnel')
      .send({ experimentID: 'E1' }))

    await waitFor(() => processes.length === 1)
    processes[0].emitStderr('Visit https://abc.trycloudflare.com to open your tunnel')

    const res = await pending
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, url: 'https://abc.trycloudflare.com' })
    expect(mockSpawn.mock.calls[0][1]).toEqual([
      'tunnel',
      '--url',
      'http://localhost:3000',
      '--no-autoupdate',
    ])

    await db.read()
    expect(db.data.experiments[0].tunnelUrl).toBe('https://abc.trycloudflare.com')

    await request(app)
      .post('/api/close-tunnel')
      .send({ experimentID: 'E1' })
      .expect(200, { success: true, message: 'Tunnel closed' })
    expect(processes[0].kill).toHaveBeenCalled()

    await db.read()
    expect(db.data.experiments[0].tunnelUrl).toBeUndefined()
    cleanup()
  })

  test('uses saved custom hostname and resolves after cloudflared reports registration', async () => {
    const { app, cleanup, mockSpawn, processes } = await freshApp((data) => {
      data.experiments.push({
        experimentID: 'E2',
        name: 'Exp2',
        tunnelSettings: { hostname: 'custom.example.com', persistent: false },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })

    const pending = startRequest(request(app)
      .post('/api/create-tunnel')
      .send({ experimentID: 'E2' }))

    await waitFor(() => processes.length === 1)
    processes[0].emitStdout('registered tunnel connection')

    const res = await pending
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, url: 'https://custom.example.com' })
    expect(mockSpawn.mock.calls[0][1]).toEqual([
      'tunnel',
      '--url',
      'http://localhost:3000',
      '--no-autoupdate',
      '--hostname',
      'custom.example.com',
    ])
    cleanup()
  })

  test('uses request hostname, ignores unrelated output, and closes without experimentID', async () => {
    const { app, cleanup, processes } = await freshApp()

    const pending = startRequest(request(app)
      .post('/api/create-tunnel')
      .send({ hostname: 'https://body.example.com/' }))

    await waitFor(() => processes.length === 1)
    processes[0].emitStdout('warming up without registration')
    processes[0].emitStdout('serving tunnel')

    const res = await pending
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, url: 'https://body.example.com' })

    processes[0].emitStdout('serving tunnel again')
    processes[0].emitError(new Error('late error ignored'))

    await request(app)
      .post('/api/close-tunnel')
      .send({})
      .expect(200, { success: true, message: 'Tunnel closed' })
    cleanup()
  })

  test('creates a quick tunnel without a request body or experimentID', async () => {
    const { app, cleanup, processes } = await freshApp()

    const pending = startRequest(request(app).post('/api/create-tunnel'))

    await waitFor(() => processes.length === 1)
    processes[0].emitStderr('no public URL here yet')
    processes[0].emitStderr('Visit https://no-experiment.trycloudflare.com')

    const res = await pending
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      url: 'https://no-experiment.trycloudflare.com',
    })
    cleanup()
  })

  test('continues with a quick tunnel when saved settings lookup fails', async () => {
    const { app, cleanup, db, processes } = await freshApp()
    const originalRead = db.read
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    db.read = jest.fn().mockRejectedValue(new Error('settings read failed'))
    try {
      const pending = startRequest(request(app)
        .post('/api/create-tunnel')
        .send({ experimentID: 'E-missing-settings' }))

      await waitFor(() => processes.length === 1)
      processes[0].emitStdout('Visit https://settings-failed.trycloudflare.com')

      const res = await pending
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        success: true,
        url: 'https://settings-failed.trycloudflare.com',
      })
      expect(errorSpy).toHaveBeenCalledWith(
        'Error persisting tunnelUrl:',
        expect.any(Error),
      )
    } finally {
      db.read = originalRead
      errorSpy.mockRestore()
      cleanup()
    }
  })

  test('returns a tunnel URL when experimentID is not found during persistence', async () => {
    const { app, cleanup, db, processes } = await freshApp()

    const pending = startRequest(request(app)
      .post('/api/create-tunnel')
      .send({ experimentID: 'missing-experiment' }))

    await waitFor(() => processes.length === 1)
    processes[0].emitStdout('Visit https://missing-experiment.trycloudflare.com')

    const res = await pending
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      url: 'https://missing-experiment.trycloudflare.com',
    })
    await db.read()
    expect(db.data.experiments).toEqual([])
    cleanup()
  })

  test('ignores timeout callbacks after a tunnel URL has already been sent', async () => {
    const { app, cleanup, processes } = await freshApp()
    const timeoutCallbacks = []
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      timeoutCallbacks.push(callback)
      return { __timer: timeoutCallbacks.length }
    })
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout').mockImplementation(() => {})
    const waitForImmediate = async (predicate) => {
      for (let i = 0; i < 20; i += 1) {
        if (predicate()) return
        await new Promise(resolve => setImmediate(resolve))
      }
      throw new Error('Timed out waiting for immediate condition')
    }
    try {
      const pending = startRequest(request(app)
        .post('/api/create-tunnel')
        .send({}))

      await waitForImmediate(() => processes.length === 1 && timeoutCallbacks.length === 1)
      processes[0].emitStdout('Visit https://already-sent.trycloudflare.com')
      const res = await pending
      expect(res.status).toBe(200)

      timeoutCallbacks.shift()()
      expect(processes).toHaveLength(1)
    } finally {
      setTimeoutSpy.mockRestore()
      clearTimeoutSpy.mockRestore()
      cleanup()
    }
  })

  test('returns 500 when cloudflared spawn fails', async () => {
    const { app, cleanup, processes } = await freshApp()

    const pending = startRequest(request(app)
      .post('/api/create-tunnel')
      .send({}))

    await waitFor(() => processes.length === 1)
    processes[0].emitError(new Error('spawn failed'))

    const res = await pending
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ success: false, error: 'spawn failed' })
    cleanup()
  })

  test('still returns a quick tunnel URL when persisting it fails', async () => {
    const { app, cleanup, db, processes } = await freshApp((data) => {
      data.experiments.push({
        experimentID: 'E4',
        name: 'Exp4',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })
    const originalWrite = db.write
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    db.write = jest.fn().mockRejectedValue(new Error('persist failed'))
    try {
      const pending = startRequest(request(app)
        .post('/api/create-tunnel')
        .send({ experimentID: 'E4' }))

      await waitFor(() => processes.length === 1)
      processes[0].emitStdout('Visit https://persist-failed.trycloudflare.com now')

      const res = await pending
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        success: true,
        url: 'https://persist-failed.trycloudflare.com',
      })
      expect(errorSpy).toHaveBeenCalledWith(
        'Error persisting tunnelUrl:',
        expect.any(Error),
      )
    } finally {
      db.write = originalWrite
      errorSpy.mockRestore()
      cleanup()
    }
  })

  test('retries and returns 504 when no tunnel URL is emitted', async () => {
    const { app, cleanup, processes } = await freshApp()
    const timeoutCallbacks = []
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      timeoutCallbacks.push(callback)
      return { __timer: timeoutCallbacks.length }
    })
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout').mockImplementation(() => {})
    const waitForImmediate = async (predicate) => {
      for (let i = 0; i < 20; i += 1) {
        if (predicate()) return
        await new Promise(resolve => setImmediate(resolve))
      }
      throw new Error('Timed out waiting for immediate condition')
    }
    try {
      const pending = startRequest(request(app)
        .post('/api/create-tunnel')
        .send({}))

      await waitForImmediate(() => processes.length === 1 && timeoutCallbacks.length === 1)
      expect(processes).toHaveLength(1)

      timeoutCallbacks.shift()()
      await waitForImmediate(() => processes.length === 2 && timeoutCallbacks.length === 1)
      expect(processes).toHaveLength(2)

      timeoutCallbacks.shift()()
      await waitForImmediate(() => processes.length === 3 && timeoutCallbacks.length === 1)
      expect(processes).toHaveLength(3)

      timeoutCallbacks.shift()()
      const res = await pending
      expect(res.status).toBe(504)
      expect(res.body).toEqual({
        success: false,
        error: 'Could not obtain the tunnel URL after 3 attempts.',
      })
    } finally {
      setTimeoutSpy.mockRestore()
      clearTimeoutSpy.mockRestore()
      cleanup()
    }
  })

  test('closes the active tunnel even when clearing experiment URL fails', async () => {
    const { app, cleanup, db, processes } = await freshApp((data) => {
      data.experiments.push({
        experimentID: 'E5',
        name: 'Exp5',
        tunnelUrl: 'https://close-error.trycloudflare.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })

    const pending = startRequest(request(app)
      .post('/api/create-tunnel')
      .send({ experimentID: 'E5' }))
    await waitFor(() => processes.length === 1)
    processes[0].emitStderr('Visit https://close-error.trycloudflare.com to open your tunnel')
    await pending

    const originalWrite = db.write
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    db.write = jest.fn().mockRejectedValue(new Error('clear failed'))
    try {
      await request(app)
        .post('/api/close-tunnel')
        .send({ experimentID: 'E5' })
        .expect(200, { success: true, message: 'Tunnel closed' })
      expect(processes[0].kill).toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith(
        'Error clearing tunnelUrl from experiment:',
        expect.any(Error),
      )
    } finally {
      db.write = originalWrite
      errorSpy.mockRestore()
      cleanup()
    }
  })

  test('closes active tunnel when provided experimentID does not exist', async () => {
    const { app, cleanup, processes } = await freshApp()

    const pending = startRequest(request(app)
      .post('/api/create-tunnel')
      .send({}))
    await waitFor(() => processes.length === 1)
    processes[0].emitStderr('Visit https://close-missing.trycloudflare.com')
    await pending

    await request(app)
      .post('/api/close-tunnel')
      .send({ experimentID: 'missing-experiment' })
      .expect(200, { success: true, message: 'Tunnel closed' })
    expect(processes[0].kill).toHaveBeenCalled()
    cleanup()
  })

  test('auto-starts persistent custom tunnels on module load', async () => {
    const { cleanup, db, mockSpawn, processes } = await freshApp((data) => {
      data.experiments.push({
        experimentID: 'E3',
        name: 'Exp3',
        tunnelSettings: { hostname: 'persist.example.com', persistent: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })

    await waitFor(() => processes.length === 1)
    expect(mockSpawn.mock.calls[0][1]).toEqual([
      'tunnel',
      '--hostname',
      'persist.example.com',
      '--url',
      'http://localhost:3000',
      '--no-autoupdate',
    ])

    await waitFor(async () => {
      await db.read()
      return db.data.experiments[0].tunnelUrl === 'https://persist.example.com'
    })
    processes[0].emitExit()
    cleanup()
  })
})
