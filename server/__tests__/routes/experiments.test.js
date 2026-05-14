import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-exps-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  await db.write()

  const router = (await import('../../routes/experiments.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)

  return { app, db, tmpDir }
}

describe('GET /api/load-experiments', () => {
  test('returns empty list', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/load-experiments').expect(200)
    expect(res.body.experiments).toEqual([])
  })

  test('returns experiments sorted by createdAt desc', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push(
      { experimentID: 'E1', name: 'Old', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { experimentID: 'E2', name: 'New', createdAt: '2024-06-01', updatedAt: '2024-06-01' },
    )
    await db.write()
    const res = await request(app).get('/api/load-experiments').expect(200)
    expect(res.body.experiments[0].name).toBe('New')
    expect(res.body.experiments[1].name).toBe('Old')
  })
})

describe('GET /api/experiment/:experimentID', () => {
  test('404 when not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/experiment/missing').expect(404)
  })

  test('returns experiment', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'TestExp',
      description: 'A test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/experiment/E1').expect(200)
    expect(res.body.experiment.name).toBe('TestExp')
    expect(res.body.experiment.description).toBe('A test')
  })
})

describe('POST /api/create-experiment', () => {
  test('400 when name missing', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .post('/api/create-experiment')
      .send({ description: 'desc' })
      .expect(400)
    expect(res.body.error).toBe('Name required')
  })

  test('creates experiment with generated UUID', async () => {
    const { app, db } = await freshApp()
    const res = await request(app)
      .post('/api/create-experiment')
      .send({ name: 'NewExp', description: 'desc', author: 'author1', uid: 'u1', storage: 'googledrive' })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.experiment.experimentID).toBeDefined()
    expect(res.body.experiment.name).toBe('NewExp')
    await db.read()
    expect(db.data.experiments).toHaveLength(1)
  })
})

describe('DELETE /api/delete-experiment/:experimentID', () => {
  test('handles non-existent experiment gracefully', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .delete('/api/delete-experiment/E1')
      .send({})
      .expect(200)
    expect(res.body.success).toBe(true)
  })

  test('deletes experiment and related data', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Exp1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    db.data.trials.push({ experimentID: 'E1', trials: [], loops: [], timeline: [] })
    db.data.configs.push({ experimentID: 'E1', data: {}, isDevMode: false })
    db.data.sessionResults.push({ experimentID: 'E1', sessionId: 's1', createdAt: new Date().toISOString(), data: [], state: 'completed', lastUpdate: new Date().toISOString(), metadata: {} })
    db.data.participantFiles.push({ id: 'pf1', experimentID: 'E1', filename: 'f.txt' })
    // Create upload directory
    fs.mkdirSync(path.join(tmpDir, 'Exp1', 'img'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'Exp1', 'img', 'photo.jpg'), 'data')
    await db.write()

    const res = await request(app)
      .delete('/api/delete-experiment/E1')
      .send({})
      .expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.experiments).toHaveLength(0)
    expect(db.data.trials).toHaveLength(0)
    expect(db.data.configs).toHaveLength(0)
    expect(db.data.sessionResults).toHaveLength(0)
    expect(db.data.participantFiles).toHaveLength(0)
  })
})

describe('GET /api/appearance-settings/:experimentID', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/appearance-settings/E1').expect(404)
  })

  test('returns default settings when none set', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Exp1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()
    const res = await request(app).get('/api/appearance-settings/E1').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.settings.backgroundColor).toBe('#ffffff')
    expect(res.body.settings.fullScreen).toBe(true)
    expect(res.body.settings.progressBar).toBe(false)
  })

  test('returns saved settings', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'Exp1',
      appearanceSettings: { backgroundColor: '#000000', fullScreen: false, progressBar: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/appearance-settings/E1').expect(200)
    expect(res.body.settings.backgroundColor).toBe('#000000')
    expect(res.body.settings.fullScreen).toBe(false)
    expect(res.body.settings.progressBar).toBe(true)
  })
})

describe('PUT /api/appearance-settings/:experimentID', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .put('/api/appearance-settings/E1')
      .send({ backgroundColor: '#ccc' })
      .expect(404)
  })

  test('saves appearance settings', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Exp1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()
    const res = await request(app)
      .put('/api/appearance-settings/E1')
      .send({ backgroundColor: '#123456', fullScreen: false, progressBar: true })
      .expect(200)
    expect(res.body.settings.backgroundColor).toBe('#123456')
    expect(res.body.settings.fullScreen).toBe(false)
    expect(res.body.settings.progressBar).toBe(true)
  })

  test('truncates backgroundColor to 20 chars', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Exp1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()
    const res = await request(app)
      .put('/api/appearance-settings/E1')
      .send({ backgroundColor: '#12345678901234567890extra' })
      .expect(200)
    expect(res.body.settings.backgroundColor.length).toBeLessThanOrEqual(20)
  })
})

describe('POST /api/run-experiment/:experimentID', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .post('/api/run-experiment/E1')
      .send({ generatedCode: 'const x = 1;' })
      .expect(404)
  })
})
