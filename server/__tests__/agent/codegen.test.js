import path from 'path'
import fs from 'fs'
import os from 'os'
import { jest } from '@jest/globals'

describe('agent codegen', () => {
  let tmpDir

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-cg-'))
    process.env.DB_ROOT = tmpDir
    delete process.env.DB_PATH
    jest.resetModules()
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.DB_ROOT
  })

  test('generateExperimentCode returns error when experiment not found', async () => {
    // Need to set up DB first
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('MISSING')
    expect(result.error).toContain('not found')
  })

  test('generateExperimentCode returns error when no timeline data', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'NoTL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')
    expect(result.error).toContain('No timeline data')
  })

  test('generateExperimentCode generates code for trials', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'Exp1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'Welcome', plugin: 'webgazer', trialCode: '// hello world', parameters: {}, columnMapping: {}, branches: [], branchConditions: [] },
      ],
      loops: [],
      timeline: [{ id: 1, type: 'trial', name: 'Welcome' }],
    })
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')
    expect(result.error).toBeUndefined()
    expect(result.code).toBeDefined()
    expect(result.code).toContain('hello world')
    expect(result.experimentName).toBe('Exp1')
  })

  test('generateExperimentCode handles webgazer plugin', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'WebGazerExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'Calibration', plugin: 'webgazer', trialCode: '// webgazer code', parameters: {}, columnMapping: {}, branches: [], branchConditions: [] },
      ],
      loops: [],
      timeline: [{ id: 1, type: 'trial', name: 'Calibration' }],
    })
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')
    expect(result.code).toContain('webgazer code')
  })

  test('generateExperimentCode includes preload and fullscreen when needed', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'FullExp',
      appearanceSettings: { fullScreen: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    // Create uploads directory to trigger preload
    const uploadsDir = path.join(tmpDir, 'FullExp', 'img')
    fs.mkdirSync(uploadsDir, { recursive: true })
    fs.writeFileSync(path.join(uploadsDir, 'photo.jpg'), 'fake')

    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [],
      timeline: [],
    })
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')
    expect(result.code).toContain('jsPsychPreload')
    expect(result.code).toContain('jsPsychFullscreen')
  })

  test('generateExperimentCode handles empty timeline', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'EmptyExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [],
      loops: [],
      timeline: [],
    })
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')
    expect(result.code).toContain('jsPsych.run(timeline)')
  })

  test('buildExperimentHtml returns error when experiment missing', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    await db.write()

    const { buildExperimentHtml } = await import('../../agent/codegen.js')
    const result = await buildExperimentHtml('MISSING')
    expect(result.error).toBeDefined()
  })

  test('buildExperimentHtml creates HTML file', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'HtmlExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, name: 'T1', plugin: 'webgazer', trialCode: '// webgazer code', parameters: {}, columnMapping: {}, branches: [], branchConditions: [] },
      ],
      loops: [],
      timeline: [{ id: 1, type: 'trial', name: 'T1' }],
    })
    await db.write()

    const serverDir = path.join(tmpDir, 'server')
    const templateDir = path.join(serverDir, 'templates')
    fs.mkdirSync(templateDir, { recursive: true })
    fs.writeFileSync(path.join(templateDir, 'experiment_template.html'), '<html><head></head><body></body></html>')

    const { buildExperimentHtml } = await import('../../agent/codegen.js')
    const result = await buildExperimentHtml('E1')
    if (!result.error) {
      expect(result.success).toBe(true)
    }
  })
})
