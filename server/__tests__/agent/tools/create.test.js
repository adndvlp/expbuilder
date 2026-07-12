/**
 * Unit tests for write tools (agent/tools/create.js).
 * Each describe block spins up a fresh temp DB.
 */
import path from 'path'
import fs from 'fs'
import os from 'os'
import { jest } from '@jest/globals'

const mockBuildExperimentHtml = jest.fn().mockResolvedValue({ error: 'not available in test env' })
const mockBuildPublicExperimentHtml = jest.fn().mockResolvedValue({ error: 'not available in test env' })

// Mock codegen so run_experiment / publish_experiment don't need filesystem
jest.unstable_mockModule('../../../agent/codegen.js', () => ({
  buildExperimentHtml: mockBuildExperimentHtml,
  buildPublicExperimentHtml: mockBuildPublicExperimentHtml,
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

  test('rejects empty, undefined, and null-like names', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.create_experiment.execute({ name: '   ' }))
      .resolves.toEqual({ error: 'Experiment name required. Cannot be empty, "undefined", or "null".' })
    await expect(createTrialTools.create_experiment.execute({ name: 'undefined' }))
      .resolves.toEqual({ error: 'Experiment name required. Cannot be empty, "undefined", or "null".' })
    await expect(createTrialTools.create_experiment.execute({ name: 'null' }))
      .resolves.toEqual({ error: 'Experiment name required. Cannot be empty, "undefined", or "null".' })
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

  test('rejects invalid renamed experiment names', async () => {
    const { createTrialTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'Old', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    await expect(createTrialTools.update_experiment.execute({ experimentID: 'e1', updates: { name: ' null ' } }))
      .resolves.toEqual({ error: 'Name cannot be empty, "undefined", or "null".' })
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

  test('removes HTML, preview, uploads, and participant file records when deleting', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'ToDelete', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
      data.participantFiles.push({ id: 'pf1', experimentID: 'e1', filename: 'a.txt' })
    })
    const expHtmlDir = path.join(tmpDir, 'experiments_html')
    const previewHtmlDir = path.join(tmpDir, 'trials_previews_html')
    fs.mkdirSync(expHtmlDir, { recursive: true })
    fs.mkdirSync(previewHtmlDir, { recursive: true })
    fs.writeFileSync(path.join(expHtmlDir, 'ToDelete.html'), '<html></html>')
    fs.writeFileSync(path.join(previewHtmlDir, 'ToDelete.html'), '<html></html>')
    fs.mkdirSync(path.join(tmpDir, 'ToDelete', 'img'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'ToDelete', 'img', 'a.png'), 'x')

    const result = await createTrialTools.delete_experiment.execute({ experimentID: 'e1' })

    expect(result).toEqual({ success: true, deletedExperimentID: 'e1' })
    expect(fs.existsSync(path.join(expHtmlDir, 'ToDelete.html'))).toBe(false)
    expect(fs.existsSync(path.join(previewHtmlDir, 'ToDelete.html'))).toBe(false)
    expect(fs.existsSync(path.join(tmpDir, 'ToDelete'))).toBe(false)
    await db.read()
    expect(db.data.participantFiles).toEqual([])
    cleanup(tmpDir)
  })

  test('returns error for unknown experiment', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    const result = await createTrialTools.delete_experiment.execute({ experimentID: 'MISSING' })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })

  test('rejects empty, undefined, and null-like trial names before DB mutation', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    await expect(createTrialTools.create_trial.execute({ experimentID: 'e1', name: ' ', plugin: 'p' }))
      .resolves.toEqual({ error: 'Trial name required. Cannot be empty, "undefined", or "null".' })
    await expect(createTrialTools.create_trial.execute({ experimentID: 'e1', name: 'undefined', plugin: 'p' }))
      .resolves.toEqual({ error: 'Trial name required. Cannot be empty, "undefined", or "null".' })
    await db.read()
    expect(db.data.trials).toEqual([])
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

  test('returns errors for missing docs and missing trials', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.delete_trial.execute({ experimentID: 'e1', trialId: 1 }))
      .resolves.toEqual({ error: 'Experiment e1 not found' })

    const { createTrialTools: seededTools, tmpDir: seededTmp } = await freshSetup((data) => {
      data.trials.push({ experimentID: 'e1', trials: [], loops: [], timeline: [] })
    })
    await expect(seededTools.delete_trial.execute({ experimentID: 'e1', trialId: 1 }))
      .resolves.toEqual({ error: 'Trial 1 not found' })
    cleanup(tmpDir)
    cleanup(seededTmp)
  })

  test('updates loop branches, loop membership, and timeline loop entries', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [
          { id: 1, name: 'Parent', branches: [2] },
          { id: 2, name: 'Delete', branches: [3] },
          { id: 3, name: 'Child', branches: [] },
        ],
        loops: [{ id: 'loop_1', name: 'L', trials: [2, 3], branches: [2] }],
        timeline: [
          { id: 1, type: 'trial', name: 'Parent', branches: [2] },
          { id: 'loop_1', type: 'loop', name: 'L', branches: [2], trials: [2, 3] },
          { id: 'custom', type: 'note', name: 'Untouched' },
        ],
      })
    })

    await createTrialTools.delete_trial.execute({ experimentID: 'e1', trialId: 2 })

    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.loops[0].branches).toEqual([3])
    expect(doc.loops[0].trials).toEqual([3])
    expect(doc.timeline.find(item => item.id === 'loop_1')).toMatchObject({ branches: [3], trials: [3] })
    expect(doc.timeline.find(item => item.id === 'custom')).toMatchObject({ id: 'custom', type: 'note' })
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

  test('returns errors for invalid loop names and unknown experiments', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.create_loop.execute({ experimentID: 'e1', name: 'null', trials: [] }))
      .resolves.toEqual({ error: 'Loop name required. Cannot be empty, "undefined", or "null".' })
    await expect(createTrialTools.create_loop.execute({ experimentID: 'missing', name: 'Loop', trials: [] }))
      .resolves.toEqual({ error: 'Experiment missing not found' })
    cleanup(tmpDir)
  })

  test('nests loops, rewrites incoming branches, and syncs timeline branch data', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
      data.trials.push({
        experimentID: 'e1',
        trials: [
          { id: 1, name: 'Outside', branches: [2, 3] },
          { id: 2, name: 'Inside A', branches: [] },
          { id: 3, name: 'Inside B', branches: [] },
        ],
        loops: [
          { id: 'outer', name: 'Outer', trials: [], branches: [2], repetitions: 1 },
        ],
        timeline: [
          { id: 1, type: 'trial', name: 'Outside', branches: [2, 3] },
          { id: 'outer', type: 'loop', name: 'Outer', branches: [2], trials: [] },
          { id: 2, type: 'trial', name: 'Inside A', branches: [] },
          { id: 3, type: 'trial', name: 'Inside B', branches: [] },
        ],
      })
    })

    const result = await createTrialTools.create_loop.execute({
      experimentID: 'e1',
      name: 'Nested',
      trials: [2, 3],
      parentLoopId: 'outer',
      branches: [1],
      csvJson: [{ stim: 'a' }],
    })

    expect(result.success).toBe(true)
    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.loops.find(l => l.id === 'outer').trials).toContain(result.loop.id)
    expect(doc.trials.find(t => t.id === 1).branches).toEqual([result.loop.id])
    expect(doc.loops.find(l => l.id === 'outer').branches).toEqual([result.loop.id])
    expect(doc.trials.find(t => t.id === 2).parentLoopId).toBe(result.loop.id)
    expect(doc.trials.find(t => t.id === 2).csvFromLoop).toBe(true)
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

  test('moves trials and nested loops between parent loops and clears removed children', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [
          { id: 1, name: 'Old child', parentLoopId: 'loop_1', csvFromLoop: true },
          { id: 2, name: 'Moved child', parentLoopId: 'loop_old' },
        ],
        loops: [
          { id: 'loop_1', name: 'Target', trials: [1], repetitions: 1, csvJson: [{ a: 1 }] },
          { id: 'loop_old', name: 'Old', trials: [2, 'loop_child'], repetitions: 1 },
          { id: 'loop_child', name: 'Nested', trials: [], parentLoopId: 'loop_old' },
        ],
        timeline: [
          { id: 'loop_1', type: 'loop', name: 'Target', branches: [], trials: [1] },
          { id: 'loop_old', type: 'loop', name: 'Old', branches: [], trials: [2, 'loop_child'] },
          { id: 2, type: 'trial', name: 'Moved child', branches: [] },
        ],
      })
    })

    await createTrialTools.update_loop.execute({
      experimentID: 'e1',
      loopId: 'loop_1',
      updates: { name: 'Updated', branches: ['done'], trials: [2, 'loop_child'], csvJson: [] },
    })

    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.trials.find(t => t.id === 1).parentLoopId).toBeNull()
    expect(doc.trials.find(t => t.id === 1).csvFromLoop).toBe(true)
    expect(doc.trials.find(t => t.id === 2).parentLoopId).toBe('loop_1')
    expect(doc.loops.find(l => l.id === 'loop_child').parentLoopId).toBe('loop_1')
    expect(doc.loops.find(l => l.id === 'loop_old').trials).toEqual([])
    expect(doc.timeline.find(item => item.id === 'loop_1')).toMatchObject({ name: 'Updated', branches: ['done'], trials: [2, 'loop_child'] })
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

  test('returns error when loop document is missing', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.update_loop.execute({ experimentID: 'e1', loopId: 'loop_1', updates: {} }))
      .resolves.toEqual({ error: 'Experiment e1 not found' })
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

  test('reconnects parents to first child and appends loop branches to last child', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [
          { id: 1, name: 'Parent', branches: ['loop_1'] },
          { id: 2, name: 'First', parentLoopId: 'loop_1', branches: [3] },
          { id: 3, name: 'Last', parentLoopId: 'loop_1', branches: [] },
          { id: 4, name: 'After', branches: [] },
        ],
        loops: [
          { id: 'loop_1', name: 'L', trials: [2, 3], branches: [4] },
          { id: 'nested', name: 'Nested', trials: [], parentLoopId: 'loop_1', branches: [] },
        ],
        timeline: [{ id: 'loop_1', type: 'loop', name: 'L', branches: [4], trials: [2, 3] }],
      })
    })

    await createTrialTools.delete_loop.execute({ experimentID: 'e1', loopId: 'loop_1' })

    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.trials.find(t => t.id === 1).branches).toEqual([2])
    expect(doc.trials.find(t => t.id === 3).branches).toEqual([4])
    expect(doc.loops.find(l => l.id === 'nested').parentLoopId).toBeNull()
    expect(doc.timeline.map(item => item.id)).toEqual([2, 3, 'nested'])
    cleanup(tmpDir)
  })

  test('removes empty loop references when deleting a loop with no children', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [{ id: 1, name: 'Parent', branches: ['loop_1'] }],
        loops: [{ id: 'loop_1', name: 'Empty', trials: [], branches: [] }],
        timeline: [],
      })
    })

    await createTrialTools.delete_loop.execute({ experimentID: 'e1', loopId: 'loop_1' })

    await db.read()
    const doc = db.data.trials.find(t => t.experimentID === 'e1')
    expect(doc.trials[0].branches).toEqual([])
    cleanup(tmpDir)
  })

  test('returns errors for missing docs and missing loops', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.delete_loop.execute({ experimentID: 'e1', loopId: 'loop_1' }))
      .resolves.toEqual({ error: 'Experiment e1 not found' })
    const { createTrialTools: seededTools, tmpDir: seededTmp } = await freshSetup((data) => {
      data.trials.push({ experimentID: 'e1', trials: [], loops: [], timeline: [] })
    })
    await expect(seededTools.delete_loop.execute({ experimentID: 'e1', loopId: 'loop_1' }))
      .resolves.toEqual({ error: 'Loop loop_1 not found' })
    cleanup(tmpDir)
    cleanup(seededTmp)
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

  test('returns error when timeline document is missing', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.reorder_timeline.execute({ experimentID: 'e1', timeline: [] }))
      .resolves.toEqual({ error: 'Experiment e1 not found' })
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

  test('merges pre-init params, init params, save flags, and session naming in existing config', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
      data.configs.push({
        experimentID: 'e1',
        data: {
          customPreInitCode: { local: 'local();', public: 'public();' },
          customInitJsPsychParams: { local: { show_progress_bar: 'false' }, public: {} },
        },
        isDevMode: false,
        isSaveMode: false,
      })
    })

    const sessionNameConfig = { tokens: [{ type: 'customText', value: 'S' }], separator: '-' }
    await createTrialTools.update_experiment_config.execute({
      experimentID: 'e1',
      isDevMode: true,
      isSaveMode: true,
      customPreInitCode: { public: 'updatedPublic();' },
      customInitJsPsychParams: { public: { on_finish: 'done' } },
      sessionNameConfig,
    })

    await db.read()
    const cfg = db.data.configs[0]
    expect(cfg.isDevMode).toBe(true)
    expect(cfg.isSaveMode).toBe(true)
    expect(cfg.sessionNameConfig).toEqual(sessionNameConfig)
    expect(cfg.data.customPreInitCode).toEqual({ local: 'local();', public: 'updatedPublic();' })
    expect(cfg.data.customInitJsPsychParams).toEqual({ local: { show_progress_bar: 'false' }, public: { on_finish: 'done' } })
    cleanup(tmpDir)
  })

  test('creates config with custom pre-init and init parameter defaults', async () => {
    const { createTrialTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    const result = await createTrialTools.update_experiment_config.execute({
      experimentID: 'e1',
      customPreInitCode: { local: 'setup();' },
      customInitJsPsychParams: { local: { display_element: '"target"' } },
    })
    expect(result.config.data.customPreInitCode).toEqual({ local: 'setup();', public: '' })
    expect(result.config.data.customInitJsPsychParams).toEqual({ local: { display_element: '"target"' }, public: {} })
    cleanup(tmpDir)
  })

  test('returns error when experiment not found', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    const result = await createTrialTools.update_experiment_config.execute({ experimentID: 'MISSING' })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})

// ── upload/delete file ───────────────────────────────────────────────────────

describe('upload_file / delete_file', () => {
  test('uploads supported files and deletes them by URL', async () => {
    const { createTrialTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'FilesExp', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })

    const result = await createTrialTools.upload_file.execute({
      experimentID: 'e1',
      filename: 'stimulus.png',
      base64Content: Buffer.from('image-data').toString('base64'),
    })

    expect(result).toEqual({
      success: true,
      url: 'img/stimulus.png',
      type: 'img',
      filename: 'stimulus.png',
      sizeBytes: Buffer.byteLength('image-data'),
    })
    expect(fs.readFileSync(path.join(tmpDir, 'FilesExp', 'img', 'stimulus.png'), 'utf8')).toBe('image-data')

    const deleted = await createTrialTools.delete_file.execute({ experimentID: 'e1', fileUrl: 'img/stimulus.png' })
    expect(deleted).toEqual({ success: true, deleted: 'img/stimulus.png' })
    expect(fs.existsSync(path.join(tmpDir, 'FilesExp', 'img', 'stimulus.png'))).toBe(false)
    cleanup(tmpDir)
  })

  test('validates experiment, extension, URL format, type, and existence', async () => {
    const { createTrialTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'FilesExp', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })

    await expect(createTrialTools.upload_file.execute({ experimentID: 'missing', filename: 'x.png', base64Content: '' }))
      .resolves.toEqual({ error: 'Experiment missing not found' })
    await expect(createTrialTools.upload_file.execute({ experimentID: 'e1', filename: 'x.exe', base64Content: '' }))
      .resolves.toEqual({ error: 'Unsupported file type: .exe' })
    await expect(createTrialTools.delete_file.execute({ experimentID: 'missing', fileUrl: 'img/x.png' }))
      .resolves.toEqual({ error: 'Experiment missing not found' })
    await expect(createTrialTools.delete_file.execute({ experimentID: 'e1', fileUrl: 'bad-format' }))
      .resolves.toEqual({ error: 'Invalid fileUrl format. Expected "type/filename", got "bad-format"' })
    await expect(createTrialTools.delete_file.execute({ experimentID: 'e1', fileUrl: 'bad/x.png' }))
      .resolves.toEqual({ error: 'Invalid type: bad' })

    const missing = await createTrialTools.delete_file.execute({ experimentID: 'e1', fileUrl: 'img/x.png' })
    expect(missing.error).toMatch(/File not found/)
    cleanup(tmpDir)
  })

  test('classifies audio, video, and misc uploads and falls back to experimentID name', async () => {
    const { createTrialTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })

    await expect(createTrialTools.upload_file.execute({ experimentID: 'e1', filename: 'sound.mp3', base64Content: Buffer.from('a').toString('base64') }))
      .resolves.toMatchObject({ success: true, type: 'aud', url: 'aud/sound.mp3' })
    await expect(createTrialTools.upload_file.execute({ experimentID: 'e1', filename: 'movie.mp4', base64Content: Buffer.from('v').toString('base64') }))
      .resolves.toMatchObject({ success: true, type: 'vid', url: 'vid/movie.mp4' })
    await expect(createTrialTools.upload_file.execute({ experimentID: 'e1', filename: 'data.csv', base64Content: Buffer.from('x,y').toString('base64') }))
      .resolves.toMatchObject({ success: true, type: 'others', url: 'others/data.csv' })
    expect(fs.existsSync(path.join(tmpDir, 'e1', 'aud', 'sound.mp3'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'e1', 'vid', 'movie.mp4'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'e1', 'others', 'data.csv'))).toBe(true)
    cleanup(tmpDir)
  })
})

// ── custom plugin tools ──────────────────────────────────────────────────────

describe('custom plugin tools', () => {
  test('creates, overwrites, and deletes custom plugins', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup()

    const created = await createTrialTools.create_custom_plugin.execute({
      index: 0,
      name: 'plugin-old',
      pluginCode: 'console.log("old")',
    })
    expect(created).toEqual({
      success: true,
      plugin: { name: 'plugin-old', index: 0, scripTag: '/plugins/plugin-old.js' },
    })
    expect(fs.existsSync(path.join(tmpDir, 'plugins', 'plugin-old.js'))).toBe(true)

    const overwritten = await createTrialTools.create_custom_plugin.execute({
      index: 0,
      name: 'plugin-new',
      pluginCode: 'console.log("new")',
    })
    expect(overwritten.plugin.name).toBe('plugin-new')
    expect(fs.existsSync(path.join(tmpDir, 'plugins', 'plugin-old.js'))).toBe(false)
    expect(fs.readFileSync(path.join(tmpDir, 'plugins', 'plugin-new.js'), 'utf8')).toBe('console.log("new")')

    await db.read()
    expect(db.data.pluginConfigs[0].plugins).toHaveLength(1)

    const deleted = await createTrialTools.delete_custom_plugin.execute({ index: 0 })
    expect(deleted).toEqual({ success: true, deleted: 'plugin-new' })
    expect(fs.existsSync(path.join(tmpDir, 'plugins', 'plugin-new.js'))).toBe(false)
    cleanup(tmpDir)
  })

  test('overwrites same-name plugin slot without deleting the target file first', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup()
    await createTrialTools.create_custom_plugin.execute({ index: 1, name: 'plugin-same', pluginCode: 'old' })
    await createTrialTools.create_custom_plugin.execute({ index: 1, name: 'plugin-same', pluginCode: 'new' })
    await db.read()
    expect(db.data.pluginConfigs[0].plugins).toEqual([
      { index: 1, name: 'plugin-same', scripTag: '/plugins/plugin-same.js', pluginCode: 'new' },
    ])
    expect(fs.readFileSync(path.join(tmpDir, 'plugins', 'plugin-same.js'), 'utf8')).toBe('new')
    cleanup(tmpDir)
  })

  test('returns useful errors for invalid custom plugin operations', async () => {
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.create_custom_plugin.execute({ index: 0, name: 'undefined', pluginCode: 'x' }))
      .resolves.toEqual({ error: 'Plugin name required. Cannot be empty, "undefined", or "null".' })
    await expect(createTrialTools.delete_custom_plugin.execute({ index: 0 }))
      .resolves.toEqual({ error: 'No custom plugins configured' })

    const { createTrialTools: seededTools, tmpDir: seededTmp } = await freshSetup((data) => {
      data.pluginConfigs.push({ plugins: [{ index: 1, name: 'p1', scripTag: '/plugins/p1.js', pluginCode: 'x' }], config: {} })
    })
    await expect(seededTools.delete_custom_plugin.execute({ index: 0 }))
      .resolves.toEqual({ error: 'Plugin at index 0 not found' })
    cleanup(tmpDir)
    cleanup(seededTmp)
  })
})

// ── tunnel tools ─────────────────────────────────────────────────────────────

describe('tunnel tools', () => {
  test('updates tunnel settings with hostname normalization', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', tunnelSettings: { hostname: '', persistent: false }, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })

    const result = await createTrialTools.update_tunnel_settings.execute({
      experimentID: 'e1',
      hostname: 'https://example.com/',
      persistent: true,
    })
    expect(result).toEqual({
      success: true,
      tunnelSettings: { hostname: 'example.com', persistent: true },
    })
    await db.read()
    expect(db.data.experiments[0].tunnelSettings).toEqual({ hostname: 'example.com', persistent: true })
    cleanup(tmpDir)
  })

  test('updates only supplied tunnel settings and initializes defaults', async () => {
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    await createTrialTools.update_tunnel_settings.execute({ experimentID: 'e1', persistent: true })
    await db.read()
    expect(db.data.experiments[0].tunnelSettings).toEqual({ hostname: '', persistent: true })
    cleanup(tmpDir)
  })

  test('creates and closes tunnels through the API endpoint', async () => {
    const originalFetch = global.fetch
    const { createTrialTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', tunnelSettings: { hostname: 'custom.example.com', persistent: false }, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ json: async () => ({ success: true, url: 'https://custom.example.com' }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, message: 'Tunnel closed' }) })

    await expect(createTrialTools.create_tunnel.execute({ experimentID: 'e1' }))
      .resolves.toEqual({ success: true, url: 'https://custom.example.com' })
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/create-tunnel', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ experimentID: 'e1', hostname: 'custom.example.com' }),
    }))

    await expect(createTrialTools.close_tunnel.execute({ experimentID: 'e1' }))
      .resolves.toEqual({ success: true, message: 'Tunnel closed' })
    global.fetch = originalFetch
    cleanup(tmpDir)
  })

  test('uses API_URL override and empty hostname for quick tunnel creation', async () => {
    const originalFetch = global.fetch
    process.env.API_URL = 'http://127.0.0.1:3999'
    global.fetch = jest.fn().mockResolvedValueOnce({ json: async () => ({ success: true, url: 'https://quick.trycloudflare.com' }) })
    const { createTrialTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    await expect(createTrialTools.create_tunnel.execute({ experimentID: 'e1' }))
      .resolves.toEqual({ success: true, url: 'https://quick.trycloudflare.com' })
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:3999/api/create-tunnel', expect.objectContaining({
      body: JSON.stringify({ experimentID: 'e1', hostname: '' }),
    }))
    global.fetch = originalFetch
    delete process.env.API_URL
    cleanup(tmpDir)
  })

  test('returns tunnel errors for missing experiments and failed fetches', async () => {
    const originalFetch = global.fetch
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.update_tunnel_settings.execute({ experimentID: 'missing' }))
      .resolves.toEqual({ error: 'Experiment missing not found' })
    await expect(createTrialTools.create_tunnel.execute({ experimentID: 'missing' }))
      .resolves.toEqual({ error: 'Experiment missing not found' })

    global.fetch = jest.fn().mockRejectedValueOnce(new Error('network down')).mockRejectedValueOnce(new Error('close down'))
    const { createTrialTools: seededTools, tmpDir: seededTmp } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'E', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    await expect(seededTools.create_tunnel.execute({ experimentID: 'e1' }))
      .resolves.toEqual({ success: false, error: 'Tunnel error: network down. Ensure cloudflared is installed.' })
    await expect(seededTools.close_tunnel.execute({ experimentID: 'e1' }))
      .resolves.toEqual({ success: false, error: 'close down' })
    global.fetch = originalFetch
    cleanup(tmpDir)
    cleanup(seededTmp)
  })
})

// ── run/publish tools ────────────────────────────────────────────────────────

describe('run_experiment / publish_experiment', () => {
  beforeEach(() => {
    mockBuildExperimentHtml.mockClear()
    mockBuildPublicExperimentHtml.mockClear()
    delete process.env.FIREBASE_URL
  })

  test('delegates run_experiment to HTML build', async () => {
    mockBuildExperimentHtml.mockResolvedValueOnce({ success: true, experimentUrl: 'http://localhost:3000/E' })
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.run_experiment.execute({ experimentID: 'e1' }))
      .resolves.toEqual({ success: true, experimentUrl: 'http://localhost:3000/E' })
    expect(mockBuildExperimentHtml).toHaveBeenCalledWith('e1')
    cleanup(tmpDir)
  })

  test('publish returns build errors and validates FIREBASE_URL', async () => {
    mockBuildPublicExperimentHtml.mockResolvedValueOnce({ error: 'build failed' })
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.publish_experiment.execute({ experimentID: 'e1', uid: 'u1' }))
      .resolves.toEqual({ error: 'build failed' })

    mockBuildPublicExperimentHtml.mockResolvedValueOnce({
      htmlContent: '<html></html>',
      experimentName: 'My Experiment',
      mediaFiles: [],
      uid: 'u1',
      storage: 'googledrive',
    })
    await expect(createTrialTools.publish_experiment.execute({ experimentID: 'e1', uid: 'u1' }))
      .resolves.toEqual({ error: 'FIREBASE_URL not configured — cannot publish' })
    cleanup(tmpDir)
  })

  test('publish posts to Firebase, saves pagesUrl, and returns repo data', async () => {
    const originalFetch = global.fetch
    process.env.FIREBASE_URL = 'https://firebase.example.com'
    mockBuildPublicExperimentHtml.mockResolvedValueOnce({
      htmlContent: '<html></html>',
      experimentName: 'My Experiment!',
      mediaFiles: [{ type: 'img', filename: 'a.png', content: 'abc' }],
      uid: 'u1',
      storage: 'dropbox',
    })
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({ success: true, pagesUrl: 'https://pages.example.com', repoUrl: 'https://github.com/u/my-experiment' }),
    })
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'My Experiment!', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })

    await expect(createTrialTools.publish_experiment.execute({ experimentID: 'e1', uid: 'u1', storage: 'dropbox' }))
      .resolves.toEqual({ success: true, pagesUrl: 'https://pages.example.com', repoUrl: 'https://github.com/u/my-experiment' })
    expect(global.fetch).toHaveBeenCalledWith('https://firebase.example.com/publishExperiment', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"repoName":"my-experiment"'),
    }))
    await db.read()
    expect(db.data.experiments[0].pagesUrl).toBe('https://pages.example.com')
    global.fetch = originalFetch
    delete process.env.FIREBASE_URL
    cleanup(tmpDir)
  })

  test('publish succeeds without pagesUrl and uses default storage', async () => {
    const originalFetch = global.fetch
    process.env.FIREBASE_URL = 'https://firebase.example.com'
    mockBuildPublicExperimentHtml.mockResolvedValueOnce({
      htmlContent: '<html></html>',
      experimentName: 'No Pages',
      mediaFiles: [],
      uid: 'u1',
      storage: 'googledrive',
    })
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({ success: true, repoUrl: 'https://github.com/u/no-pages' }),
    })
    const { createTrialTools, db, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'No Pages', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })

    await expect(createTrialTools.publish_experiment.execute({ experimentID: 'e1', uid: 'u1' }))
      .resolves.toEqual({ success: true, pagesUrl: undefined, repoUrl: 'https://github.com/u/no-pages' })
    expect(global.fetch).toHaveBeenCalledWith('https://firebase.example.com/publishExperiment', expect.objectContaining({
      body: expect.stringContaining('"storageProvider":"googledrive"'),
    }))
    await db.read()
    expect(db.data.experiments[0].pagesUrl).toBeUndefined()
    global.fetch = originalFetch
    delete process.env.FIREBASE_URL
    cleanup(tmpDir)
  })

  test('publish reports Firebase failures and network errors', async () => {
    const originalFetch = global.fetch
    process.env.FIREBASE_URL = 'https://firebase.example.com'
    const buildResult = {
      htmlContent: '<html></html>',
      experimentName: 'Failure Exp',
      mediaFiles: [],
      uid: 'u1',
      storage: 'googledrive',
    }
    mockBuildPublicExperimentHtml.mockResolvedValueOnce(buildResult)
    global.fetch = jest.fn().mockResolvedValueOnce({ json: async () => ({ success: false, message: 'denied' }) })
    const { createTrialTools, tmpDir } = await freshSetup()
    await expect(createTrialTools.publish_experiment.execute({ experimentID: 'e1', uid: 'u1' }))
      .resolves.toEqual({ success: false, error: 'denied' })

    mockBuildPublicExperimentHtml.mockResolvedValueOnce(buildResult)
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('network failed'))
    await expect(createTrialTools.publish_experiment.execute({ experimentID: 'e1', uid: 'u1' }))
      .resolves.toEqual({ success: false, error: 'Publish error: network failed' })
    global.fetch = originalFetch
    delete process.env.FIREBASE_URL
    cleanup(tmpDir)
  })
})
