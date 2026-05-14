import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-db-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  await db.write()

  const router = (await import('../../routes/db.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)

  return { app, db, tmpDir }
}

describe('GET /api/export-all-experiments', () => {
  test('404 when no experiments', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/export-all-experiments').expect(404)
  })

  test('returns ZIP with experiments', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'TestExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/export-all-experiments').expect(200)
    expect(res.headers['content-type']).toBe('application/zip')
  })

  test('filters by ids query param', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push(
      { experimentID: 'E1', name: 'Exp1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { experimentID: 'E2', name: 'Exp2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    )
    await db.write()
    const res = await request(app).get('/api/export-all-experiments?ids=E1').expect(200)
    expect(res.headers['content-type']).toBe('application/zip')
  })

  test('404 when filtered ids match none', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'Exp1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    await request(app).get('/api/export-all-experiments?ids=E2').expect(404)
  })
})

describe('GET /api/export-experiment/:experimentID', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/export-experiment/missing').expect(404)
  })

  test('returns ZIP for single experiment', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'TestExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/export-experiment/E1').expect(200)
    expect(res.headers['content-type']).toBe('application/zip')
  })
})

describe('POST /api/import-experiments', () => {
  test('400 when no file uploaded', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .post('/api/import-experiments')
      .expect(400)
    expect(res.body.error).toBe('No file uploaded')
  })
})

describe('POST /api/app/reset', () => {
  test('clears all data and returns success', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Exp1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    db.data.trials.push({ experimentID: 'E1', trials: [], loops: [], timeline: [] })
    db.data.configs.push({ experimentID: 'E1', data: {}, isDevMode: false })
    db.data.sessionResults.push({ experimentID: 'E1', sessionId: 's1', createdAt: new Date().toISOString(), data: [], state: 'completed', lastUpdate: new Date().toISOString(), metadata: {} })
    await db.write()
    const res = await request(app).post('/api/app/reset').send({}).expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.experiments).toHaveLength(0)
    expect(db.data.trials).toHaveLength(0)
    expect(db.data.configs).toHaveLength(0)
    expect(db.data.sessionResults).toHaveLength(0)
  })
})

describe('sanitizeName (helper)', () => {
  test('handles special characters', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'Test/Exp..name!@#',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/export-experiment/E1').expect(200)
    expect(res.headers['content-type']).toBe('application/zip')
  })
})
