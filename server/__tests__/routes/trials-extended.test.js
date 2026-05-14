import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-trials2-'))
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

  return { app, db, tmpDir }
}

describe('PATCH /api/trial/:experimentID/:id', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .patch('/api/trial/E1/999')
      .send({ name: 'Renamed' })
      .expect(404)
  })

  test('404 when trial not found', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [],
      timeline: [],
    })
    await db.write()
    await request(app)
      .patch('/api/trial/E1/999')
      .send({ name: 'Renamed' })
      .expect(404)
  })

  test('updates trial fields and timeline when name changes', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'Old', plugin: 'p', branches: [] }],
      loops: [],
      timeline: [{ id: 1, type: 'trial', name: 'Old', branches: [] }],
    })
    await db.write()
    const res = await request(app)
      .patch('/api/trial/E1/1')
      .send({ name: 'Renamed', branches: [2] })
      .expect(200)
    expect(res.body.trial.name).toBe('Renamed')
    expect(res.body.trial.branches).toEqual([2])
    expect(db.data.trials[0].timeline[0].name).toBe('Renamed')
  })

  test('only updates timeline when timeline entry exists', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', plugin: 'p', parentLoopId: 'loop_1', branches: [] }],
      loops: [],
      timeline: [], // no timeline entry for this trial
    })
    await db.write()
    const res = await request(app)
      .patch('/api/trial/E1/1')
      .send({ name: 'Renamed' })
      .expect(200)
    expect(res.body.trial.name).toBe('Renamed')
  })

  test('updates multiple fields at once', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'Old', plugin: 'p', branches: [], trialCode: '' }],
      loops: [],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .patch('/api/trial/E1/1')
      .send({ trialCode: 'newCode', plugin: 'plugin-2' })
      .expect(200)
    expect(res.body.trial.trialCode).toBe('newCode')
    expect(res.body.trial.plugin).toBe('plugin-2')
  })
})

describe('DELETE /api/trial/:experimentID/:id', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app).delete('/api/trial/E1/999').expect(404)
  })

  test('deletes trial and reconnects branches', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'Parent', branches: [2] },
        { id: 2, name: 'ToDelete', branches: [3] },
        { id: 3, name: 'Child', branches: [] },
      ],
      loops: [],
      timeline: [
        { id: 1, type: 'trial', name: 'Parent' },
        { id: 2, type: 'trial', name: 'ToDelete' },
        { id: 3, type: 'trial', name: 'Child' },
      ],
    })
    await db.write()
    const res = await request(app).delete('/api/trial/E1/2').expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    // Parent should now connect to Child
    const parent = db.data.trials[0].trials.find(t => t.id === 1)
    expect(parent.branches).toContain(3)
    expect(parent.branches).not.toContain(2)
    // Deleted trial gone
    expect(db.data.trials[0].trials.find(t => t.id === 2)).toBeUndefined()
    // Timeline updated
    expect(db.data.trials[0].timeline.find(t => t.id === 2)).toBeUndefined()
  })

  test('removes trial from loop references', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', branches: [] }],
      loops: [{ id: 'loop_1', name: 'L1', trials: [1], branches: [] }],
      timeline: [],
    })
    await db.write()
    await request(app).delete('/api/trial/E1/1').expect(200)
    await db.read()
    expect(db.data.trials[0].loops[0].trials).not.toContain(1)
  })
})

describe('DELETE /api/trials/:experimentID', () => {
  test('deletes all trials for an experiment', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push(
      { experimentID: 'E1', trials: [{ id: 1 }], loops: [], timeline: [] },
      { experimentID: 'E2', trials: [{ id: 2 }], loops: [], timeline: [] },
    )
    await db.write()
    const res = await request(app).delete('/api/trials/E1').expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.trials).toHaveLength(1)
    expect(db.data.trials[0].experimentID).toBe('E2')
  })

  test('handles experiment with no trials gracefully', async () => {
    const { app } = await freshApp()
    const res = await request(app).delete('/api/trials/E1').expect(200)
    expect(res.body.success).toBe(true)
  })
})
