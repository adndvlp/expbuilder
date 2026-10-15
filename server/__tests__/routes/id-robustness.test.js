import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

/**
 * Adversarial ID-robustness matrix (editor API surface).
 *
 * Every timeline mutation endpoint is exercised against:
 *  - ghost ids (references to already-deleted items, common in legacy DBs),
 *  - mixed string/number id types (after JSON round-trips through the
 *    bundled app, storage, or React Flow).
 *
 * Contract under test: no endpoint may fail with 500 `Item <id> not found`
 * (or a false 404) on stale/mixed input. Unknown ids are ignored (and pruned
 * where branches are involved); unknown scopes fail with a clear 400.
 */
const GHOST = 1788987326502

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-id-robust-'))
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

// Trial "3" is intentionally stored as a string while the rest are numeric;
// loop_2 carries a legacy ghost branch.
const seedMatrix = async (db) => {
  db.data.trials.push({ entryItemId: 1,
    experimentID: 'E1',
    trials: [
      { defaultNextTrialId: null, branchConditions: [], id: 1, name: 'T1', branches: [2] },
      { defaultNextTrialId: null, branchConditions: [], id: 2, name: 'T2', branches: [] },
      { defaultNextTrialId: null, branchConditions: [], id: '3', name: 'T3-string-id', branches: [] },
      { defaultNextTrialId: null, branchConditions: [], id: 4, name: 'T4-in-loop', parentLoopId: 'loop_1', branches: [] },
    ],
    loops: [
      { nextItemId: null, entryItemId: 4, id: 'loop_1', name: 'L1', trials: [4] },
      { nextItemId: null, entryItemId: null, id: 'loop_2', name: 'L2', trials: [] },
    ],
    timeline: [
      { id: 1, type: 'trial', name: 'T1', branches: [2] },
      { id: 2, type: 'trial', name: 'T2', branches: [] },
      { id: '3', type: 'trial', name: 'T3-string-id', branches: [] },
      { id: 'loop_1', type: 'loop', name: 'L1', trials: [4] },
      { id: 'loop_2', type: 'loop', name: 'L2', trials: [] },
    ],
  })
  await db.write()
}

describe('POST /api/loop/:experimentID', () => {
  test('ignores ghost child ids instead of 500ing', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    const res = await request(app)
      .post('/api/loop/E1')
      .send({ name: 'L', trials: [1, GHOST] })
      .expect(200)
    expect(res.body.loop.trials).toEqual([1])
  })

  test('groups stringified numeric ids', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    const res = await request(app)
      .post('/api/loop/E1')
      .send({ name: 'L', trials: ['1', '3'] })
      .expect(200)
    expect(res.body.loop.trials).toHaveLength(2)
  })

  test('400 on ghost parentLoopId, 200 on nested create', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    await request(app)
      .post('/api/loop/E1')
      .send({ name: 'Nested', trials: [], parentLoopId: 'loop_ghost' })
      .expect(400)
    const res = await request(app)
      .post('/api/loop/E1')
      .send({ name: 'Nested', trials: [], parentLoopId: 'loop_1' })
      .expect(200)
    expect(res.body.loop.parentLoopId).toBe('loop_1')
  })
})

describe('POST /api/trial/:experimentID', () => {
  test('400 on ghost parentLoopId, 200 inside a loop', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    await request(app)
      .post('/api/trial/E1')
      .send({ name: 'T', parentLoopId: 'loop_ghost' })
      .expect(400)
    await request(app)
      .post('/api/trial/E1')
      .send({ name: 'T', parentLoopId: 'loop_1' })
      .expect(200)
  })
})

describe('PATCH /api/trial/:experimentID/:id', () => {
  test('400 moving into a ghost loop; 200 moving in and back out', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    await request(app)
      .patch('/api/trial/E1/1')
      .send({ parentLoopId: 'loop_ghost' })
      .expect(400)
    await request(app)
      .patch('/api/trial/E1/1')
      .send({ parentLoopId: 'loop_1' })
      .expect(200)
    await request(app)
      .patch('/api/trial/E1/1')
      .send({ parentLoopId: null })
      .expect(200)
  })

  test('rejects a missing destination before changing the experiment', async () => {
 const { app, db } = await freshApp(); await seedMatrix(db);
 const before = JSON.stringify(db.data);
 await request(app).patch('/api/trial/E1/1').send({ branches: [2, GHOST] }).expect(400);
 await db.read(); expect(JSON.stringify(db.data)).toBe(before);
})

  test('finds trials stored with string ids', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    const res = await request(app)
      .patch('/api/trial/E1/3')
      .send({ name: 'Renamed' })
      .expect(200)
    expect(res.body.trial.name).toBe('Renamed')
  })
})

describe('GET/DELETE /api/trial/:experimentID/:id with string-stored ids', () => {
  test('GET resolves, DELETE removes', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    await request(app).get('/api/trial/E1/3').expect(200)
    await request(app).delete('/api/trial/E1/3').expect(200)
    await db.read()
    expect(db.data.trials[0].trials.some((t) => String(t.id) === '3')).toBe(false)
  })
})

describe('PATCH /api/loop/:experimentID/:id', () => {
  test('400 moving a loop under a ghost parent; 200 reparenting nested loops', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    const bad = await request(app)
      .patch('/api/loop/E1/loop_2')
      .send({ parentLoopId: 'loop_ghost' })
      .expect(400)
    expect(bad.body.error).toBe('Loop loop_ghost not found')
    await request(app)
      .patch('/api/loop/E1/loop_2')
      .send({ parentLoopId: 'loop_1' })
      .expect(200)
    await db.read()
    expect(db.data.trials[0].loops.find((l) => l.id === 'loop_2').parentLoopId).toBe('loop_1')
  })

  test('ignores ghost member ids without adding loop branching', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    const res = await request(app)
      .patch('/api/loop/E1/loop_1')
      .send({
        trials: [4, GHOST],
      })
      .expect(200)
    expect(res.body.loop.trials).toEqual([4])
    expect(res.body.loop).not.toHaveProperty('branches')
    expect(res.body.loop).not.toHaveProperty('branchConditions')
  })
})

describe('DELETE /api/loop/:experimentID/:id', () => {
  test('deletes loops holding ghost trials/branches', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    const res = await request(app).delete('/api/loop/E1/loop_2').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.graph.diagnostics.map((d) => d.code)).not.toContain(
      'BRANCH_TARGET_NOT_FOUND',
    )
  })
})

describe('DELETE /api/trial/:experimentID/:id', () => {
  test('prunes branches and condition targets of the deleted trial', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    await request(app)
      .patch('/api/trial/E1/1')
      .send({
        branchConditions: [{ id: 'c1', rules: [], nextTrialId: 2 }],
      })
      .expect(200)
    const res = await request(app).delete('/api/trial/E1/2').expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    const doc = db.data.trials[0]
    expect(doc.trials.find((t) => t.id === 1).branchConditions).toEqual([])
    expect(
      res.body.graph.diagnostics.map((d) => d.code),
    ).not.toContain('BRANCH_TARGET_NOT_FOUND')
  })
})

describe('POST /api/loop-branch/:experimentID', () => {
  test('creates branches inside loops despite unrelated legacy ghosts', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    const res = await request(app)
      .post('/api/loop-branch/E1')
      .set('Idempotency-Key', 'matrix-parallel')
      .send({ sourceTrialId: 4, targetScopeId: null, mode: 'parallel' })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(
      res.body.graph.diagnostics.map((d) => d.code),
    ).not.toContain('BRANCH_TARGET_NOT_FOUND')
  })
})

describe('PATCH /api/timeline/:experimentID', () => {
  test('stores timelines without 500ing the graph snapshot', async () => {
    const { app, db } = await freshApp()
    await seedMatrix(db)
    const res = await request(app)
      .patch('/api/timeline/E1')
      .send({
        timeline: [{ id: 2, type: 'trial', name: 'T2', branches: [] }],
      })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.graph.root.items.map((item) => item.id)).toEqual([2])
  })
})
