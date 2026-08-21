import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-loop-metadata-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  await db.write()

  const router = (await import('../../routes/timeline/index.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)
  return { app, db }
}

describe('GET /api/loop-trials-metadata/:experimentID/:loopId', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/loop-trials-metadata/E1/loop_1').expect(404)
  })

  test('404 when loop not found', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [],
      timeline: [],
    })
    await db.write()
    await request(app).get('/api/loop-trials-metadata/E1/loop_missing').expect(404)
  })

  test('returns only items owned directly by the loop scope', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [2] },
        { id: 2, name: 'T2', branches: [] },
      ],
      loops: [{ id: 'loop_1', name: 'L1', trials: [1], branches: [] }],
      timeline: [],
    })
    await db.write()
    const response = await request(app)
      .get('/api/loop-trials-metadata/E1/loop_1')
      .expect(200)
    expect(response.body.trialsMetadata.map((trial) => trial.id)).toEqual([1])
  })
})
