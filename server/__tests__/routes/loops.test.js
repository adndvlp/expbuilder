import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-loops-'))
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

describe('POST /api/loop/:experimentID', () => {
  test('creates loop and experiment doc', async () => {
    const { app, db } = await freshApp()
    const res = await request(app)
      .post('/api/loop/E1')
      .send({ name: 'L1', trials: [], loopConfig: { repetitions: 5 } })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.loop.id).toMatch(/^loop_/)
    await db.read()
    expect(db.data.trials[0].loops).toHaveLength(1)
    expect(db.data.trials[0].timeline).toHaveLength(1)
  })

  test('removes loop trials from timeline and adds loop entry', async () => {
    const { app, db } = await freshApp()
    // Create experiment doc with trials pre-existing
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
        { id: 2, name: 'T2', branches: [] },
      ],
      loops: [],
      timeline: [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
    })
    await db.write()

    const res = await request(app)
      .post('/api/loop/E1')
      .send({ name: 'L1', trials: [1, 2], loopConfig: {} })
      .expect(200)

    await db.read()
    const doc = db.data.trials[0]
    expect(doc.timeline).toHaveLength(1)
    expect(doc.timeline[0].type).toBe('loop')
    expect(doc.loops).toHaveLength(1)
  })

  test('updates branches that reference loop trials', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [2] },
        { id: 2, name: 'T2', branches: [] },
        { id: 3, name: 'T3', branches: [] },
      ],
      loops: [],
      timeline: [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
    })
    await db.write()

    await request(app)
      .post('/api/loop/E1')
      .send({ name: 'L1', trials: [2], loopConfig: {} })
      .expect(200)

    await db.read()
    // T1's branch [2] should now include the loop id instead of 2
    const t1 = db.data.trials[0].trials.find(t => t.id === 1)
    expect(t1.branches).not.toContain(2)
    expect(t1.branches.some(b => String(b).startsWith('loop_'))).toBe(true)
  })
})

describe('GET /api/loop/:experimentID/:id', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/loop/E1/loop_1').expect(404)
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
    await request(app).get('/api/loop/E1/loop_missing').expect(404)
  })

  test('returns loop with trials metadata', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1' },
        { id: 2, name: 'T2' },
      ],
      loops: [
        { id: 'loop_1', name: 'L1', trials: [1, 2] },
      ],
      timeline: [],
    })
    await db.write()
    const res = await request(app).get('/api/loop/E1/loop_1').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.loop.trialsMetadata).toHaveLength(2)
    expect(res.body.loop.trialsMetadata[0].name).toBe('T1')
  })
})

describe('PATCH /api/loop/:experimentID/:id', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .patch('/api/loop/E1/loop_1')
      .send({ name: 'New' })
      .expect(404)
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
    await request(app)
      .patch('/api/loop/E1/loop_missing')
      .send({ name: 'New' })
      .expect(404)
  })

  test('updates loop fields', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [{ id: 'loop_1', name: 'Old', trials: [], branches: [] }],
      timeline: [{ id: 'loop_1', type: 'loop', name: 'Old', branches: [], trials: [] }],
    })
    await db.write()
    const res = await request(app)
      .patch('/api/loop/E1/loop_1')
      .send({ name: 'Renamed', branches: [1] })
      .expect(200)
    expect(res.body.loop.name).toBe('Renamed')
    expect(res.body.loop.branches).toEqual([1])
  })

  test('updates timeline when name changes', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [{ id: 'loop_1', name: 'Old', trials: [], branches: [] }],
      timeline: [{ id: 'loop_1', type: 'loop', name: 'Old', branches: [], trials: [] }],
    })
    await db.write()
    await request(app)
      .patch('/api/loop/E1/loop_1')
      .send({ name: 'NewName' })
      .expect(200)
    await db.read()
    expect(db.data.trials[0].timeline[0].name).toBe('NewName')
  })
})

describe('DELETE /api/loop/:experimentID/:id', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app).delete('/api/loop/E1/loop_1').expect(404)
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
    await request(app).delete('/api/loop/E1/loop_1').expect(404)
  })

  test('deletes loop and restores trials to timeline', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', parentLoopId: 'loop_1', branches: [] },
        { id: 2, name: 'T2', parentLoopId: 'loop_1', branches: [] },
      ],
      loops: [{ id: 'loop_1', name: 'L1', trials: [1, 2], branches: [3] }],
      timeline: [{ id: 'loop_1', type: 'loop', name: 'L1', branches: [3], trials: [1, 2] }],
    })
    await db.write()
    const res = await request(app).delete('/api/loop/E1/loop_1').expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.trials[0].loops).toHaveLength(0)
    // Trials should be restored to timeline
    expect(db.data.trials[0].timeline.some(t => t.id === 1)).toBe(true)
    expect(db.data.trials[0].timeline.some(t => t.id === 2)).toBe(true)
    // parentLoopId should be null
    expect(db.data.trials[0].trials.find(t => t.id === 1).parentLoopId).toBeNull()
  })

  test('handles empty loop (no trials)', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', branches: ['loop_1'] }],
      loops: [{ id: 'loop_1', name: 'Empty', trials: [], branches: [] }],
      timeline: [{ id: 'loop_1', type: 'loop', name: 'Empty', branches: [], trials: [] }],
    })
    await db.write()
    await request(app).delete('/api/loop/E1/loop_1').expect(200)
    await db.read()
    expect(db.data.trials[0].loops).toHaveLength(0)
  })

  test('reconnects parent branches to first trial', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'Parent', branches: ['loop_1'] },
        { id: 2, name: 'Child', parentLoopId: 'loop_1', branches: [] },
      ],
      loops: [{ id: 'loop_1', name: 'L1', trials: [2], branches: [] }],
      timeline: [
        { id: 1, type: 'trial', name: 'Parent' },
        { id: 'loop_1', type: 'loop', name: 'L1', branches: [], trials: [2] },
      ],
    })
    await db.write()
    await request(app).delete('/api/loop/E1/loop_1').expect(200)
    await db.read()
    const parent = db.data.trials[0].trials.find(t => t.id === 1)
    expect(parent.branches).toContain(2)
    expect(parent.branches).not.toContain('loop_1')
  })
})

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

  test('returns metadata including nested branches', async () => {
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
    const res = await request(app).get('/api/loop-trials-metadata/E1/loop_1').expect(200)
    expect(res.body.trialsMetadata).toBeDefined()
    // Should include T1 and T2 (branch)
    const ids = res.body.trialsMetadata.map(t => t.id)
    expect(ids).toContain(1)
    expect(ids).toContain(2)
  })
})
