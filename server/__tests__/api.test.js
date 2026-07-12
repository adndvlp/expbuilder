import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const makeRouter = (name) => {
  const router = express.Router()
  router.get(`/__test/${name}`, (_req, res) => {
    res.json({ router: name })
  })
  return router
}

const setupApi = async (seedFn, options = {}) => {
  jest.resetModules()

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-api-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  if (options.origin) process.env.ORIGIN = options.origin
  else delete process.env.ORIGIN

  const { db, ensureDbData } = await import('../utils/db.js')
  db.data = {}
  ensureDbData()
  if (seedFn) seedFn(db.data)
  await db.write()

  let capturedApp
  const listenPromises = []
  const httpServer = {
    listen: jest.fn((_port, callback) => {
      if (callback) listenPromises.push(Promise.resolve(callback()))
      return httpServer
    }),
  }
  const createServer = jest.fn((app) => {
    capturedApp = app
    return httpServer
  })

  const roomEmitter = { emit: jest.fn() }
  let connectionHandler
  const io = {
    on: jest.fn((event, handler) => {
      if (event === 'connection') connectionHandler = handler
    }),
    to: jest.fn(() => roomEmitter),
  }
  const Server = jest.fn(() => io)

  jest.unstable_mockModule('http', () => ({ createServer }))
  jest.unstable_mockModule('socket.io', () => ({ Server }))
  jest.unstable_mockModule('dotenv', () => ({
    default: { config: jest.fn() },
    config: jest.fn(),
  }))
  jest.unstable_mockModule('../routes/experiments.js', () => ({ default: makeRouter('experiments') }))
  jest.unstable_mockModule('../routes/plugins.js', () => ({ default: makeRouter('plugins') }))
  jest.unstable_mockModule('../routes/files.js', () => ({ default: makeRouter('files') }))
  jest.unstable_mockModule('../routes/results.js', () => ({ default: makeRouter('results') }))
  jest.unstable_mockModule('../routes/timeline/index.js', () => ({ default: makeRouter('timeline') }))
  jest.unstable_mockModule('../routes/tunnel.js', () => ({ default: makeRouter('tunnel') }))
  jest.unstable_mockModule('../routes/configs.js', () => ({ default: makeRouter('configs') }))
  jest.unstable_mockModule('../routes/db.js', () => ({ default: makeRouter('db') }))
  jest.unstable_mockModule('../agent/routes.js', () => ({ default: makeRouter('agent') }))

  await import('../api.js')
  await Promise.all(listenPromises)

  return {
    app: capturedApp,
    cleanup: () => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      delete process.env.DB_ROOT
      delete process.env.ORIGIN
    },
    connectionHandler,
    createServer,
    db,
    httpServer,
    io,
    roomEmitter,
    Server,
  }
}

describe('api.js app setup', () => {
  test('creates the HTTP and Socket.IO servers, mounts routers, and clears stale tunnel URLs', async () => {
    const { app, cleanup, createServer, db, httpServer, Server } = await setupApi((data) => {
      data.experiments.push({
        experimentID: 'E1',
        name: 'Experiment',
        tunnelUrl: 'https://old.trycloudflare.com',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
    })

    expect(createServer).toHaveBeenCalledWith(app)
    expect(Server).toHaveBeenCalledWith(httpServer, expect.objectContaining({
      cors: expect.objectContaining({
        methods: ['GET', 'POST'],
        credentials: true,
      }),
    }))
    expect(httpServer.listen).toHaveBeenCalledWith(3000, expect.any(Function))

    await db.read()
    expect(db.data.experiments[0].tunnelUrl).toBeUndefined()

    await request(app).get('/__test/experiments').expect(200, { router: 'experiments' })
    cleanup()
  })

  test('handles CORS and 404 responses', async () => {
    const { app, cleanup, httpServer, Server } = await setupApi(undefined, { origin: 'https://allowed.example.com' })

    expect(Server).toHaveBeenCalledWith(httpServer, expect.objectContaining({
      cors: expect.objectContaining({
        origin: 'https://allowed.example.com',
      }),
    }))

    const allowed = await request(app)
      .get('/api/missing')
      .set('Origin', 'http://localhost:5173')
      .expect(404)
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(allowed.body).toEqual({ error: 'API endpoint not found' })

    await request(app)
      .get('/api/missing')
      .set('Origin', 'http://not-allowed.test')
      .expect(500)

    const page = await request(app).get('/missing-page').expect(404)
    expect(page.text).toBe("This page doesn't exist.")

    cleanup()
  })

  test('honors configured CORS origin and allows Electron requests without origin', async () => {
    const { app, cleanup } = await setupApi(undefined, { origin: 'https://allowed.example.com' })

    const configured = await request(app)
      .get('/api/missing')
      .set('Origin', 'https://allowed.example.com')
      .expect(404)
    expect(configured.headers['access-control-allow-origin']).toBe('https://allowed.example.com')

    await request(app)
      .get('/api/missing')
      .expect(404, { error: 'API endpoint not found' })

    cleanup()
  })

  test('tracks active sessions and mirrors state changes into the database', async () => {
    const {
      cleanup,
      connectionHandler,
      db,
      io,
      roomEmitter,
    } = await setupApi((data) => {
      data.sessionResults.push({
        experimentID: 'E1',
        sessionId: 'S1',
        state: 'initiated',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastUpdate: '2024-01-01T00:00:00.000Z',
        metadata: {},
        data: [],
      })
    })

    const socketHandlers = {}
    const socket = {
      id: 'socket-1',
      emit: jest.fn(),
      join: jest.fn(),
      on: jest.fn((event, handler) => {
        socketHandlers[event] = handler
      }),
    }

    connectionHandler(socket)
    expect(socketHandlers).toEqual(expect.objectContaining({
      disconnect: expect.any(Function),
      'join-experiment': expect.any(Function),
      'listen-experiment': expect.any(Function),
      'update-session-state': expect.any(Function),
    }))

    await socketHandlers['join-experiment']({
      experimentID: 'E1',
      sessionId: 'S1',
      state: 'in-progress',
      metadata: { browser: 'Chrome' },
    })
    expect(socket.join).toHaveBeenCalledWith('E1')
    expect(io.to).toHaveBeenCalledWith('E1')
    expect(roomEmitter.emit).toHaveBeenCalledWith('session-update', expect.objectContaining({
      experimentID: 'E1',
      sessions: [expect.objectContaining({
        sessionId: 'S1',
        state: 'in-progress',
        metadata: { browser: 'Chrome' },
      })],
    }))

    await db.read()
    expect(db.data.sessionResults[0].state).toBe('in-progress')
    expect(db.data.sessionResults[0].metadata).toEqual({ browser: 'Chrome' })

    await socketHandlers['update-session-state']({
      experimentID: 'E1',
      sessionId: 'S1',
      state: 'paused',
    })
    await db.read()
    expect(db.data.sessionResults[0].state).toBe('paused')

    socketHandlers['listen-experiment']('E1')
    expect(socket.emit).toHaveBeenCalledWith('session-update', expect.objectContaining({
      experimentID: 'E1',
      sessions: [expect.objectContaining({ sessionId: 'S1', state: 'paused' })],
    }))

    await socketHandlers.disconnect()
    await db.read()
    expect(db.data.sessionResults[0].state).toBe('abandoned')

    cleanup()
  })

  test('handles socket branches for new, missing, and completed sessions', async () => {
    const { cleanup, connectionHandler, db, roomEmitter } = await setupApi((data) => {
      data.sessionResults.push({
        experimentID: 'E1',
        sessionId: 'completed',
        state: 'completed',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastUpdate: '2024-01-01T00:00:00.000Z',
        metadata: {},
        data: [],
      })
      data.sessionResults.push({
        experimentID: 'E3',
        sessionId: 'persisted',
        state: 'initiated',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastUpdate: '2024-01-01T00:00:00.000Z',
        metadata: { existing: true },
        data: [],
      })
    })

    const socketHandlers = {}
    const socket = {
      id: 'socket-2',
      emit: jest.fn(),
      join: jest.fn(),
      on: jest.fn((event, handler) => {
        socketHandlers[event] = handler
      }),
    }

    connectionHandler(socket)

    await socketHandlers['update-session-state']({
      experimentID: 'NO_ACTIVE',
      sessionId: 'missing-active-session',
      state: 'ignored',
    })

    await socketHandlers['join-experiment']({ experimentID: 'E2', sessionId: 'new-session' })
    await socketHandlers['join-experiment']({ experimentID: 'E2', sessionId: 'second-session' })
    expect(roomEmitter.emit).toHaveBeenCalledWith('session-update', expect.objectContaining({
      experimentID: 'E2',
      sessions: expect.arrayContaining([
        expect.objectContaining({
          sessionId: 'new-session',
          state: 'initiated',
          metadata: {},
        }),
      ]),
    }))

    await socketHandlers['update-session-state']({
      experimentID: 'E2',
      sessionId: 'missing-active-session',
      state: 'ignored',
    })

    await socketHandlers['update-session-state']({
      experimentID: 'E2',
      sessionId: 'new-session',
      state: 'active',
    })

    socketHandlers['listen-experiment']('unknown-experiment')
    expect(socket.emit).not.toHaveBeenCalledWith('session-update', expect.objectContaining({
      experimentID: 'unknown-experiment',
    }))

    await socketHandlers['join-experiment']({
      experimentID: 'E3',
      sessionId: 'persisted',
      metadata: { fresh: true },
    })
    await db.read()
    expect(db.data.sessionResults.find(s => s.sessionId === 'persisted')).toEqual(expect.objectContaining({
      state: 'initiated',
      metadata: { existing: true, fresh: true },
    }))

    await socketHandlers['join-experiment']({
      experimentID: 'E1',
      sessionId: 'completed',
      state: 'completed',
    })

    const otherSocketHandlers = {}
    connectionHandler({
      id: 'socket-other',
      emit: jest.fn(),
      join: jest.fn(),
      on: jest.fn((event, handler) => {
        otherSocketHandlers[event] = handler
      }),
    })
    await otherSocketHandlers['join-experiment']({
      experimentID: 'E4',
      sessionId: 'foreign-session',
    })
    await socketHandlers['join-experiment']({
      experimentID: 'E4',
      sessionId: 'own-session',
    })

    await socketHandlers.disconnect()
    await db.read()
    expect(db.data.sessionResults.find(s => s.sessionId === 'completed').state).toBe('completed')

    cleanup()
  })
})
