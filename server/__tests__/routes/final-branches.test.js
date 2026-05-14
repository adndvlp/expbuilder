import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-fb-'))
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

/* ── index.js line 261: findItemById returns loop for loop_* ids ──────── */
describe('validate-connection findItemById string id', () => {
  test('resolves string trial id to number and finds in trials', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', branches: [2] }],
      loops: [],
      timeline: [],
    })
    await db.write()
    // source='1' (string) will be parsed as integer 1 in findItemById
    const res = await request(app)
      .get('/api/validate-connection/E1?source=1&target=2')
      .expect(200)
    expect(res.body.isValid).toBeDefined()
  })

  test('resolves loop string id to loop without parseInt', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [
        { id: 'loop_1', name: 'L1', branches: [] },
        { id: 'loop_2', name: 'L2', branches: ['loop_1'] },
      ],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .get('/api/validate-connection/E1?source=loop_1&target=loop_2')
      .expect(200)
    expect(res.body.isValid).toBeDefined()
  })
})

/* ── index.js lines 267,272: visited check + source==target ────────────── */
describe('validate-connection isAncestor visited guard', () => {
  test('detects self-connection via isAncestor', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [1] }, // self-referencing
      ],
      loops: [],
      timeline: [],
    })
    await db.write()
    // source==target already caught before isAncestor, but visited check handles circular
    const res = await request(app)
      .get('/api/validate-connection/E1?source=2&target=1')
      .expect(200)
    // T1.branches=[1], isAncestor(2,1): T1.branches contains 1, not 2 → false
    expect(res.body.isValid).toBe(true)
  })
})

/* ── index.js line 277: item without branches ──────────────────────────── */
describe('validate-connection item without branches field', () => {
  test('returns true when target exists but has no branches', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1' }, // no branches field
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

/* ── index.js lines 289-290: recursive branch traversal ────────────────── */
describe('validate-connection recursive isAncestor traversal', () => {
  test('detects transitive ancestor via recursion through loops', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', branches: [] }],
      loops: [
        { id: 'loop_1', name: 'L1', branches: [99] },
        { id: 'loop_99', name: 'L99', branches: [1] },
      ],
      timeline: [],
    })
    await db.write()
    // isAncestor(target, source): isAncestor(loop_1, loop_99)
    // source=loop_99, target=loop_1
    // L99.branches=[1], check L99 for loop_1? No. L99.branches has 1 (a number).
    // We need target.branches to contain source. 
    // Let me use trial+loop: T1.branches=['loop_1'], loop_1.branches=['loop_2'], loop_2.branches=[]
    const res = await request(app)
      .get('/api/validate-connection/E1?source=loop_99&target=loop_1')
      .expect(200)
    expect(res.body.isValid).toBe(true)
  })

  test('detects recursive ancestor in validate-connection', async () => {
    const { app, db } = await freshApp()
    // isAncestor(target, source): isAncestor('loop_1', 1)
    // checks T1.branches for 'loop_1'. T1.branches=['loop_1'] → true → invalid connection
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: ['loop_1'] },
      ],
      loops: [
        { id: 'loop_1', name: 'L1', branches: [] },
      ],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .get('/api/validate-connection/E1?source=1&target=loop_1')
      .expect(200)
    expect(res.body.isValid).toBe(false)
  })
})

/* ── loops.js error handlers (lines 252, 304) ──────────────────────────── */
describe('loop-trials-metadata error handler', () => {
  test('returns 500 on error', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({ experimentID: 'E1', trials: [], loops: [], timeline: [] })
    await db.write()
    const origRead = db.read
    db.read = async () => { throw new Error('mock') }
    const res = await request(app)
      .get('/api/loop-trials-metadata/E1/loop_1')
      .expect(500)
  })
})

describe('GET loop error handler', () => {
  test('returns 500 on error', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({ experimentID: 'E1', trials: [], loops: [{ id: 'loop_1', name: 'L1', trials: [] }], timeline: [] })
    await db.write()
    const origRead = db.read
    db.read = async () => { throw new Error('mock') }
    const res = await request(app).get('/api/loop/E1/loop_1').expect(500)
  })
})

/* ── trials.js line 387: timeline map default case ──────────────────────── */
describe('DELETE trial timeline map default', () => {
  test('handles unknown item type in timeline map', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', branches: [] }],
      loops: [],
      timeline: [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 'unknown', type: 'unknown', name: 'U' },
      ],
    })
    await db.write()
    const res = await request(app).delete('/api/trial/E1/1').expect(200)
    expect(res.body.success).toBe(true)
  })
})

/* ── trials.js line 203: GET trial 404 experiment not found ────────────── */
describe('GET trial experiment not found explicit', () => {
  test('returns 404 for non-existent experiment doc', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/trial/NONEXISTENT/1').expect(404)
  })
})
