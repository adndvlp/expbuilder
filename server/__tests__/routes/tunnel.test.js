import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

// Mock child_process spawn to prevent actual tunnel creation
const mockChildProcess = () => ({
  stdout: { on: jest.fn() },
  stderr: { on: jest.fn() },
  on: jest.fn(),
  kill: jest.fn(),
})
const mockSpawn = jest.fn(mockChildProcess)

jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn,
  __esModule: true,
}))

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-tunnel-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  await db.write()

  const router = (await import('../../routes/tunnel.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)

  // Wait for setImmediate auto-start handler to complete
  // It does db.read() + db.write() which races with test data writes
  await new Promise(r => setTimeout(r, 200))

  return { app, db, tmpDir }
}

describe('GET /api/tunnel-settings/:experimentID', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/tunnel-settings/E1').expect(404)
  })

  test('returns default settings when none set', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'Exp1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/tunnel-settings/E1').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.settings).toEqual({ hostname: '', persistent: false })
  })

  test('returns saved settings', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E2',
      name: 'Exp2',
      tunnelSettings: { hostname: 'myexp.example.com', persistent: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/tunnel-settings/E2').expect(200)
    expect(res.body.settings.hostname).toBe('myexp.example.com')
    expect(res.body.settings.persistent).toBe(true)
  })
})

describe('PUT /api/tunnel-settings/:experimentID', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .put('/api/tunnel-settings/E1')
      .send({ hostname: 'test.example.com' })
      .expect(404)
  })

  test('saves tunnel settings', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E3',
      name: 'Exp3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app)
      .put('/api/tunnel-settings/E3')
      .send({ hostname: 'myexp.example.com', persistent: true })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.settings.hostname).toBe('myexp.example.com')
    expect(res.body.settings.persistent).toBe(true)
  })

  test('normalizes hostname (strips protocol and trailing slash)', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E4',
      name: 'Exp4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app)
      .put('/api/tunnel-settings/E4')
      .send({ hostname: 'https://myexp.example.com/' })
      .expect(200)
    expect(res.body.settings.hostname).toBe('myexp.example.com')
  })
})

describe('POST /api/close-tunnel', () => {
  test('400 when no active tunnel', async () => {
    const { app } = await freshApp()
    const res = await request(app).post('/api/close-tunnel').expect(400)
    expect(res.body.message).toBe('No active tunnel')
  })
})
