import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-tli-'))
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

describe('GET /api/timeline-code/:experimentID', () => {
  test('returns empty codes when no doc', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/timeline-code/E1').expect(200)
    expect(res.body).toEqual({ codes: [] })
  })

  test('returns trial and loop codes', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', trialCode: 'code1' },
        { id: 2, name: 'T2' },
      ],
      loops: [
        { id: 'loop_1', name: 'L1', code: 'loopCode1' },
      ],
      timeline: [],
    })
    await db.write()
    const res = await request(app).get('/api/timeline-code/E1').expect(200)
    expect(res.body.codes).toHaveLength(2)
    expect(res.body.codes).toContain('code1')
    expect(res.body.codes).toContain('loopCode1')
  })
})

describe('PATCH /api/timeline/:experimentID', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .patch('/api/timeline/E1')
      .send({ timeline: [] })
      .expect(404)
  })

  test('updates timeline order', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [],
      timeline: [{ id: 1, type: 'trial' }],
    })
    await db.write()
    const res = await request(app)
      .patch('/api/timeline/E1')
      .send({ timeline: [{ id: 2, type: 'trial' }, { id: 1, type: 'trial' }] })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.timeline).toHaveLength(2)
  })
})

describe('GET /api/timeline-names/:experimentID', () => {
  test('returns empty names when no doc', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/timeline-names/E1').expect(200)
    expect(res.body).toEqual({ names: [] })
  })

  test('returns all trial names plus loop inner trial names', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'TopTrial' },
        { id: 2, name: 'InnerTrial' },
        { id: 3, name: 'Orphan' },
      ],
      loops: [
        { id: 'loop_1', name: 'L1', trials: [2] },
      ],
      timeline: [],
    })
    await db.write()
    const res = await request(app).get('/api/timeline-names/E1').expect(200)
    // All trials (TopTrial, InnerTrial, Orphan) + loop trial names (InnerTrial again)
    expect(res.body.names).toContain('TopTrial')
    expect(res.body.names).toContain('InnerTrial')
    expect(res.body.names).toContain('Orphan')
  })
})

describe('GET /api/validate-ancestor/:experimentID', () => {
  test('returns isAncestor false when no doc', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .get('/api/validate-ancestor/E1?source=1&target=2')
      .expect(200)
    expect(res.body).toEqual({ isAncestor: false })
  })

  test('detects when target branches directly to source', async () => {
    const { app, db } = await freshApp()
    // isAncestor(source, target) returns true when source is in target's branches
    // i.e., T2.branches = [1] means T2 → T1
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
        { id: 2, name: 'T2', branches: [1] },
      ],
      loops: [],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .get('/api/validate-ancestor/E1?source=1&target=2')
      .expect(200)
    expect(res.body.isAncestor).toBe(true)
  })

  test('detects transitive reachability through branches', async () => {
    const { app, db } = await freshApp()
    // T2 → T3 → T1, so source=1 is reachable from target=2
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
        { id: 2, name: 'T2', branches: [3] },
        { id: 3, name: 'T3', branches: [1] },
      ],
      loops: [],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .get('/api/validate-ancestor/E1?source=1&target=2')
      .expect(200)
    expect(res.body.isAncestor).toBe(true)
  })

  test('returns false when no branch path exists', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
        { id: 2, name: 'T2', branches: [] },
      ],
      loops: [],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .get('/api/validate-ancestor/E1?source=1&target=2')
      .expect(200)
    expect(res.body.isAncestor).toBe(false)
  })

  test('checks loops too', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
      ],
      loops: [
        { id: 'loop_1', name: 'L1', branches: [1] },
      ],
      timeline: [],
    })
    await db.write()
    // source (1) is in loop_1's branches
    const res = await request(app)
      .get('/api/validate-ancestor/E1?source=1&target=loop_1')
      .expect(200)
    expect(res.body.isAncestor).toBe(true)
  })
})

describe('GET /api/validate-connection/:experimentID', () => {
  test('self-connection is invalid', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .get('/api/validate-connection/E1?source=1&target=1')
      .expect(200)
    expect(res.body.isValid).toBe(false)
    expect(res.body.errorMessage).toContain('itself')
  })

  test('returns true when no experiment doc', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .get('/api/validate-connection/E1?source=1&target=2')
      .expect(200)
    expect(res.body.isValid).toBe(true)
  })

  test('detects invalid connection when target already branches to source', async () => {
    const { app, db } = await freshApp()
    // T1.branches=[2] means T1 → T2
    // Trying source=1, target=2: isAncestor(target=2, source=1)
    // T1.branches=[2] includes 2? No, target is 2 (T2), source is 1 (T1)
    // isAncestor(2, 1): T1.branches includes 2 → true
    // So connection 1→2 is invalid (target=2 is downstream from source=1 via T1.branches)
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [2] },
        { id: 2, name: 'T2', branches: [] },
      ],
      loops: [],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .get('/api/validate-connection/E1?source=1&target=2')
      .expect(200)
    expect(res.body.isValid).toBe(false)
  })

  test('valid connection when no ancestor relationship', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
        { id: 2, name: 'T2', branches: [] },
      ],
      loops: [],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .get('/api/validate-connection/E1?source=1&target=2')
      .expect(200)
    expect(res.body.isValid).toBe(true)
  })
})
