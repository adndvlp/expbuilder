import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-configs-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  await db.write()

  const router = (await import('../../routes/configs.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)

  return { app, db, tmpDir }
}

describe('GET /api/load-config/:experimentID', () => {
  test('returns null config when not found', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/load-config/E1').expect(200)
    expect(res.body).toEqual({ config: null, isDevMode: false, isSaveMode: false })
  })

  test('returns config doc when found', async () => {
    const { app, db } = await freshApp()
    db.data.configs.push({
      experimentID: 'E1',
      data: { generatedCode: 'const x = 1;' },
      isDevMode: true,
      isSaveMode: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/load-config/E1').expect(200)
    expect(res.body.config).toEqual({ generatedCode: 'const x = 1;' })
    expect(res.body.isDevMode).toBe(true)
    expect(res.body.isSaveMode).toBe(true)
  })

  test('defaults isSaveMode to false when not set', async () => {
    const { app, db } = await freshApp()
    db.data.configs.push({
      experimentID: 'E1',
      data: { generatedCode: 'x' },
      isDevMode: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/load-config/E1').expect(200)
    expect(res.body.isSaveMode).toBe(false)
  })
})

describe('POST /api/save-config/:experimentID', () => {
  test('creates new config doc', async () => {
    const { app, db } = await freshApp()
    const res = await request(app)
      .post('/api/save-config/E1')
      .send({ config: { generatedCode: 'code' }, isDevMode: true, isSaveMode: true })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.config.experimentID).toBe('E1')
    expect(res.body.config.data.generatedCode).toBe('code')
    await db.read()
    expect(db.data.configs).toHaveLength(1)
  })

  test('updates existing config doc', async () => {
    const { app, db } = await freshApp()
    db.data.configs.push({
      experimentID: 'E1',
      data: { oldCode: 'x' },
      isDevMode: false,
      isSaveMode: false,
      createdAt: '2020-01-01',
      updatedAt: '2020-01-01',
    })
    await db.write()
    const res = await request(app)
      .post('/api/save-config/E1')
      .send({ config: { generatedCode: 'new' }, isDevMode: true, isSaveMode: true })
      .expect(200)
    expect(res.body.config.createdAt).toBe('2020-01-01') // preserved
    expect(res.body.config.data.generatedCode).toBe('new')
  })

  test('preserves sessionNameConfig on update', async () => {
    const { app, db } = await freshApp()
    db.data.configs.push({
      experimentID: 'E1',
      data: {},
      isDevMode: false,
      isSaveMode: false,
      createdAt: '2020-01-01',
      updatedAt: '2020-01-01',
      sessionNameConfig: { tokens: ['id'], separator: '-' },
    })
    await db.write()
    await request(app)
      .post('/api/save-config/E1')
      .send({ config: { code: 'x' }, isDevMode: true })
      .expect(200)
    await db.read()
    expect(db.data.configs[0].sessionNameConfig).toEqual({ tokens: ['id'], separator: '-' })
  })

  test('does not preserve null sessionNameConfig', async () => {
    const { app, db } = await freshApp()
    db.data.configs.push({
      experimentID: 'E1',
      data: {},
      isDevMode: false,
      isSaveMode: false,
      createdAt: '2020-01-01',
      updatedAt: '2020-01-01',
      sessionNameConfig: null,
    })
    await db.write()
    await request(app)
      .post('/api/save-config/E1')
      .send({ config: { code: 'x' }, isDevMode: true })
      .expect(200)
    await db.read()
    expect(db.data.configs[0].sessionNameConfig).toBeUndefined()
  })
})

describe('GET /api/session-name-config/:experimentID', () => {
  test('returns default when no config', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/session-name-config/E1').expect(200)
    expect(res.body).toEqual({ tokens: [], separator: '_' })
  })

  test('returns saved session name config', async () => {
    const { app, db } = await freshApp()
    db.data.configs.push({
      experimentID: 'E1',
      data: {},
      isDevMode: false,
      isSaveMode: false,
      sessionNameConfig: { tokens: ['counter'], separator: '-' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/session-name-config/E1').expect(200)
    expect(res.body).toEqual({ tokens: ['counter'], separator: '-' })
  })
})

describe('POST /api/session-name-config/:experimentID', () => {
  test('creates config doc when none exists', async () => {
    const { app, db } = await freshApp()
    const res = await request(app)
      .post('/api/session-name-config/E1')
      .send({ tokens: ['id', 'date'], separator: '_' })
      .expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.configs[0].experimentID).toBe('E1')
    expect(db.data.configs[0].sessionNameConfig.tokens).toEqual(['id', 'date'])
  })

  test('updates existing config doc', async () => {
    const { app, db } = await freshApp()
    db.data.configs.push({
      experimentID: 'E1',
      data: {},
      isDevMode: false,
      isSaveMode: false,
      sessionNameConfig: { tokens: ['old'], separator: '-' },
      createdAt: '2020-01-01',
      updatedAt: '2020-01-01',
    })
    await db.write()
    await request(app)
      .post('/api/session-name-config/E1')
      .send({ tokens: ['new'], separator: '_' })
      .expect(200)
    await db.read()
    expect(db.data.configs[0].sessionNameConfig).toEqual({ tokens: ['new'], separator: '_' })
  })
})
