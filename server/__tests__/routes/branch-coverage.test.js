import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-brc-'))
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

/* ── trials.js: lines 45-46 (loop items in trials-metadata) ────────────── */
describe('trials-metadata with loops in timeline', () => {
  test('returns trials field for loop items', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', branches: [] }],
      loops: [{ id: 'loop_1', name: 'L1', branches: [], trials: [1] }],
      timeline: [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 'loop_1', type: 'loop', name: 'L1' },
      ],
    })
    await db.write()
    const res = await request(app).get('/api/trials-metadata/E1').expect(200)
    expect(res.body.timeline).toHaveLength(2)
    expect(res.body.timeline[1].type).toBe('loop')
    expect(res.body.timeline[1].trials).toEqual([1])
  })
})

/* ── trials.js: lines 343-352 (delete trial reconnects loop branches) ──── */
describe('DELETE trial reconnects loop branches', () => {
  test('replaces deleted trial in loop branches with its children', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
        { id: 2, name: 'T2', branches: [3] },
        { id: 3, name: 'T3', branches: [] },
      ],
      loops: [
        { id: 'loop_1', name: 'L1', branches: [2], trials: [] },
      ],
      timeline: [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
        { id: 3, type: 'trial', name: 'T3' },
      ],
    })
    await db.write()
    await request(app).delete('/api/trial/E1/2').expect(200)
    await db.read()
    const loop = db.data.trials[0].loops.find(l => l.id === 'loop_1')
    expect(loop.branches).not.toContain(2)
    expect(loop.branches).toContain(3)
  })
})

/* ── trials.js: lines 379-387 (timeline loop items branches update) ────── */
describe('DELETE trial updates timeline loop items', () => {
  test('syncs loop timeline branches after trial delete', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
        { id: 2, name: 'T2', branches: [] },
      ],
      loops: [
        { id: 'loop_1', name: 'L1', branches: [1], trials: [] },
      ],
      timeline: [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 'loop_1', type: 'loop', name: 'L1' },
      ],
    })
    await db.write()
    await request(app).delete('/api/trial/E1/1').expect(200)
    await db.read()
    const tlLoop = db.data.trials[0].timeline.find(t => t.id === 'loop_1')
    expect(tlLoop.branches).toEqual([])
  })
})

/* ── loops.js: lines 105-117 (other loops referencing looped trials) ───── */
describe('POST loop updates other loops branches', () => {
  test('other loops that branch to a trial inside the new loop get branch replaced', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
        { id: 2, name: 'T2', branches: [] },
      ],
      loops: [
        { id: 'loop_existing', name: 'LE', branches: [1], trials: [] },
      ],
      timeline: [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
    })
    await db.write()
    await request(app)
      .post('/api/loop/E1')
      .send({ name: 'LNEW', trials: [1], loopConfig: {} })
      .expect(200)
    await db.read()
    const le = db.data.trials[0].loops.find(l => l.id === 'loop_existing')
    expect(le.branches).not.toContain(1)
    expect(le.branches.some(b => String(b).startsWith('loop_'))).toBe(true)
  })
})

/* ── loops.js: POST loop error (line 143) ──────────────────────────────── */
describe('POST loop error handling', () => {
  test('returns 500 on error', async () => {
    const { app, db } = await freshApp()
    // Corrupt write to trigger error
    const origWrite = db.write
    db.write = async () => { throw new Error('mock error') }
    const res = await request(app)
      .post('/api/loop/E1')
      .send({ name: 'L1', trials: [], loopConfig: {} })
      .expect(500)
    expect(res.body.error).toBeDefined()
  })
})

/* ── loops.js: nested loop metadata (lines 203-205, 233-244) ──────────── */
describe('loop-trials-metadata with nested loops', () => {
  test('includes nested loop in metadata when referenced', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [
        { id: 'loop_1', name: 'L1', trials: ['loop_nested'], branches: [] },
        { id: 'loop_nested', name: 'Nested', trials: [], branches: [99] },
      ],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .get('/api/loop-trials-metadata/E1/loop_1')
      .expect(200)
    const types = res.body.trialsMetadata.map(t => t.type)
    expect(types).toContain('loop')
  })
})

/* ── loops.js: PATCH loop with trials change (lines 368-374) ───────────── */
describe('PATCH loop updates timeline when trials change', () => {
  test('removes added trials from top-level timeline', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
        { id: 2, name: 'T2', branches: [] },
        { id: 3, name: 'T3', branches: [] },
      ],
      loops: [{ id: 'loop_1', name: 'L1', trials: [1], branches: [] }],
      timeline: [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 3, type: 'trial', name: 'T3' },
        { id: 'loop_1', type: 'loop', name: 'L1', branches: [], trials: [1] },
      ],
    })
    await db.write()
    // Add trial 3 to the loop
    await request(app)
      .patch('/api/loop/E1/loop_1')
      .send({ trials: [1, 3] })
      .expect(200)
    await db.read()
    const timeline = db.data.trials[0].timeline
    // Trial 3 should be removed from top-level since it's now inside the loop
    expect(timeline.filter(t => t.id === 3 && t.type === 'trial')).toHaveLength(0)
    const loopItem = timeline.find(t => t.id === 'loop_1')
    expect(loopItem.trials).toEqual([1, 3])
  })
})

/* ── loops.js: PATCH loop with name change on timeline (line 360-361) ─── */
describe('PATCH loop updates timeline name', () => {
  test('syncs loop name to timeline entry', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [{ id: 'loop_1', name: 'OldName', trials: [], branches: [] }],
      timeline: [{ id: 'loop_1', type: 'loop', name: 'OldName', branches: [], trials: [] }],
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

/* ── loops.js: PATCH loop error (line 386) ─────────────────────────────── */
describe('PATCH loop error handling', () => {
  test('returns 500 on error', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [{ id: 'loop_1', name: 'L1', trials: [], branches: [] }],
      timeline: [],
    })
    await db.write()
    const origWrite = db.write
    db.write = async () => { throw new Error('mock') }
    const res = await request(app)
      .patch('/api/loop/E1/loop_1')
      .send({ name: 'X' })
      .expect(500)
    expect(res.body.error).toBeDefined()
  })
})

/* ── loops.js: DELETE loop error (line 606) ────────────────────────────── */
describe('DELETE loop error handling', () => {
  test('returns 500 on error', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [{ id: 'loop_1', name: 'L1', trials: [], branches: [] }],
      timeline: [{ id: 'loop_1', type: 'loop', name: 'L1', branches: [], trials: [] }],
    })
    await db.write()
    const origWrite = db.write
    db.write = async () => { throw new Error('mock') }
    const res = await request(app).delete('/api/loop/E1/loop_1').expect(500)
    expect(res.body.error).toBeDefined()
  })
})

/* ── index.js: timeline-code with only loops (lines 45-47) ──────────────── */
describe('timeline-code with loops only', () => {
  test('returns loop codes even when no trial codes', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [{ id: 'loop_1', name: 'L1', code: 'loopCode' }],
      timeline: [],
    })
    await db.write()
    const res = await request(app).get('/api/timeline-code/E1').expect(200)
    expect(res.body.codes).toEqual(['loopCode'])
  })
})

/* ── index.js: timeline-names with loop trials that map to null (null case) ─ */
describe('timeline-names with missing loop trial references', () => {
  test('filters null from non-existent trial ids', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'Real' }],
      loops: [{ id: 'loop_1', name: 'L1', trials: [1, 999] }],
      timeline: [],
    })
    await db.write()
    const res = await request(app).get('/api/timeline-names/E1').expect(200)
    expect(res.body.names.filter(n => n === null)).toHaveLength(0)
  })
})

/* ── index.js: validate-ancestor with loop items (lines 170-171, 178) ──── */
describe('validate-ancestor with loop source/target', () => {
  test('handles loop_ids in ancestor check', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', branches: [] }],
      loops: [
        { id: 'loop_1', name: 'L1', branches: [1] },
        { id: 'loop_2', name: 'L2', branches: ['loop_1'] },
      ],
      timeline: [],
    })
    await db.write()
    // source (1) is in loop_2 branches via transitively through loop_1
    const res = await request(app)
      .get('/api/validate-ancestor/E1?source=1&target=loop_2')
      .expect(200)
    expect(res.body.isAncestor).toBe(true)
  })
})

/* ── index.js: validate-ancestor visited set (line 178) ────────────────── */
describe('validate-ancestor handles circular branch references', () => {
  test('returns false when circular branch detected', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [2] },
        { id: 2, name: 'T2', branches: [1] }, // circular
      ],
      loops: [],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .get('/api/validate-ancestor/E1?source=3&target=1')
      .expect(200)
    expect(res.body.isAncestor).toBe(false)
  })
})

/* ── index.js: validate-ancestor same id (line 184) ────────────────────── */
describe('validate-ancestor same source and target', () => {
  test('returns true when source equals target', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, name: 'T1', branches: [] }],
      loops: [],
      timeline: [],
    })
    await db.write()
    const res = await request(app)
      .get('/api/validate-ancestor/E1?source=1&target=1')
      .expect(200)
    expect(res.body.isAncestor).toBe(true)
  })
})

/* ── index.js: validate-ancestor item without branches (line 190) ──────── */
describe('validate-ancestor item without branches field', () => {
  test('returns false when item has no branches', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', branches: [] },
        { id: 2, name: 'T2' }, // no branches field at all
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
})

/* ── index.js: validate-connection with string/number parse (lines 254-290) ── */
describe('validate-connection string/number id matching', () => {
  test('handles string trial ids', async () => {
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

/* ── index.js: error handlers (lines 53, 92, 134, 215, 308) ──────────── */
describe('timeline error handlers', () => {
  test('timeline-code returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origRead = db.read
    db.read = async () => { throw new Error('mock') }
    const res = await request(app).get('/api/timeline-code/E1').expect(500)
    expect(res.body.error).toBeDefined()
  })

  test('timeline patch returns 500 on error', async () => {
    const { app, db } = await freshApp()
    db.data.trials.push({
      experimentID: 'E1', trials: [], loops: [], timeline: [],
    })
    await db.write()
    const origWrite = db.write
    db.write = async () => { throw new Error('mock') }
    const res = await request(app)
      .patch('/api/timeline/E1')
      .send({ timeline: [] })
      .expect(500)
    expect(res.body.error).toBeDefined()
  })

  test('timeline-names returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origRead = db.read
    db.read = async () => { throw new Error('mock') }
    const res = await request(app).get('/api/timeline-names/E1').expect(500)
    expect(res.body.error).toBeDefined()
  })

  test('validate-ancestor returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origRead = db.read
    db.read = async () => { throw new Error('mock') }
    const res = await request(app)
      .get('/api/validate-ancestor/E1?source=1&target=2')
      .expect(500)
    expect(res.body.error).toBeDefined()
  })

  test('validate-connection returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origRead = db.read
    db.read = async () => { throw new Error('mock') }
    const res = await request(app)
      .get('/api/validate-connection/E1?source=1&target=2')
      .expect(500)
    expect(res.body.error).toBeDefined()
  })
})

/* ── index.js: validate-connection ancestor creates cycle (line 299-308) ── */
describe('validate-connection cycle detection', () => {
  test('rejects connection when target is ancestor of source', async () => {
    const { app, db } = await freshApp()
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
      .get('/api/validate-connection/E1?source=2&target=1')
      .expect(200)
    expect(res.body.isValid).toBe(false)
  })
})

/* ── trials.js: error handlers (lines 61,104,178,203,216,284,396,422) ──── */
describe('trials error handlers', () => {
  test('trials-metadata returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origRead = db.read
    try {
      db.read = async () => { throw new Error('mock') }
      await request(app).get('/api/trials-metadata/E1').expect(500)
    } finally {
      db.read = origRead
    }
  })

  test('trials-extensions returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origRead = db.read
    try {
      db.read = async () => { throw new Error('mock') }
      await request(app).get('/api/trials-extensions/E1').expect(500)
    } finally {
      db.read = origRead
    }
  })

  test('POST trial returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origWrite = db.write
    try {
      db.write = async () => { throw new Error('mock') }
      await request(app)
        .post('/api/trial/E1')
        .send({ name: 'T', plugin: 'p' })
        .expect(500)
    } finally {
      db.write = origWrite
    }
  })

  test('GET trial returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origRead = db.read
    try {
      db.read = async () => { throw new Error('mock') }
      await request(app).get('/api/trial/E1/1').expect(500)
    } finally {
      db.read = origRead
    }
  })

  test('PATCH trial returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origRead = db.read
    try {
      db.read = async () => { throw new Error('mock') }
      await request(app)
        .patch('/api/trial/E1/1')
        .send({ name: 'X' })
        .expect(500)
    } finally {
      db.read = origRead
    }
  })

  test('DELETE trial returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origRead = db.read
    db.read = async () => { throw new Error('mock') }
    const res = await request(app).delete('/api/trial/E1/1').expect(500)
  })

  test('DELETE trials batch returns 500 on error', async () => {
    const { app, db } = await freshApp()
    const origWrite = db.write
    db.write = async () => { throw new Error('mock') }
    const res = await request(app).delete('/api/trials/E1').expect(500)
  })
})
