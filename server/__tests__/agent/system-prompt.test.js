import path from 'path'
import fs from 'fs'
import os from 'os'
import { jest } from '@jest/globals'

describe('agent system-prompt', () => {
  let tmpDir

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-sp-'))
    process.env.DB_ROOT = tmpDir
    delete process.env.DB_PATH
    jest.resetModules()
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.DB_ROOT
  })

  test('buildSystemPrompt includes base instructions', async () => {
    const { buildSystemPrompt } = await import('../../agent/system-prompt.js')
    const result = await buildSystemPrompt({
      userMessage: 'create a new experiment',
      experiments: [],
      trials: [],
    })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(100)
  })

  test('buildSystemPrompt includes experiment context when provided', async () => {
    const { buildSystemPrompt } = await import('../../agent/system-prompt.js')
    const result = await buildSystemPrompt({
      userMessage: 'modify experiment',
      experiments: [{ experimentID: 'E1', name: 'Stroop Test', description: 'Color naming test' }],
      trials: [{ experimentID: 'E1', trials: [{ id: 1, name: 'Welcome' }], loops: [], timeline: [] }],
    })
    expect(typeof result).toBe('string')
  })

  test('buildSystemPrompt formats singular and plural trial/loop counts', async () => {
    const { buildSystemPrompt } = await import('../../agent/system-prompt.js')
    const result = await buildSystemPrompt({
      userMessage: 'show current experiments',
      experiments: [
        { experimentID: 'E1', name: 'Single' },
        { experimentID: 'E2', name: 'Plural' },
        { experimentID: 'E3', name: 'No Doc' },
      ],
      trials: [
        { experimentID: 'E1', trials: [{ id: 1 }], loops: [{ id: 'loop_1' }] },
        { experimentID: 'E2', trials: [{ id: 1 }, { id: 2 }], loops: [{ id: 'loop_1' }, { id: 'loop_2' }] },
      ],
    })

    expect(result).toContain('- **Single** (E1) — 1 trial, 1 loop')
    expect(result).toContain('- **Plural** (E2) — 2 trials, 2 loops')
    expect(result).toContain('- **No Doc** (E3)')
  })

  test('buildSystemPrompt handles missing userMessage gracefully', async () => {
    const { buildSystemPrompt } = await import('../../agent/system-prompt.js')
    const result = await buildSystemPrompt({
      userMessage: '',
      experiments: [],
      trials: [],
    })
    expect(typeof result).toBe('string')
  })
})
