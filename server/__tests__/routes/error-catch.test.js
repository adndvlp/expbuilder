import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

async function freshAppWithError(routerImport, seedFn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-ec-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()
  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  if (seedFn) seedFn(db)
  await db.write()
  // Only mock read — write stays functional so initial data persists
  db.read = async () => { throw new Error('mock error') }
  const router = (await import(routerImport)).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)
  return { app, tmpDir }
}

// ── configs.js error handlers (lines 35, 87, 104, 140) ─────────────────────
describe('configs.js error handlers', () => {
  test('GET load-config error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/configs.js')
    await request(app).get('/api/load-config/E1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('POST save-config error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/configs.js')
    await request(app).post('/api/save-config/E1').send({ config: {} }).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('GET session-name-config error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/configs.js')
    await request(app).get('/api/session-name-config/E1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('POST session-name-config error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/configs.js')
    await request(app).post('/api/session-name-config/E1').send({ tokens: [] }).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

// ── results.js error handlers ────────────────────────────────────────────────
describe('results.js error handlers', () => {
  test('GET session-results error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/results.js')
    await request(app).get('/api/session-results/E1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('GET participant-number error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/results.js')
    await request(app).get('/api/participant-number/E1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('POST complete-session error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/results.js')
    await request(app).post('/api/complete-session/E1').send({ sessionId: 's1' }).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('POST save-online-session-metadata error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/results.js')
    await request(app).post('/api/save-online-session-metadata/E1').send({ sessionId: 's1' }).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('GET download-session error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/results.js')
    await request(app).get('/api/download-session/s1/E1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('POST download-sessions-zip error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/results.js')
    await request(app).post('/api/download-sessions-zip').send({ sessionIds: ['s1'], experimentID: 'E1' }).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('PATCH rename-session error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/results.js')
    await request(app).patch('/api/rename-session/E1').send({ oldSessionId: 'old', newSessionId: 'new' }).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

// ── plugins.js error handlers ────────────────────────────────────────────────
describe('plugins.js error handlers', () => {
  test('GET load-plugins error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/plugins.js')
    await request(app).get('/api/load-plugins').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('POST save-plugin error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/plugins.js')
    await request(app).post('/api/save-plugin/0').send({ name: 'p', scripTag: 'p.js', pluginCode: 'c' }).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('DELETE delete-plugin error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/plugins.js')
    await request(app).delete('/api/delete-plugin/0').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

// ── files.js error handlers (only routes with outer try-catch) ──────────
describe('files.js error handlers', () => {
  test('GET list-files error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/files.js')
    await request(app).get('/api/list-files/img/E1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('POST participant-files error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/files.js')
    await request(app).post('/api/participant-files/E1').send({ files: [{ name: 'f.txt', data: 'dGVzdA==', type: 'text/plain', size: 4 }] }).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('GET participant-files error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/files.js')
    await request(app).get('/api/participant-files/E1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('GET serve-participant-file error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/files.js')
    await request(app).get('/api/participant-files-serve/E1/f.txt').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('DELETE participant-file error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/files.js')
    await request(app).delete('/api/participant-files/E1/pf1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

// ── experiments.js error handlers ───────────────────────────────────────────
describe('experiments.js error handlers', () => {
  test('GET load-experiments error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/experiments.js')
    await request(app).get('/api/load-experiments').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('GET experiment error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/experiments.js')
    await request(app).get('/api/experiment/E1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('POST create-experiment error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/experiments.js')
    await request(app).post('/api/create-experiment').send({ name: 'Test' }).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('DELETE delete-experiment error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/experiments.js')
    await request(app).delete('/api/delete-experiment/E1').send({}).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('GET appearance-settings error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/experiments.js')
    await request(app).get('/api/appearance-settings/E1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('PUT appearance-settings error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/experiments.js')
    await request(app).put('/api/appearance-settings/E1').send({ backgroundColor: '#000' }).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

// ── db.js error handlers ─────────────────────────────────────────────────────
describe('db.js error handlers', () => {
  test('GET export-all error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/db.js')
    await request(app).get('/api/export-all-experiments').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('GET export-experiment error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/db.js')
    await request(app).get('/api/export-experiment/E1').expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  test('POST app/reset error', async () => {
    const { app, tmpDir } = await freshAppWithError('../../routes/db.js')
    await request(app).post('/api/app/reset').send({}).expect(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
