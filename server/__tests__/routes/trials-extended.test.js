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
      trials: [
        { id: 1, name: 'Old', plugin: 'p', branches: [] },
        { id: 2, name: 'T2', plugin: 'p', branches: [] },
      ],
      loops: [],
      timeline: [
        { id: 1, type: 'trial', name: 'Old', branches: [] },
        { id: 2, type: 'trial', name: 'T2', branches: [] },
      ],
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

  test('moves a trial into a loop and back to the timeline', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', branches: [] }],
      loops: [{ id: 'loop_1', name: 'L1', trials: [], branches: [] }],
      timeline: [
        { id: 1, type: 'trial', name: 'T1', branches: [] },
        { id: 'loop_1', type: 'loop', name: 'L1', branches: [], trials: [] },
      ],
    })
    await db.write()

    await request(app)
      .patch('/api/trial/E1/1')
      .send({ parentLoopId: 'loop_1' })
      .expect(200)
    await db.read()
    expect(db.data.trials[0].trials.find(t => t.id === 1).parentLoopId).toBe('loop_1')
    expect(db.data.trials[0].loops.find(l => l.id === 'loop_1').trials).toEqual([1])

    await request(app)
      .patch('/api/trial/E1/1')
      .send({ parentLoopId: null })
      .expect(200)
    await db.read()
    expect(db.data.trials[0].trials.find(t => t.id === 1).parentLoopId).toBeNull()
    expect(db.data.trials[0].loops.find(l => l.id === 'loop_1').trials).toEqual([])
  })

  test('400 when moving a trial into a missing loop', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', branches: [] }],
      loops: [],
      timeline: [{ id: 1, type: 'trial', name: 'T1', branches: [] }],
    })
    await db.write()

    const res = await request(app)
      .patch('/api/trial/E1/1')
      .send({ parentLoopId: 'loop_ghost' })
      .expect(400)

    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('Loop loop_ghost not found')
    await db.read()
    expect(db.data.trials[0].trials.find(t => t.id === 1).parentLoopId ?? null).toBeNull()
  })

  test('drops deleted branch targets instead of persisting an invalid graph', async () => {
    const { app, db } = await freshApp()
    const ghost = 1788987326502
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [ghost] },
        { id: 2, name: 'T2', branches: [] },
      ],
      loops: [],
      timeline: [
        { id: 1, type: 'trial', name: 'T1', branches: [ghost] },
        { id: 2, type: 'trial', name: 'T2', branches: [] },
      ],
    })
    await db.write()

    const res = await request(app)
      .patch('/api/trial/E1/1')
      .send({ branches: [2, ghost] })
      .expect(200)

    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.trials[0].trials.find(t => t.id === 1).branches).toEqual([2])
    expect(res.body.graph.diagnostics.map(d => d.code)).not.toContain('BRANCH_TARGET_NOT_FOUND')
  })

  test('drops condition entries whose target no longer exists', async () => {
    const { app, db } = await freshApp()
    const ghost = 1788987326502
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        {
          id: 1,
          name: 'T1',
          branches: [],
          branchConditions: [
            { id: 'c1', rules: [], nextTrialId: 2 },
            { id: 'c2', rules: [], nextTrialId: ghost },
            { id: 'c3', rules: [], nextTrialId: null },
          ],
          repeatConditions: [
            { id: 'r1', rules: [], jumpToTrialId: ghost },
          ],
        },
        { id: 2, name: 'T2', branches: [] },
      ],
      loops: [],
      timeline: [
        { id: 1, type: 'trial', name: 'T1', branches: [] },
        { id: 2, type: 'trial', name: 'T2', branches: [] },
      ],
    })
    await db.write()

    const res = await request(app)
      .patch('/api/trial/E1/1')
      .send({
        branchConditions: [
          { id: 'c1', rules: [], nextTrialId: 2 },
          { id: 'c2', rules: [], nextTrialId: ghost },
          { id: 'c3', rules: [], nextTrialId: null },
        ],
        repeatConditions: [{ id: 'r1', rules: [], jumpToTrialId: ghost }],
      })
      .expect(200)

    expect(res.body.success).toBe(true)
    await db.read()
    const t1 = db.data.trials[0].trials.find(t => t.id === 1)
    expect(t1.branchConditions.map(c => c.id)).toEqual(['c1', 'c3'])
    expect(t1.repeatConditions).toEqual([])
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

  test('does not inherit dangling branch targets from the deleted trial', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'Parent', branches: [2] },
        { id: 2, name: 'ToDelete', branches: ['ghost'] },
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
    const parent = db.data.trials[0].trials.find(t => t.id === 1)
    expect(parent.branches).toEqual([])
    expect(res.body.graph.diagnostics.map(d => d.code)).not.toContain('BRANCH_TARGET_NOT_FOUND')
  })

  test('prunes pre-existing dangling branch targets on delete', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'A', branches: [999] },
        { id: 2, name: 'B', branches: [] },
      ],
      loops: [{ id: 'loop_1', name: 'L1', trials: [], branches: [999] }],
      timeline: [
        { id: 1, type: 'trial', name: 'A' },
        { id: 2, type: 'trial', name: 'B' },
      ],
    })
    await db.write()
    const res = await request(app).delete('/api/trial/E1/2').expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.trials[0].trials.find(t => t.id === 1).branches).toEqual([])
    expect(db.data.trials[0].loops[0].branches).toEqual([])
    expect(res.body.graph.diagnostics.map(d => d.code)).not.toContain('BRANCH_TARGET_NOT_FOUND')
  })

  test('prunes condition targets pointing at the deleted trial', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        {
          id: 1,
          name: 'A',
          branches: [2],
          branchConditions: [
            { id: 'c1', rules: [], nextTrialId: 2 },
            { id: 'c2', rules: [], nextTrialId: 3 },
          ],
          repeatConditions: [{ id: 'r1', rules: [], jumpToTrialId: 2 }],
        },
        { id: 2, name: 'ToDelete', branches: [] },
        { id: 3, name: 'C', branches: [] },
      ],
      loops: [
        {
          id: 'loop_1',
          name: 'L1',
          trials: [],
          branches: [],
          branchConditions: [{ id: 'lc1', rules: [], nextTrialId: 2 }],
        },
      ],
      timeline: [
        { id: 1, type: 'trial', name: 'A' },
        { id: 2, type: 'trial', name: 'ToDelete' },
        { id: 3, type: 'trial', name: 'C' },
      ],
    })
    await db.write()
    const res = await request(app).delete('/api/trial/E1/2').expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    const doc = db.data.trials[0]
    expect(doc.trials.find(t => t.id === 1).branchConditions.map(c => c.id)).toEqual(['c2'])
    expect(doc.trials.find(t => t.id === 1).repeatConditions).toEqual([])
    expect(doc.loops.find(l => l.id === 'loop_1').branchConditions).toEqual([])
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
