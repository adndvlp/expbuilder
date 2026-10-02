import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { buildExperimentGraph } from '../../routes/timeline/graph/buildExperimentGraph.js'

const condition = (target, value) => ({
  id: `condition-${value}`,
  rules: [{ column: 'response', op: '==', value }],
  nextTrialId: target,
  customParameters: { stimulus: { source: 'typed', value } },
})

const seedDoc = () => ({
  experimentID: 'E1',
  trials: [
    { id: 1, name: 'A', branches: ['2', 3], branchConditions: [condition('2', 'B'), condition(3, 'C')] },
    { id: 2, name: 'B', branches: ['5'], branchConditions: [condition('5', 'X')] },
    { id: 3, name: 'C', branches: [6], branchConditions: [condition(6, 'Y')] },
    { id: 4, name: 'Nested child', parentLoopId: 'nested', branches: ['2'] },
    { id: 5, name: 'X', branches: [] },
    { id: 6, name: 'Y', branches: [] },
  ],
  loops: [{ id: 'nested', name: 'Nested', trials: [4], repetitions: 3 }],
  timeline: [
    { id: 1, type: 'trial', name: 'A', branches: ['2', 3] },
    { id: 2, type: 'trial', name: 'B', branches: ['5'] },
    { id: 'nested', type: 'loop', name: 'Nested', trials: [4] },
    { id: 3, type: 'trial', name: 'C', branches: [6] },
    { id: 5, type: 'trial', name: 'X', branches: [] },
    { id: 6, type: 'trial', name: 'Y', branches: [] },
  ],
})

const references = (doc) => doc.trials.map(({ id, branches, branchConditions }) => ({
  id, branches, branchConditions,
}))

describe.each(['REST', 'agent'])('%s loop containment', (mode) => {
  let tmpDir, db, app, tools
  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-containment-'))
    process.env.DB_ROOT = tmpDir
    delete process.env.DB_PATH
    jest.resetModules()
    const database = await import('../../utils/db.js')
    db = database.db
    db.data = {}
    database.ensureDbData()
    db.data.experiments.push({ experimentID: 'E1', name: 'Experiment' })
    db.data.trials.push(seedDoc())
    await db.write()
    app = express()
    app.use(express.json())
    app.use((await import('../../routes/timeline/index.js')).default)
    tools = {
      ...(await import('../../agent/tools/create/loop-create.js')).loopCreateTools,
      ...(await import('../../agent/tools/create/loop-update.js')).loopUpdateTools,
      ...(await import('../../agent/tools/create/loop-delete.js')).loopDeleteTools,
    }
  })
  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.DB_ROOT
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  async function mutate(operation, payload, expectedStatus = 200) {
    if (mode === 'agent') {
      return tools[`${operation}_loop`].execute({ experimentID: 'E1', ...payload })
    }
    const endpoint = `/api/loop/E1${operation === 'create' ? '' : `/${payload.loopId}`}`
    const method = { create: 'post', update: 'patch', delete: 'delete' }[operation]
    return (await request(app)[method](endpoint)
      .send(operation === 'update' ? payload.updates : payload)
      .expect(expectedStatus)).body
  }

  async function persistedDoc() {
    await db.read()
    return db.data.trials[0]
  }

  function expectConsistent(doc) {
    const graph = buildExperimentGraph(doc)
    expect(graph.diagnostics).toEqual([])
    const listed = [...doc.timeline.map(item => item.id), ...doc.loops.flatMap(loop => loop.trials)]
    const allIds = [...doc.trials, ...doc.loops].map(item => String(item.id)).sort()
    expect(listed.map(String).sort()).toEqual(allIds)
    for (const item of [...doc.trials, ...doc.loops]) {
      const owner = item.parentLoopId ?? null
      if (owner === null) expect(doc.timeline.some(entry => String(entry.id) === String(item.id))).toBe(true)
      else expect(doc.loops.find(loop => String(loop.id) === String(owner)).trials).toContain(item.id)
    }
    for (const loop of doc.loops) expect(loop).not.toHaveProperty('branches')
    for (const summary of doc.timeline.filter(item => item.type === 'loop')) {
      expect(summary).not.toHaveProperty('branches')
      expect(summary.trials).toEqual(doc.loops.find(loop => loop.id === summary.id).trials)
    }
  }

  test('group/ungroup round trip preserves trial targets, parameters, multiple exits and mixed order', async () => {
    const before = seedDoc()
    const result = await mutate('create', { name: 'Group', trials: ['2', 'nested', '3', 2] })
    expect(result.success).toBe(true)
    const grouped = await persistedDoc()
    expect(grouped.timeline.map(item => item.id)).toEqual([1, result.loop.id, 5, 6])
    expect(grouped.loops.find(loop => loop.id === result.loop.id).trials).toEqual([2, 'nested', 3])
    expect(references(grouped)).toEqual(references(before))
    expect(grouped.trials.find(trial => trial.id === 4).parentLoopId).toBe('nested')
    expectConsistent(grouped)

    expect((await mutate('delete', { loopId: result.loop.id })).success).toBe(true)
    const restored = await persistedDoc()
    expect(restored.timeline.map(item => item.id)).toEqual(before.timeline.map(item => item.id))
    expect(references(restored)).toEqual(references(before))
    expect(restored.loops.find(loop => loop.id === 'nested').parentLoopId).toBeNull()
    expect(restored.loops[0].repetitions).toBe(3)
    expectConsistent(restored)
  })

  test('nested grouping and ungrouping replaces the same position in its parent scope', async () => {
    const outer = await mutate('create', { name: 'Outer', trials: [2, 'nested', 3] })
    const before = await persistedDoc()
    const inner = await mutate('create', {
      name: 'Inner', parentLoopId: outer.loop.id, trials: ['nested', '3'],
    })
    const grouped = await persistedDoc()
    expect(grouped.loops.find(loop => loop.id === outer.loop.id).trials).toEqual([2, inner.loop.id])
    expect(grouped.timeline.map(item => item.id)).toEqual(before.timeline.map(item => item.id))
    expectConsistent(grouped)

    await mutate('delete', { loopId: inner.loop.id })
    const restored = await persistedDoc()
    expect(restored.loops.find(loop => loop.id === outer.loop.id).trials).toEqual([2, 'nested', 3])
    expect(restored.loops.find(loop => loop.id === 'nested').parentLoopId).toBe(outer.loop.id)
    expect(references(restored)).toEqual(references(before))
    expectConsistent(restored)
  })

  test('membership edits restore removed children to the parent and pull additions from their old scopes', async () => {
    const outer = await mutate('create', { name: 'Outer', trials: [2, 'nested', 3] })
    const inner = await mutate('create', { name: 'Inner', parentLoopId: outer.loop.id, trials: [2, 'nested'] })
    const before = await persistedDoc()
    await mutate('update', { loopId: inner.loop.id, updates: { trials: ['nested', '3', '5'], name: 'Edited' } })
    const edited = await persistedDoc()
    expect(edited.loops.find(loop => loop.id === inner.loop.id).trials).toEqual(['nested', 3, 5])
    expect(edited.loops.find(loop => loop.id === outer.loop.id).trials).toEqual([inner.loop.id, 2])
    expect(edited.timeline.map(item => item.id)).toEqual([1, outer.loop.id, 6])
    expect(references(edited)).toEqual(references(before))
    expectConsistent(edited)
  })

  test('root membership edits restore trials and nested loops beside their former container', async () => {
    const loop = await mutate('create', { name: 'Group', trials: [2, 'nested', 3] })
    await mutate('update', { loopId: loop.loop.id, updates: { trials: ['3'] } })
    const doc = await persistedDoc()
    expect(doc.timeline.map(item => item.id)).toEqual([1, loop.loop.id, 2, 'nested', 5, 6])
    expect(references(doc)).toEqual(references(seedDoc()))
    expectConsistent(doc)
  })

  test('skips stale member ids on create, update and delete without replacing live trial targets', async () => {
    const loop = await mutate('create', { name: 'Group', trials: ['ghost', '2'] })
    expect(loop.loop.trials).toEqual([2])
    const edited = await mutate('update', { loopId: loop.loop.id, updates: { trials: ['2', 'ghost'] } })
    expect(edited.loop.trials).toEqual([2])
    db.data.trials[0].loops.find(item => item.id === loop.loop.id).trials.unshift('ghost')
    await db.write()
    await mutate('delete', { loopId: loop.loop.id })
    const restored = await persistedDoc()
    expect(restored.timeline.map(item => item.id)).toEqual(seedDoc().timeline.map(item => item.id))
    expect(references(restored)).toEqual(references(seedDoc()))
    expectConsistent(restored)
  })

  test('restores live owned children absent from the container list, after ordered members', async () => {
    const loop = await mutate('create', { name: 'Group', trials: ['nested', 3, 2] })
    db.data.trials[0].loops.find(item => item.id === loop.loop.id).trials = ['nested', 3]
    await db.write()
    await mutate('delete', { loopId: loop.loop.id })
    const doc = await persistedDoc()
    expect(doc.timeline.map(item => item.id)).toEqual([1, 'nested', 3, 2, 5, 6])
    expect(references(doc)).toEqual(references(seedDoc()))
    expectConsistent(doc)
  })

  test('keeps CSV child settings and repetitions when grouped, edited and ungrouped', async () => {
    const loop = await mutate('create', { name: 'CSV', trials: ['2'], csvJson: [{ stimulus: 'a' }], repetitions: 4 })
    expect((await persistedDoc()).trials.find(trial => trial.id === 2).csvFromLoop).toBe(true)
    await mutate('update', { loopId: loop.loop.id, updates: { csvJson: [] } })
    const edited = await persistedDoc()
    expect(edited.trials.find(trial => trial.id === 2).csvFromLoop).toBe(false)
    expect(edited.loops.find(item => item.id === loop.loop.id).repetitions).toBe(4)
    await mutate('delete', { loopId: loop.loop.id })
    expect(references(await persistedDoc())).toEqual(references(seedDoc()))
  })

  test('preserves the canonical loop ID when the request uses its string representation', async () => {
    const doc = db.data.trials[0]
    doc.loops.push({ id: 10, name: 'Numeric container', trials: [], repetitions: 2 })
    doc.timeline.push({ id: 10, type: 'loop', name: 'Numeric container', trials: [] })
    await db.write()
    const result = await mutate('update', { loopId: '10', updates: { name: 'Renamed', trials: ['2'] } })
    expect(result.loop.id).toBe(10)
    const updated = await persistedDoc()
    expect(updated.loops.find(loop => loop.id === 10).trials).toEqual([2])
    expect(updated.timeline.find(item => item.id === 10).name).toBe('Renamed')
    expect(references(updated)).toEqual(references(seedDoc()))
    expectConsistent(updated)
    await mutate('delete', { loopId: '10' })
    expect((await persistedDoc()).trials.find(trial => trial.id === 2).parentLoopId).toBeNull()
  })

  test('an invalid parent cannot create a missing experiment document', async () => {
    db.data.trials = []
    await db.write()
    const before = structuredClone(db.data)
    const write = jest.spyOn(db, 'write')
    const result = await mutate('create', { name: 'Invalid', trials: [], parentLoopId: 'missing' }, 400)
    expect(result.code).toBe('LOOP_CONTAINMENT_INVALID')
    expect(write).not.toHaveBeenCalled()
    expect(db.data).toEqual(before)
    await db.read()
    expect(db.data).toEqual(before)
  })

  test.each(['missing-parent', 'missing-parent-update', 'group-ancestor', 'self-member', 'parent-descendant', 'invalid-members', 'invalid-member'])('%s is rejected before writes or in-memory mutation', async (scenario) => {
    const outer = await mutate('create', { name: 'Outer', trials: [2, 'nested', 3] })
    const before = structuredClone(db.data)
    const write = jest.spyOn(db, 'write')
    const operations = {
      'missing-parent': ['create', { name: 'Invalid', trials: [1], parentLoopId: 'missing' }],
      'missing-parent-update': ['update', { loopId: outer.loop.id, updates: { name: 'Changed', parentLoopId: 'missing' } }],
      'group-ancestor': ['create', { name: 'Invalid', trials: [outer.loop.id], parentLoopId: 'nested' }],
      'self-member': ['update', { loopId: outer.loop.id, updates: { name: 'Changed', trials: [outer.loop.id] } }],
      'parent-descendant': ['update', { loopId: outer.loop.id, updates: { name: 'Changed', parentLoopId: 'nested' } }],
      'invalid-members': ['update', { loopId: outer.loop.id, updates: { name: 'Changed', trials: '2' } }],
      'invalid-member': ['update', { loopId: outer.loop.id, updates: { name: 'Changed', trials: [{}] } }],
    }
    const [operation, payload] = operations[scenario]
    const result = await mutate(operation, payload, 400)
    expect(result.code).toBe('LOOP_CONTAINMENT_INVALID')
    expect(write).not.toHaveBeenCalled()
    expect(db.data).toEqual(before)
    await db.read()
    expect(db.data).toEqual(before)
  })
})
