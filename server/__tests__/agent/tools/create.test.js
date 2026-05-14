/**
 * Unit tests for write tools (agent/tools/create.js).
 * Each describe block spins up a fresh temp DB.
 */
import path from 'path'
import fs from 'fs'
import os from 'os'
import { jest } from '@jest/globals'

// Mock codegen so run_experiment / publish_experiment don't need filesystem
jest.unstable_mockModule('../../../agent/codegen.js', () => ({
  buildExperimentHtml: jest.fn().mockResolvedValue({ error: 'not available in test env' }),
  buildPublicExperimentHtml: jest.fn().mockResolvedValue({ error: 'not available in test env' }),
}))

// ── Helper ────────────────────────────────────────────────────────────────────

const freshSetup = async (seedFn) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-create-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../../utils/db.js')
  db.data = {}
  ensureDbData()
  if (seedFn) seedFn(db.data)
  await db.write()

  const { createTrialTools } = await import('../../../agent/tools/create.js')
  return { db, createTrialTools, tmpDir }
}

const cleanup = (tmpDir) => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.DB_ROOT
}

// ── create_experiment ─────────────────────────────────────────────────────────

describe('create_experiment', () => {
  test('creates experiment with UUID and timestamps', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup()
    const result = await createTrialTools.create_experiment.execute({ name: 'Stroop Task', description: 'A color-word task' })
    expect(result.success).toBe(true)
    expect(result.experiment.experimentID).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.experiment.name).toBe('Stroop Task')
    expect(result.experiment.description).toBe('A color-word task')
    await db.read()
    expect(db.data.experiments).toHaveLength(1)
    cleanup(tmpDir)
  })

  test('persists experiment to DB', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup()
    await createTrialTools.create_experiment.execute({ name: 'E1' })
    await db.read()
    expect(db.data.experiments[0].name).toBe('E1')
    cleanup(tmpDir)
  })
})

// ── update_experiment ─────────────────────────────────────────────────────────

describe('update_experiment', () => {
  test('patches experiment fields', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'Old', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    const result = await createTrialTools.update_experiment.execute({ experimentID: 'e1', updates: { name: 'New Name', description: 'Updated' } })
    expect(result.success).toBe(true)
    expect(result.experiment.name).toBe('New Name')
    expect(result.experiment.description).toBe('Updated')
    cleanup(tmpDir)
  })

  test('returns error for unknown experiment', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    const result = await createTrialTools.update_experiment.execute({ experimentID: 'MISSING', updates: { name: 'X' } })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})

// ── delete_experiment ─────────────────────────────────────────────────────────

describe('delete_experiment', () => {
  test('removes experiment and all related data', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'ToDelete', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
      data.trials.push({ experimentID: 'e1', trials: [{ id: 1 }], loops: [], timeline: [] })
      data.configs.push({ experimentID: 'e1', data: {} })
      data.sessionResults.push({ experimentID: 'e1', sessionId: 's1' })
    })
    const result = await createTrialTools.delete_experiment.execute({ experimentID: 'e1' })
    expect(result.success).toBe(true)
    await db.read()
    expect(db.data.experiments).toHaveLength(0)
    expect(db.data.trials).toHaveLength(0)
    expect(db.data.configs).toHaveLength(0)
    expect(db.data.sessionResults).toHaveLength(0)
    cleanup(tmpDir)
  })

  test('returns error for unknown experiment', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    const result = await createTrialTools.delete_experiment.execute({ experimentID: 'MISSING' })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})

// ── create_trial ──────────────────────────────────────────────────────────────

describe('create_trial', () => {
  test('creates trial and appends to timeline', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    const result = await createTrialTools.create_trial.execute({
      experimentID: 'e1',
      name: 'Welcome',
      plugin: 'plugin-html-keyboard-response',
      parameters: { stimulus: '<p>Hi</p>' },
    })
    expect(result.success).toBe(true)
    expect(typeof result.trial.id).toBe('number')
    expect(result.trial.plugin).toBe('plugin-html-keyboard-response')

    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.trials).toHaveLength(1)
    expect(doc.timeline).toHaveLength(1)
    expect(doc.timeline[0].type).toBe('trial')
    cleanup(tmpDir)
  })

  test('adds trial to parent loop — NOT to top-level timeline', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
      data.trials.push({
        experimentID: 'e1',
        trials: [],
        loops: [{ id: 'loop_1', name: 'L', trials: [], repetitions: 3 }],
        timeline: [{ id: 'loop_1', type: 'loop', name: 'L', branches: [], trials: [] }],
      })
    })
    await createTrialTools.create_trial.execute({ experimentID: 'e1', name: 'T', plugin: 'plugin-html-keyboard-response', parentLoopId: 'loop_1' })

    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.timeline).toHaveLength(1) // only the loop, not the trial
    expect(doc.timeline[0].type).toBe('loop')
    expect(doc.loops[0].trials).toHaveLength(1)
    cleanup(tmpDir)
  })

  test('marks trial as csvFromLoop when parent loop has CSV', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
      data.trials.push({
        experimentID: 'e1',
        trials: [],
        loops: [{ id: 'loop_1', name: 'L', trials: [], csvJson: [{ img: 'cat.jpg' }], csvColumns: ['img'] }],
        timeline: [],
      })
    })
    await createTrialTools.create_trial.execute({ experimentID: 'e1', name: 'T', plugin: 'plugin-dynamic', parentLoopId: 'loop_1' })
    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.trials[0].csvFromLoop).toBe(true)
    cleanup(tmpDir)
  })

  test('returns error when experiment not found', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    const result = await createTrialTools.create_trial.execute({ experimentID: 'MISSING', name: 'T', plugin: 'p' })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})

// ── update_trial ──────────────────────────────────────────────────────────────

describe('update_trial', () => {
  test('patches trial fields only', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [{ id: 1, name: 'Old', plugin: 'plugin-html-keyboard-response', branches: [], parameters: {} }],
        loops: [],
        timeline: [{ id: 1, type: 'trial', name: 'Old', branches: [] }],
      })
    })
    const result = await createTrialTools.update_trial.execute({ experimentID: 'e1', trialId: 1, updates: { name: 'New' } })
    expect(result.success).toBe(true)
    expect(result.trial.name).toBe('New')
    expect(result.trial.plugin).toBe('plugin-html-keyboard-response') // unchanged
    cleanup(tmpDir)
  })

  test('syncs timeline name when trial name changes', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [{ id: 1, name: 'Old', plugin: 'p', branches: [], parameters: {} }],
        loops: [],
        timeline: [{ id: 1, type: 'trial', name: 'Old', branches: [] }],
      })
    })
    await createTrialTools.update_trial.execute({ experimentID: 'e1', trialId: 1, updates: { name: 'New Name' } })
    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.timeline[0].name).toBe('New Name')
    cleanup(tmpDir)
  })

  test('preserves trial id even if updates include a different id', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [{ id: 1, name: 'T', plugin: 'p', branches: [], parameters: {} }],
        loops: [],
        timeline: [],
      })
    })
    await createTrialTools.update_trial.execute({ experimentID: 'e1', trialId: 1, updates: { id: 9999, name: 'X' } })
    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.trials[0].id).toBe(1)
    cleanup(tmpDir)
  })

  test('returns error when trial not found', async () => {
    const { createTrialTools, tmpDir } = await freshSetup((data) => {
      data.trials.push({ experimentID: 'e1', trials: [], loops: [], timeline: [] })
    })
    const result = await createTrialTools.update_trial.execute({ experimentID: 'e1', trialId: 9999, updates: { name: 'X' } })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})

// ── delete_trial ──────────────────────────────────────────────────────────────

describe('delete_trial', () => {
  test('removes trial from DB and timeline', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [{ id: 1, name: 'T1', branches: [] }],
        loops: [],
        timeline: [{ id: 1, type: 'trial', name: 'T1', branches: [] }],
      })
    })
    const result = await createTrialTools.delete_trial.execute({ experimentID: 'e1', trialId: 1 })
    expect(result.success).toBe(true)
    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.trials).toHaveLength(0)
    expect(doc.timeline).toHaveLength(0)
    cleanup(tmpDir)
  })

  test('smart reconnect: parent branches inherit deleted trial branches', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      // T1 → T2 → T3. Delete T2, expect T1 now branches to T3.
      data.trials.push({
        experimentID: 'e1',
        trials: [
          { id: 1, name: 'T1', branches: [2] },
          { id: 2, name: 'T2', branches: [3] },
          { id: 3, name: 'T3', branches: [] },
        ],
        loops: [],
        timeline: [],
      })
    })
    await createTrialTools.delete_trial.execute({ experimentID: 'e1', trialId: 2 })
    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    const t1 = doc.trials.find(t => t.id === 1)
    expect(t1.branches).toContain(3)
    expect(t1.branches).not.toContain(2)
    cleanup(tmpDir)
  })
})

// ── create_loop ───────────────────────────────────────────────────────────────

describe('create_loop', () => {
  test('creates loop and removes grouped trials from timeline', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
      data.trials.push({
        experimentID: 'e1',
        trials: [
          { id: 1, name: 'T1', branches: [] },
          { id: 2, name: 'T2', branches: [] },
        ],
        loops: [],
        timeline: [
          { id: 1, type: 'trial', name: 'T1', branches: [] },
          { id: 2, type: 'trial', name: 'T2', branches: [] },
        ],
      })
    })
    const result = await createTrialTools.create_loop.execute({ experimentID: 'e1', name: 'Practice', trials: [1, 2], repetitions: 3 })
    expect(result.success).toBe(true)
    expect(result.loop.id).toMatch(/^loop_/)
    expect(result.loop.repetitions).toBe(3)

    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    // Trials removed from timeline, loop added
    expect(doc.timeline).toHaveLength(1)
    expect(doc.timeline[0].type).toBe('loop')
    expect(doc.loops[0].trials).toEqual([1, 2])
    cleanup(tmpDir)
  })

  test('sets parentLoopId on all contained trials', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
      data.trials.push({
        experimentID: 'e1',
        trials: [{ id: 1, name: 'T1', branches: [] }, { id: 2, name: 'T2', branches: [] }],
        loops: [],
        timeline: [
          { id: 1, type: 'trial', name: 'T1', branches: [] },
          { id: 2, type: 'trial', name: 'T2', branches: [] },
        ],
      })
    })
    const { loop } = (await createTrialTools.create_loop.execute({ experimentID: 'e1', name: 'L', trials: [1, 2], repetitions: 1 }))
    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.trials.find(t => t.id === 1).parentLoopId).toBe(loop.id)
    expect(doc.trials.find(t => t.id === 2).parentLoopId).toBe(loop.id)
    cleanup(tmpDir)
  })

  test('marks csvFromLoop on trials when loop has CSV', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
      data.trials.push({
        experimentID: 'e1',
        trials: [{ id: 1, name: 'T', branches: [] }],
        loops: [],
        timeline: [{ id: 1, type: 'trial', name: 'T', branches: [] }],
      })
    })
    await createTrialTools.create_loop.execute({
      experimentID: 'e1', name: 'L', trials: [1],
      csvJson: [{ img: 'cat.jpg' }], csvColumns: ['img'],
    })
    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.trials[0].csvFromLoop).toBe(true)
    cleanup(tmpDir)
  })
})

// ── update_loop ───────────────────────────────────────────────────────────────

describe('update_loop', () => {
  test('patches loop fields', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [],
        loops: [{ id: 'loop_1', name: 'L', trials: [], repetitions: 1, randomize: false }],
        timeline: [{ id: 'loop_1', type: 'loop', name: 'L', branches: [], trials: [] }],
      })
    })
    const result = await createTrialTools.update_loop.execute({ experimentID: 'e1', loopId: 'loop_1', updates: { repetitions: 5, randomize: true } })
    expect(result.success).toBe(true)
    expect(result.loop.repetitions).toBe(5)
    expect(result.loop.randomize).toBe(true)
    cleanup(tmpDir)
  })

  test('updates csvFromLoop on child trials when csvJson is added', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [{ id: 1, name: 'T', parentLoopId: 'loop_1', csvFromLoop: false }],
        loops: [{ id: 'loop_1', name: 'L', trials: [1], repetitions: 1 }],
        timeline: [],
      })
    })
    await createTrialTools.update_loop.execute({
      experimentID: 'e1', loopId: 'loop_1',
      updates: { csvJson: [{ col: 'val' }], csvColumns: ['col'] },
    })
    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.trials[0].csvFromLoop).toBe(true)
    cleanup(tmpDir)
  })

  test('returns error when loop not found', async () => {
    const { createTrialTools, tmpDir } = await freshSetup((data) => {
      data.trials.push({ experimentID: 'e1', trials: [], loops: [], timeline: [] })
    })
    const result = await createTrialTools.update_loop.execute({ experimentID: 'e1', loopId: 'loop_MISSING', updates: {} })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})

// ── delete_loop ───────────────────────────────────────────────────────────────

describe('delete_loop', () => {
  test('removes loop and restores its trials to timeline', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [
          { id: 1, name: 'T1', parentLoopId: 'loop_1', branches: [] },
          { id: 2, name: 'T2', parentLoopId: 'loop_1', branches: [] },
        ],
        loops: [{ id: 'loop_1', name: 'L', trials: [1, 2], branches: [] }],
        timeline: [{ id: 'loop_1', type: 'loop', name: 'L', branches: [], trials: [1, 2] }],
      })
    })
    const result = await createTrialTools.delete_loop.execute({ experimentID: 'e1', loopId: 'loop_1' })
    expect(result.success).toBe(true)

    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.loops).toHaveLength(0)
    // Trials restored to timeline
    expect(doc.timeline.some(i => i.id === 1 && i.type === 'trial')).toBe(true)
    expect(doc.timeline.some(i => i.id === 2 && i.type === 'trial')).toBe(true)
    // parentLoopId cleared
    expect(doc.trials.find(t => t.id === 1).parentLoopId).toBeNull()
    cleanup(tmpDir)
  })
})

// ── reorder_timeline ──────────────────────────────────────────────────────────

describe('reorder_timeline', () => {
  test('replaces timeline order', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [],
        loops: [],
        timeline: [
          { id: 1, type: 'trial', name: 'A', branches: [] },
          { id: 2, type: 'trial', name: 'B', branches: [] },
        ],
      })
    })
    const newOrder = [
      { id: 2, type: 'trial', name: 'B', branches: [] },
      { id: 1, type: 'trial', name: 'A', branches: [] },
    ]
    const result = await createTrialTools.reorder_timeline.execute({ experimentID: 'e1', timeline: newOrder })
    expect(result.success).toBe(true)
    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.timeline[0].id).toBe(2)
    expect(doc.timeline[1].id).toBe(1)
    cleanup(tmpDir)
  })
})

// ── update_experiment_config ──────────────────────────────────────────────────

describe('update_experiment_config', () => {
  test('creates config doc when none exists', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    const result = await createTrialTools.update_experiment_config.execute({
      experimentID: 'e1',
      isDevMode: true,
      isSaveMode: false,
    })
    expect(result.success).toBe(true)
    expect(result.config.isDevMode).toBe(true)
    cleanup(tmpDir)
  })

  test('merges customCode into existing config data', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
      data.configs.push({ experimentID: 'e1', data: { existingKey: 'value' }, isDevMode: false, isSaveMode: false })
    })
    await createTrialTools.update_experiment_config.execute({
      experimentID: 'e1',
      customCode: 'console.log("done")',
    })
    await db.read()
    const cfg = db.data.configs.find(c => c.experimentID === 'e1')
    expect(cfg.data.customCode).toBe('console.log("done")')
    expect(cfg.data.existingKey).toBe('value') // not clobbered
    cleanup(tmpDir)
  })

  test('returns error when experiment not found', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    const result = await createTrialTools.update_experiment_config.execute({ experimentID: 'MISSING' })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})
