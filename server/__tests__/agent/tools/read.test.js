/**
 * Unit tests for read tools (agent/tools/read.js).
 * Each suite spins up a fresh temp DB so tests are fully isolated.
 */
import path from 'path'
import fs from 'fs'
import os from 'os'
import { jest } from '@jest/globals'

// ── Helper: fresh DB + readTools ─────────────────────────────────────────────

const freshSetup = async (seedFn) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-read-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../../utils/db.js')
  db.data = {}
  ensureDbData()
  if (seedFn) seedFn(db.data)
  await db.write()

  const { readTools } = await import('../../../agent/tools/read.js')
  return { db, readTools, tmpDir }
}

const cleanup = (tmpDir) => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.DB_ROOT
}

// ── list_experiments ──────────────────────────────────────────────────────────

describe('list_experiments', () => {
  test('returns empty array when no experiments', async () => {
    const { readTools, tmpDir } = await freshSetup()
    const result = await readTools.list_experiments.execute({})
    expect(result).toEqual([])
    cleanup(tmpDir)
  })

  test('returns experiment with trial/loop/session counts', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push({
        experimentID: 'e1',
        name: 'Stroop',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
      data.trials.push({
        experimentID: 'e1',
        trials: [{ id: 1 }, { id: 2 }],
        loops: [{ id: 'loop_1' }],
      })
      data.sessionResults.push(
        { experimentID: 'e1', sessionId: 's1' },
        { experimentID: 'e1', sessionId: 's2' },
      )
    })

    const [exp] = await readTools.list_experiments.execute({})
    expect(exp.experimentID).toBe('e1')
    expect(exp.name).toBe('Stroop')
    expect(exp.trialCount).toBe(2)
    expect(exp.loopCount).toBe(1)
    expect(exp.sessionCount).toBe(2)
    cleanup(tmpDir)
  })

  test('sorts by createdAt descending (newest first)', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push(
        { experimentID: 'old', name: 'Old', createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' },
        { experimentID: 'new', name: 'New', createdAt: '2024-06-01T00:00:00.000Z', updatedAt: '2024-06-01T00:00:00.000Z' },
      )
    })
    const result = await readTools.list_experiments.execute({})
    expect(result[0].experimentID).toBe('new')
    expect(result[1].experimentID).toBe('old')
    cleanup(tmpDir)
  })
})

// ── get_experiment ────────────────────────────────────────────────────────────

describe('get_experiment', () => {
  test('returns experiment with metadata', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'Test', description: 'desc', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    const result = await readTools.get_experiment.execute({ experimentID: 'e1' })
    expect(result.experimentID).toBe('e1')
    expect(result.description).toBe('desc')
    expect(result.trialCount).toBe(0)
    cleanup(tmpDir)
  })

  test('returns error when experiment not found', async () => {
    const { readTools, tmpDir } = await freshSetup()
    const result = await readTools.get_experiment.execute({ experimentID: 'MISSING' })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})

// ── get_timeline ──────────────────────────────────────────────────────────────

describe('get_timeline', () => {
  test('returns empty timeline when no doc exists', async () => {
    const { readTools, tmpDir } = await freshSetup()
    const result = await readTools.get_timeline.execute({ experimentID: 'NONE' })
    expect(result.timeline).toEqual([])
    cleanup(tmpDir)
  })

  test('returns ordered timeline items', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [],
        loops: [],
        timeline: [
          { id: 1, type: 'trial', name: 'Welcome', branches: [] },
          { id: 2, type: 'trial', name: 'Task', branches: [] },
        ],
      })
    })
    const result = await readTools.get_timeline.execute({ experimentID: 'e1' })
    expect(result.timeline).toHaveLength(2)
    expect(result.timeline[0].name).toBe('Welcome')
    expect(result.timeline[1].name).toBe('Task')
    cleanup(tmpDir)
  })
})

// ── list_trials ───────────────────────────────────────────────────────────────

describe('list_trials', () => {
  test('returns empty arrays when no doc', async () => {
    const { readTools, tmpDir } = await freshSetup()
    const result = await readTools.list_trials.execute({ experimentID: 'NONE' })
    expect(result.trials).toEqual([])
    expect(result.loops).toEqual([])
    cleanup(tmpDir)
  })

  test('returns flat summary of trials and loops', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [
          { id: 1, name: 'T1', plugin: 'plugin-html-keyboard-response', branches: [], branchConditions: [], repeatConditions: [], paramsOverride: [] },
          { id: 2, name: 'T2', plugin: 'plugin-dynamic', branches: [3], csvFromLoop: true },
        ],
        loops: [
          { id: 'loop_1', name: 'Practice', trials: [1, 2], repetitions: 3, randomize: true, isConditionalLoop: false },
        ],
        timeline: [],
      })
    })
    const result = await readTools.list_trials.execute({ experimentID: 'e1' })
    expect(result.trials).toHaveLength(2)
    expect(result.trials[0].id).toBe(1)
    expect(result.trials[0].plugin).toBe('plugin-html-keyboard-response')
    expect(result.trials[1].csvFromLoop).toBe(true)
    expect(result.loops).toHaveLength(1)
    expect(result.loops[0].trialIds).toEqual([1, 2])
    expect(result.loops[0].repetitions).toBe(3)
    cleanup(tmpDir)
  })
})

// ── get_trial ─────────────────────────────────────────────────────────────────

describe('get_trial', () => {
  test('returns full trial data', async () => {
    const trialData = {
      id: 100,
      name: 'Welcome',
      type: 'trial',
      plugin: 'plugin-html-keyboard-response',
      parameters: { stimulus: '<p>Hello</p>' },
      branches: [],
    }
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.trials.push({ experimentID: 'e1', trials: [trialData], loops: [], timeline: [] })
    })
    const result = await readTools.get_trial.execute({ experimentID: 'e1', trialId: 100 })
    expect(result.trial.name).toBe('Welcome')
    expect(result.trial.plugin).toBe('plugin-html-keyboard-response')
    cleanup(tmpDir)
  })

  test('returns error when trial id not found', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.trials.push({ experimentID: 'e1', trials: [], loops: [], timeline: [] })
    })
    const result = await readTools.get_trial.execute({ experimentID: 'e1', trialId: 99999 })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })

  test('returns error when experiment not found', async () => {
    const { readTools, tmpDir } = await freshSetup()
    const result = await readTools.get_trial.execute({ experimentID: 'MISSING', trialId: 1 })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})

// ── get_loop ──────────────────────────────────────────────────────────────────

describe('get_loop', () => {
  test('returns loop with resolved trialDetails', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [
          { id: 1, name: 'T1', plugin: 'plugin-html-keyboard-response' },
          { id: 2, name: 'T2', plugin: 'plugin-dynamic' },
        ],
        loops: [
          { id: 'loop_1', name: 'Practice', trials: [1, 2], repetitions: 2, randomize: false, branches: [] },
        ],
        timeline: [],
      })
    })
    const result = await readTools.get_loop.execute({ experimentID: 'e1', loopId: 'loop_1' })
    expect(result.loop.name).toBe('Practice')
    expect(result.loop.trialDetails).toHaveLength(2)
    expect(result.loop.trialDetails[0]).toEqual({ id: 1, name: 'T1', plugin: 'plugin-html-keyboard-response' })
    cleanup(tmpDir)
  })

  test('handles unknown trial IDs in trialDetails gracefully', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.trials.push({
        experimentID: 'e1',
        trials: [],
        loops: [{ id: 'loop_1', name: 'L', trials: [999], repetitions: 1, randomize: false }],
        timeline: [],
      })
    })
    const result = await readTools.get_loop.execute({ experimentID: 'e1', loopId: 'loop_1' })
    expect(result.loop.trialDetails[0]).toEqual({ id: 999, name: 'unknown', plugin: null })
    cleanup(tmpDir)
  })

  test('returns error when loop not found', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.trials.push({ experimentID: 'e1', trials: [], loops: [], timeline: [] })
    })
    const result = await readTools.get_loop.execute({ experimentID: 'e1', loopId: 'loop_MISSING' })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})

// ── get_config ────────────────────────────────────────────────────────────────

describe('get_config', () => {
  test('returns defaults when no config doc', async () => {
    const { readTools, tmpDir } = await freshSetup()
    const result = await readTools.get_config.execute({ experimentID: 'e1' })
    expect(result.config).toBeNull()
    expect(result.isDevMode).toBe(false)
    expect(result.isSaveMode).toBe(false)
    cleanup(tmpDir)
  })

  test('returns stored config values', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.configs.push({
        experimentID: 'e1',
        data: { customCode: 'console.log("test")' },
        isDevMode: true,
        isSaveMode: false,
      })
    })
    const result = await readTools.get_config.execute({ experimentID: 'e1' })
    expect(result.isDevMode).toBe(true)
    expect(result.config.customCode).toBe('console.log("test")')
    cleanup(tmpDir)
  })
})

// ── list_sessions / get_session ───────────────────────────────────────────────

describe('list_sessions', () => {
  test('returns empty list when no sessions', async () => {
    const { readTools, tmpDir } = await freshSetup()
    const result = await readTools.list_sessions.execute({ experimentID: 'e1' })
    expect(result.sessions).toEqual([])
    expect(result.total).toBe(0)
    cleanup(tmpDir)
  })

  test('returns sessions sorted chronologically with participantNumber', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.sessionResults.push(
        { experimentID: 'e1', sessionId: 's2', state: 'completed', createdAt: '2024-06-02T00:00:00.000Z', data: [1, 2, 3] },
        { experimentID: 'e1', sessionId: 's1', state: 'initiated', createdAt: '2024-06-01T00:00:00.000Z', data: [] },
      )
    })
    const result = await readTools.list_sessions.execute({ experimentID: 'e1' })
    expect(result.total).toBe(2)
    // Sorted by createdAt ascending
    expect(result.sessions[0].sessionId).toBe('s1')
    expect(result.sessions[0].participantNumber).toBe(1)
    expect(result.sessions[1].sessionId).toBe('s2')
    expect(result.sessions[1].participantNumber).toBe(2)
    expect(result.sessions[1].trialCount).toBe(3)
    cleanup(tmpDir)
  })
})

describe('get_session', () => {
  test('returns full session data', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.sessionResults.push({
        experimentID: 'e1',
        sessionId: 's1',
        state: 'completed',
        data: [{ trial_type: 'html-keyboard-response', rt: 450 }],
      })
    })
    const result = await readTools.get_session.execute({ experimentID: 'e1', sessionId: 's1' })
    expect(result.session.state).toBe('completed')
    expect(result.session.data).toHaveLength(1)
    expect(result.session.data[0].rt).toBe(450)
    cleanup(tmpDir)
  })

  test('returns error when session not found', async () => {
    const { readTools, tmpDir } = await freshSetup()
    const result = await readTools.get_session.execute({ experimentID: 'e1', sessionId: 'MISSING' })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })
})

// ── list_plugins ──────────────────────────────────────────────────────────────

describe('list_plugins', () => {
  test('returns structure with dynamic plugin components', async () => {
    const { readTools, tmpDir } = await freshSetup()
    const result = await readTools.list_plugins.execute({})
    expect(result.dynamicPlugin.pluginId).toBe('plugin-dynamic')
    expect(result.dynamicPlugin.components.stimulus).toContain('ImageComponent')
    expect(result.dynamicPlugin.components.response).toContain('SurveyComponent')
    expect(Array.isArray(result.nativePlugins)).toBe(true)
    expect(Array.isArray(result.customPlugins)).toBe(true)
    cleanup(tmpDir)
  })
})

// ── list_files (regression: userDataRoot was missing from imports) ─────────────

describe('list_files', () => {
  test('returns error when experiment not found', async () => {
    const { readTools, tmpDir } = await freshSetup()
    const result = await readTools.list_files.execute({ experimentID: 'MISSING' })
    expect(result.error).toMatch(/not found/)
    cleanup(tmpDir)
  })

  test('returns empty file lists for experiment with no uploads', async () => {
    const { readTools, tmpDir } = await freshSetup((data) => {
      data.experiments.push({ experimentID: 'e1', name: 'MyExp', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' })
    })
    const result = await readTools.list_files.execute({ experimentID: 'e1' })
    expect(result.files.img).toEqual([])
    expect(result.files.aud).toEqual([])
    expect(result.files.vid).toEqual([])
    cleanup(tmpDir)
  })
})
