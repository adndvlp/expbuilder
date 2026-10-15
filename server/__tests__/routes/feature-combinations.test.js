import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

/**
 * Feature-combination matrix (editor API surface).
 *
 * Each scenario combines several features at once — branches, branch
 * conditions with customParameters (params override on branches),
 * moves and deletes — and asserts the whole flow stays consistent:
 * every mutation succeeds and the resulting experiment graph is valid
 * (no BRANCH_TARGET_NOT_FOUND or sibling diagnostics).
 */
const GHOST = 1788987326502

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-combo-'))
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

const expectValidGraph = (res) => {
  expect(res.body.success).toBe(true)
  const codes = (res.body.graph?.diagnostics ?? []).map((d) => d.code)
  expect(codes).toEqual([])
}

// Root trials 1→2 plus a two-level loop nest holding trial 4.
const seedNested = async (db) => {
  db.data.trials.push({ entryItemId: 1,
    experimentID: 'E1',
    trials: [
      { defaultNextTrialId: null, branchConditions: [], id: 1, name: 'Root', branches: [] },
      { defaultNextTrialId: null, branchConditions: [], id: 2, name: 'Landing', branches: [] },
      { defaultNextTrialId: null, branchConditions: [], id: 3, name: 'Inner', parentLoopId: 'inner', branches: [] },
      { defaultNextTrialId: null, branchConditions: [], id: 4, name: 'Deep', parentLoopId: 'inner', branches: [] },
    ],
    loops: [
      { nextItemId: null, entryItemId: 'inner', id: 'outer', name: 'Outer', trials: ['inner'], },
      { nextItemId: null, entryItemId: 3,
        id: 'inner',
        name: 'Inner',
        parentLoopId: 'outer',
        trials: [3, 4],

      },
    ],
    timeline: [
      { id: 1, type: 'trial', name: 'Root', branches: [] },
      { id: 2, type: 'trial', name: 'Landing', branches: [] },
      { id: 'outer', type: 'loop', name: 'Outer',  trials: ['inner'] },
    ],
  })
  await db.write()
}

describe('branch condition with params override into a nested loop', () => {
  test('root trial exits to a nested trial carrying customParameters', async () => {
    const { app, db } = await freshApp()
    await seedNested(db)

    const res = await request(app)
      .patch('/api/trial/E1/1')
      .send({
        branches: [4],
        branchConditions: [
          {
            id: 'c1',
            rules: [{ column: 'response', op: '==', value: 'go' }],
            nextTrialId: 4,
            customParameters: {
              stimulus: { source: 'typed', value: 'nested.png' },
            },
          },
        ],
      })
      .expect(200)
    expectValidGraph(res)

    await db.read()
    const t1 = db.data.trials[0].trials.find((t) => t.id === 1)
    expect(t1.branches).toEqual([4])
    expect(t1.branchConditions[0].customParameters).toEqual({
      stimulus: { source: 'typed', value: 'nested.png' },
    })
    expect(res.body.graph.edges).toContainEqual(
      expect.objectContaining({ sourceId: 1, targetId: 4 }),
    )
  })
})

describe('branch from inside a loop to the root timeline', () => {
  test('uses the same trial condition and parameters across scopes', async () => {
    const { app, db } = await freshApp();
    await seedNested(db);
    const condition = { id: 'r1', rules: [], nextTrialId: 2, customParameters: { stimulus: { source: 'typed', value: 'root' } } };
    const response = await request(app).patch('/api/trial/E1/3').send({ branches: [2], branchConditions: [condition], defaultNextTrialId: null }).expect(200);
    expectValidGraph(response);
    expect(response.body.trial.branchConditions).toEqual([condition]);
  });
});

describe('conditional loop with trial branching', () => {
  test('loop conditions coexist with branch conditions on the child trial', async () => {
    const { app, db } = await freshApp()
    await seedNested(db)

    const res = await request(app)
      .patch('/api/loop/E1/inner')
      .send({
        isConditionalLoop: true,
        loopConditions: [{ id: 'lc1', rules: [] }],
      })
      .expect(200)
    expectValidGraph(res)

    const trialResponse = await request(app)
      .patch('/api/trial/E1/4')
      .send({ branches: [2], branchConditions: [{ id: 'c1', rules: [], nextTrialId: 2 }] })
      .expect(200)
    expectValidGraph(trialResponse)

    await db.read()
    const loop = db.data.trials[0].loops.find((l) => l.id === 'inner')
    expect(loop.isConditionalLoop).toBe(true)
    expect(loop.loopConditions).toEqual([{ id: 'lc1', rules: [] }])
    expect(loop).not.toHaveProperty('branches')
    expect(loop).not.toHaveProperty('branchConditions')
    expect(db.data.trials[0].trials.find(t => t.id === 4).branchConditions.map(c => c.id)).toEqual(['c1'])
  })
})

describe('move a fully conditioned trial into a nested loop', () => {
  test('conditions and params survive the move with a valid graph', async () => {
    const { app, db } = await freshApp()
    await seedNested(db)
    await request(app)
      .patch('/api/trial/E1/1')
      .send({
        branches: [2],
        branchConditions: [
          {
            id: 'c1',
            rules: [],
            nextTrialId: 2,
            customParameters: { stimulus: { source: 'typed', value: 'x.png' } },
          },
        ],
      })
      .expect(200)

    const res = await request(app)
      .patch('/api/trial/E1/1')
      .send({ parentLoopId: 'inner' })
      .expect(200)
    expectValidGraph(res)

    await db.read()
    const doc = db.data.trials[0]
    const t1 = doc.trials.find((t) => t.id === 1)
    expect(t1.parentLoopId).toBe('inner')
    expect(doc.loops.find((l) => l.id === 'inner').trials).toContain(1)
    expect(t1.branchConditions).toHaveLength(1)
    expect(t1.branchConditions[0].customParameters).toEqual({
      stimulus: { source: 'typed', value: 'x.png' },
    })
    expect(res.body.graph.edges).toContainEqual(
      expect.objectContaining({ sourceId: 1, targetId: 2 }),
    )
  })
})

describe('move a condition target into a loop', () => {
  test('source condition keeps resolving after its target moves scopes', async () => {
    const { app, db } = await freshApp()
    await seedNested(db)
    await request(app)
      .patch('/api/trial/E1/1')
      .send({
        branches: [2],
        branchConditions: [{ id: 'c1', rules: [], nextTrialId: 2 }],
      })
      .expect(200)

    const res = await request(app)
      .patch('/api/trial/E1/2')
      .send({ parentLoopId: 'inner' })
      .expect(200)
    expectValidGraph(res)
    expect(res.body.graph.edges).toContainEqual(
      expect.objectContaining({ sourceId: 1, targetId: 2 }),
    )
  })
})

describe('group a conditioned trial into a new loop', () => {
  test('loop creation preserves conditions and params', async () => {
    const { app, db } = await freshApp()
    await seedNested(db)
    await request(app)
      .patch('/api/trial/E1/1')
      .send({
        branches: [2],
        branchConditions: [
          {
            id: 'c1',
            rules: [],
            nextTrialId: 2,
            customParameters: { stimulus: { source: 'typed', value: 'x.png' } },
          },
        ],
      })
      .expect(200)

    const res = await request(app)
      .post('/api/loop/E1')
      .send({ name: 'Grouped', trials: [1] })
      .expect(200)
    expectValidGraph(res)

    await db.read()
    const t1 = db.data.trials[0].trials.find((t) => t.id === 1)
    expect(t1.branchConditions).toHaveLength(1)
    expect(t1.branchConditions[0].customParameters).toEqual({
      stimulus: { source: 'typed', value: 'x.png' },
    })
  })
})

describe('delete a loop holding condition targets', () => {
  test('ungrouping retains valid conditional destinations', async () => {
    const { app, db } = await freshApp()
    await seedNested(db)
    await request(app)
      .patch('/api/trial/E1/1')
      .send({
        branches: [4],
        branchConditions: [
          { id: 'c1', rules: [], nextTrialId: 4 },
        ],
      })
      .expect(200)

    // Deleting the outer nest restores `inner` (with trials 3, 4) instead of
    // removing it, so live conditions keep resolving while the legacy ghost
    // entries are healed by the delete.
    const del = await request(app).delete('/api/loop/E1/outer').expect(200)
    expect(del.body.success).toBe(true)

    await db.read()
    const doc = db.data.trials[0]
    expect(doc.loops.map((l) => l.id)).toEqual(['inner'])
    expect(doc.loops[0].parentLoopId).toBeNull()
    const t1 = doc.trials.find((t) => t.id === 1)
    expect(t1.branchConditions.map((c) => c.id)).toEqual(['c1'])

    const graph = await request(app).get('/api/experiment-graph/E1').expect(200)
    expect(
      graph.body.graph.diagnostics.map((d) => d.code),
    ).not.toContain('BRANCH_TARGET_NOT_FOUND')
  })
})

describe('nested loop exit with params via loop-branch command', () => {
  test('sequential exit from the inner loop to root carries a valid edge', async () => {
    const { app, db } = await freshApp()
    await seedNested(db)

    const res = await request(app)
      .post('/api/loop-branch/E1')
      .set('Idempotency-Key', 'combo-sequential-exit')
      .send({ sourceTrialId: 3, targetScopeId: null, mode: 'sequential' })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.graph.edges).toContainEqual(
      expect.objectContaining({
        sourceId: 3,
        targetId: res.body.trial.id,
        exitedLoopIds: ['inner', 'outer'],
      }),
    )

    // ...and the fresh exit trial accepts params-override conditions.
    const followUp = await request(app)
      .patch(`/api/trial/E1/${res.body.trial.id}`)
      .send({
        branches: [2],
        branchConditions: [
          {
            id: 'c1',
            rules: [],
            nextTrialId: 2,
            customParameters: { stimulus: { source: 'typed', value: 'y.png' } },
          },
        ],
      })
      .expect(200)
    expectValidGraph(followUp)
  })
})

describe('ghost combination: every feature ignores the same legacy ghost', () => {
  test('rejects a missing destination before changing the experiment', async () => {
 const { app, db } = await freshApp(); await seedNested(db);
 const before = JSON.stringify(db.data);
 await request(app).patch('/api/trial/E1/3').send({ branches: [4, GHOST], branchConditions: [{ id: 'c1', rules: [], nextTrialId: GHOST }] }).expect(400);
 await db.read(); expect(JSON.stringify(db.data)).toBe(before);
})
})
