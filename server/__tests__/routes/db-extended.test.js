import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-db2-'))
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

describe('GET /api/export-all-experiments edge cases', () => {
  test('includes trials, config, and session results in data.json', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'ExportExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1' }],
      loops: [],
      timeline: [{ id: 1, type: 'trial', name: 'T1' }],
    })
    db.data.configs.push({
      experimentID: 'E1',
      data: { code: 'test' },
      isDevMode: false,
    })
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [{ rt: 500 }],
      state: 'completed',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    await db.write()

    const res = await request(app).get('/api/export-all-experiments').expect(200)
    expect(res.headers['content-type']).toBe('application/zip')
    expect(res.body).toBeDefined()
  })

  test('includes multimedia files in export', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'MediaExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    // Create media files
    const imgDir = path.join(tmpDir, 'MediaExp', 'img')
    fs.mkdirSync(imgDir, { recursive: true })
    fs.writeFileSync(path.join(imgDir, 'photo.jpg'), 'fakeimg')
    await db.write()

    const res = await request(app).get('/api/export-all-experiments').expect(200)
    expect(res.headers['content-type']).toBe('application/zip')
  })
})

describe('GET /api/export-experiment/:experimentID edge cases', () => {
  test('uses sanitized name in filename', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'Test Exp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/export-experiment/E1').expect(200)
    expect(res.headers['content-disposition']).toContain('Test Exp-backup')
  })
})

describe('POST /api/app/reset', () => {
  test('clears runtime directories', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'Exp1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    // Create runtime dirs
    const expDir = path.join(tmpDir, 'Exp1')
    fs.mkdirSync(expDir, { recursive: true })
    fs.writeFileSync(path.join(expDir, 'file.txt'), 'data')

    const uploadsDir = path.join(tmpDir, 'uploads')
    fs.mkdirSync(uploadsDir, { recursive: true })
    fs.writeFileSync(path.join(uploadsDir, 'tmp.txt'), 'data')

    const experimentsHtmlDir = path.join(tmpDir, 'experiments_html')
    fs.mkdirSync(experimentsHtmlDir, { recursive: true })
    fs.writeFileSync(path.join(experimentsHtmlDir, 'Exp1.html'), 'html')

    const previewsDir = path.join(tmpDir, 'trials_previews_html')
    fs.mkdirSync(previewsDir, { recursive: true })
    fs.writeFileSync(path.join(previewsDir, 'Exp1.html'), 'html')

    await db.write()

    const res = await request(app).post('/api/app/reset').send({}).expect(200)
    expect(res.body.success).toBe(true)
    // Runtime dirs should be deleted
    expect(fs.existsSync(expDir)).toBe(false)
    expect(fs.existsSync(uploadsDir)).toBe(false)
    // Fixed dirs should exist but be empty
    expect(fs.existsSync(experimentsHtmlDir)).toBe(true)
    expect(fs.readdirSync(experimentsHtmlDir)).toHaveLength(0)
  })
})
