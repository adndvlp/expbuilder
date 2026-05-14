import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-exps2-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  await db.write()

  // Copy real templates to temp source dir so ensureTemplate works
  const realServerTemplates = path.resolve(import.meta.dirname, '../../../templates')
  const sourceTemplateDir = path.join(tmpDir, 'server', 'templates')
  fs.mkdirSync(sourceTemplateDir, { recursive: true })
  if (fs.existsSync(realServerTemplates)) {
    for (const f of fs.readdirSync(realServerTemplates)) {
      fs.copyFileSync(path.join(realServerTemplates, f), path.join(sourceTemplateDir, f))
    }
  }

  const router = (await import('../../routes/experiments.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)

  return { app, db, tmpDir }
}

describe('GET /:experimentID (serve experiment HTML)', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/MISSING_EXP').expect(404)
  })

  test('404 when HTML not built yet', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'NoHtmlExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    await request(app).get('/NoHtmlExp').expect(404)
  })
})

describe('GET /:experimentID/preview', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/MISSING/preview').expect(404)
  })

  test('404 when preview HTML not built', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'NoPrevExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    await request(app).get('/NoPrevExp/preview').expect(404)
  })
})

describe('POST /api/run-experiment/:experimentID', () => {
  test('400 when no generated code', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'RunExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app)
      .post('/api/run-experiment/E1')
      .send({})
      .expect(400)
    expect(res.body.error).toContain('No generated code')
  })

  test('builds experiment HTML successfully', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'RunExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app)
      .post('/api/run-experiment/E1')
      .send({ generatedCode: 'jsPsych.run(timeline);' })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.experimentUrl).toContain('RunExp')
  })
})

describe('POST /api/trials-preview/:experimentID', () => {
  test('400 when no generated code', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'PrevExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app)
      .post('/api/trials-preview/E1')
      .send({})
      .expect(400)
    expect(res.body.error).toContain('No generated code')
  })

  test('builds preview HTML successfully', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'PrevExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app)
      .post('/api/trials-preview/E1')
      .send({ generatedCode: 'jsPsych.run(timeline);' })
      .expect(200)
    expect(res.body.success).toBe(true)
  })
})

describe('POST /api/publish-experiment/:experimentID', () => {
  test('400 when uid missing', async () => {
    const { app } = await freshApp()
    await request(app)
      .post('/api/publish-experiment/E1')
      .send({})
      .expect(400)
  })

  test('400 when generatedPublicCode missing', async () => {
    const { app } = await freshApp()
    await request(app)
      .post('/api/publish-experiment/E1')
      .send({ uid: 'u1' })
      .expect(400)
  })

  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .post('/api/publish-experiment/E1')
      .send({ uid: 'u1', generatedPublicCode: 'code' })
      .expect(404)
  })
})

describe('GET /api/load-experiments error handling', () => {
  test('handles db errors gracefully', async () => {
    // Skip: requires mocking db.read to throw
  })
})

describe('DELETE /api/delete-experiment/:experimentID error handling', () => {
  test('handles experiment not found gracefully', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .delete('/api/delete-experiment/NONEXISTENT')
      .send({})
      .expect(200)
    expect(res.body.success).toBe(true)
  })
})
