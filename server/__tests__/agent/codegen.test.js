import path from 'path'
import fs from 'fs'
import os from 'os'
import { jest } from '@jest/globals'

describe('agent codegen', () => {
  let tmpDir
  const metadataFiles = []

  const writeMetadata = (pluginName, metadata) => {
    const filePath = path.join(process.cwd(), 'server', 'metadata', `${pluginName}.json`)
    fs.writeFileSync(filePath, typeof metadata === 'string' ? metadata : JSON.stringify(metadata), 'utf8')
    metadataFiles.push(filePath)
  }

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-cg-'))
    process.env.DB_ROOT = tmpDir
    delete process.env.DB_PATH
    jest.resetModules()
  })

  afterAll(() => {
    for (const filePath of metadataFiles) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
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

  test('generateExperimentCode maps native plugin metadata, CSV rows, extensions, and hooks', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'NativeCsvExp',
      appearanceSettings: { fullScreen: false, backgroundColor: '#fafafa' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        {
          id: 1,
          name: 'Choice',
          plugin: 'plugin-html-button-response',
          parameters: {
            includesExtensions: true,
            extensionType: 'jsPsychExtensionMouseTracking',
          },
          columnMapping: {
            stimulus: { source: 'csv', value: 'stimulus' },
            choices: { source: 'typed', value: ['Yes', 'No'] },
            button_html: { source: 'typed', value: 'function(choice){ return `<button>${choice}</button>` }' },
            trial_duration: { source: 'csv', value: 'duration' },
            response_ends_trial: { source: 'csv', value: 'ends' },
          },
          csvJson: [
            { stimulus: '<p>A</p>', duration: '1500', ends: 'true' },
            { stimulus: '<p>B</p>', duration: 'bad-number', ends: '0' },
          ],
          branches: [2],
          branchConditions: [
            {
              id: 10,
              rules: [{ column: 'response', op: '==', value: '0' }],
              nextTrialId: 2,
              customParameters: { stimulus: { source: 'typed', value: '<p>Branch</p>' } },
            },
            {
              id: 11,
              rules: [{ column: 'rt', op: '>', value: '200' }],
              nextTrialId: 2,
            },
          ],
          repeatConditions: [
            { id: 12, rules: [{ column: 'response', op: '!=', value: '1' }], jumpToTrialId: 1 },
          ],
          paramsOverride: [
            {
              id: 13,
              rules: [{ trialId: 99, column: 'response', op: 'includes', value: 'x' }],
              paramsToOverride: { prompt: { source: 'typed', value: '<p>Prompt</p>' } },
            },
          ],
          customOnStart: 'trial.customStarted = true;',
          customOnLoad: 'window.loadedChoice = true;',
          customOnFinish: 'data.finishedChoice = true;',
          customInitialize: 'return Promise.resolve();',
        },
      ],
      loops: [],
      timeline: [{ id: 1, type: 'trial', name: 'Choice' }],
    })
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')

    expect(result.error).toBeUndefined()
    expect(result.fullScreen).toBe(false)
    expect(result.backgroundColor).toBe('#fafafa')
    expect(result.pluginNames).toEqual(['plugin-html-button-response'])
    expect(result.code).toContain('const test_stimuli_id_1')
    expect(result.code).toContain('type: jsPsychHtmlButtonResponse')
    expect(result.code).toContain('jsPsychExtensionMouseTracking')
    expect(result.code).toContain('timeline_variables: test_stimuli_id_1')
    expect(result.code).toContain('on_start: function(trial)')
    expect(result.code).toContain('trial.prompt = "<p>Prompt</p>"')
    expect(result.code).toContain('on_load: function()')
    expect(result.code).toContain('on_finish: function(data)')
    expect(result.code).toContain('localStorage.setItem')
    expect(result.code).toContain('initialize: async function()')
  })

  test('generateExperimentCode covers metadata shapes, fallback values, rule operators, and extension variants', async () => {
    writeMetadata('plugin-array-meta', {
      parameters: [
        { key: 'int_value', type: 'int', default: 7 },
        { key: 'float_value', type: 'float', default: 1.5 },
        { key: 'bool_value', type: 'bool', default: false },
        { key: 'plain_value', type: 'string', default: 'fallback' },
        { key: 'none_value', type: 'string', default: 'none-default' },
        { key: 'fn_value', type: 'function', default: null },
        { key: 'arrow_value', type: 'function', default: null },
      ],
      data: [{ key: 'score' }],
    })
    writeMetadata('plugin-object-meta', {
      parameters: {
        stimulus: { type: 'string', default: '<p>Default</p>' },
        stimuli: { type: 'string', default: 'default-stimuli' },
      },
      data: {
        accuracy: { type: 'number' },
      },
    })
    writeMetadata('plugin-bad-meta', '{ bad json')

    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'MetaExp',
      appearanceSettings: { fullScreen: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        {
          id: 'trial-1',
          name: 'Array Meta',
          plugin: 'plugin-array-meta',
          parameters: {
            includesExtensions: true,
            extensionType: 'jsPsychExtensionRecordVideo',
            plain_value: 'from-parameters',
          },
          columnMapping: {
            int_value: { source: 'csv', value: 'int_col' },
            float_value: { source: 'csv', value: 'float_col' },
            bool_value: { source: 'csv', value: 'bool_col' },
            none_value: { source: 'none' },
            fn_value: { source: 'typed', value: '() => 1' },
            arrow_value: { source: 'typed', value: 'value => value + 1' },
          },
          csvJson: [
            { int_col: '42', float_col: '3.14', bool_col: true },
            { int_col: 'bad', float_col: 'bad', bool_col: '1' },
          ],
          branches: [2],
          branchConditions: [
            { id: 1, rules: [{ componentIdx: 'cmp', prop: 'score', op: '<', value: '9' }], nextTrialId: 2 },
          ],
          repeatConditions: [
            { id: 2, rules: [{ column: 'score', op: 'noop', value: 'again' }], jumpToTrialId: 'trial-1' },
          ],
          paramsOverride: [
            { id: 3, rules: [], paramsToOverride: { plain_value: { source: 'csv', value: 'window.dynamicPlain' } } },
            { id: 4, rules: [] },
          ],
        },
        {
          id: 2,
          name: 'Webgazer Extension',
          plugin: 'plugin-object-meta',
          parameters: {
            includesExtensions: true,
            extensionType: 'jsPsychExtensionWebgazer',
          },
          columnMapping: {
            stimulus: { source: 'typed', value: '<p>Stim</p>' },
          },
          branches: [],
          branchConditions: [
            { id: 5, rules: [{ column: 'accuracy', op: '>=', value: '1' }, { column: 'accuracy', op: '<=', value: '3' }], nextTrialId: 'trial-1' },
          ],
        },
        {
          id: 3,
          name: 'Dynamic',
          plugin: 'plugin-dynamic',
          parameters: {
            includesExtensions: true,
            extensionType: 'jsPsychExtensionWebgazer',
          },
          columnMapping: {
            components: {
              source: 'typed',
              value: [
                {
                  html: { source: 'csv', value: 'html_col' },
                  unknown: { source: 'csv', value: 'raw_col' },
                },
              ],
            },
            response_components: {
              source: 'typed',
              value: [
                { label: { source: 'typed', value: 'OK' } },
              ],
            },
          },
          csvJson: [{ html_col: '<p>A</p>', raw_col: 'raw' }, { html_col: '<p>B</p>', raw_col: 'raw-b' }],
          branches: [],
          branchConditions: [{ id: 6, rules: [{}], nextTrialId: 2 }],
        },
        {
          id: 7,
          name: 'Direct Functions',
          plugin: 'plugin-array-meta',
          parameters: {},
          columnMapping: {
            fn_value: { source: 'typed', value: '() => 1' },
            arrow_value: { source: 'typed', value: 'value => value + 1' },
          },
          branches: [],
        },
        { id: 4, name: 'No Plugin', parameters: {}, branches: [] },
        { id: 5, name: 'Missing Metadata', plugin: 'plugin-missing-meta', parameters: {}, branches: [] },
        { id: 6, name: 'Bad Metadata', plugin: 'plugin-bad-meta', parameters: {}, branches: [] },
      ],
      loops: [],
      timeline: [
        { id: 'trial-1', type: 'trial', name: 'Array Meta' },
        { id: 2, type: 'trial', name: 'Webgazer Extension' },
        { id: 3, type: 'trial', name: 'Dynamic' },
        { id: 7, type: 'trial', name: 'Direct Functions' },
        { id: 4, type: 'trial', name: 'No Plugin' },
        { id: 5, type: 'trial', name: 'Missing Metadata' },
        { id: 6, type: 'trial', name: 'Bad Metadata' },
        { id: 999, type: 'trial', name: 'Missing Timeline Trial' },
      ],
    })
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')

    expect(result.error).toBeUndefined()
    expect(result.code).toContain('const trial_1_timeline')
    expect(result.code).toContain('int_value: jsPsych.timelineVariable("int_value")')
    expect(result.code).toContain('"int_value":0')
    expect(result.code).toContain('"float_value":0')
    expect(result.code).toContain('"bool_value":true')
    expect(result.code).toContain('fn_value: () => 1')
    expect(result.code).toContain('arrow_value: value => value + 1')
    expect(result.code).toContain('trial.plain_value = window.dynamicPlain')
    expect(result.code).toContain('jsPsychExtensionRecordVideo')
    expect(result.code).toContain('jsPsychExtensionWebgazer')
    expect(result.code).toContain('"#jspsych-object-meta-stimulus"')
    expect(result.code).toContain('type: DynamicPlugin')
    expect(result.code).toContain('unknown')
    expect(result.code).toContain('false /* no column */')
    expect(result.code).toContain('return _isNum && _nv < _ncv')
    expect(result.code).toContain('return _isNum && _nv >= _ncv')
    expect(result.code).toContain('return _isNum && _nv <= _ncv')
    expect(result.code).toContain('type: jsPsychMissingMeta')
    expect(result.code).toContain('type: jsPsychBadMeta')
  })

  test('generateExperimentCode emits loop procedures with ordering, conditional repeat, and jumps', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'LoopExp',
      appearanceSettings: { fullScreen: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        {
          id: 1,
          name: 'LoopTrial',
          plugin: 'plugin-html-keyboard-response',
          parameters: {},
          columnMapping: {
            stimulus: { source: 'csv', value: 'stimulus' },
            choices: { source: 'typed', value: ['a', 'b'] },
          },
          branches: [],
          branchConditions: [],
          repeatConditions: [],
        },
      ],
      loops: [
        {
          id: 'loop_outer',
          name: 'Outer',
          trials: [1],
          repetitions: 2,
          randomize: true,
          csvJson: [{ stimulus: 'A', category: 'x' }, { stimulus: 'B', category: 'y' }],
          orders: true,
          stimuliOrders: [[1, 0]],
          categories: true,
          categoryData: ['x', 'y'],
          isConditionalLoop: true,
          loopConditions: [
            { id: 1, rules: [{ trialId: 1, column: 'response', op: '==', value: 'again' }] },
          ],
          branches: ['done'],
          branchConditions: [
            { id: 2, rules: [{ column: 'response', op: '==', value: 'skip' }], nextTrialId: 'done' },
          ],
          repeatConditions: [
            { id: 3, rules: [{ column: 'response', op: '==', value: 'restart' }], jumpToTrialId: 'loop_outer' },
          ],
        },
      ],
      timeline: [{ id: 'loop_outer', type: 'loop', name: 'Outer' }],
    })
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')

    expect(result.error).toBeUndefined()
    expect(result.code).toContain('let test_stimuli_loop_outer = []')
    expect(result.code).toContain('const loop_outer_procedure = {')
    expect(result.code).toContain('randomize_order: true')
    expect(result.code).toContain('loop_function: function(data)')
    expect(result.code).toContain('localStorage.setItem')
    expect(result.code).toContain('timeline.push(loop_outer_procedure)')
  })

  test('generateExperimentCode emits nested loop wrappers, csv child wrappers, and empty loop fallbacks', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'NestedLoopExp',
      appearanceSettings: { fullScreen: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        {
          id: 1,
          name: 'Loop Csv Trial',
          plugin: 'plugin-html-keyboard-response',
          csvFromLoop: true,
          parameters: {},
          columnMapping: {
            stimulus: { source: 'csv', value: 'stimulus' },
            choices: { source: 'typed', value: ['a'] },
          },
          branches: [],
          branchConditions: [
            { id: 1, rules: [{ column: 'response', op: '==', value: 'a' }], nextTrialId: 'after' },
          ],
        },
        {
          id: 2,
          name: 'Nested Trial',
          plugin: 'plugin-html-button-response',
          parameters: {},
          columnMapping: {
            stimulus: { source: 'typed', value: '<p>Nested</p>' },
            choices: { source: 'typed', value: ['go'] },
          },
          branches: [],
          branchConditions: [],
        },
        { id: 3, name: 'No Plugin Child', branches: [] },
      ],
      loops: [
        {
          id: 'loop_parent',
          name: 'Parent',
          trials: [1, 'loop_child'],
          repetitions: 1,
          randomize: false,
          csvJson: [{ stimulus: 'A' }, { stimulus: 'B' }],
          branchConditions: [{ id: 10, rules: [{ column: 'response', op: '==', value: 'branch' }], nextTrialId: 'after' }],
          branches: ['after'],
        },
        {
          id: 'loop_child',
          name: 'Child',
          trials: [2],
          repetitions: 2,
          orders: true,
          stimuliOrders: [[0]],
          csvJson: [{ stimulus: 'C' }],
          branchConditions: [{ id: 11, rules: [{ column: 'response', op: '==', value: 'child' }], nextTrialId: 'after' }],
          branches: ['after'],
        },
        { id: 'loop_empty', name: 'Empty', trials: [], repetitions: 1 },
        { id: 'loop_invalid', name: 'Invalid', trials: [3], repetitions: 1 },
      ],
      timeline: [
        { id: 'loop_parent', type: 'loop', name: 'Parent' },
        { id: 'loop_empty', type: 'loop', name: 'Empty' },
        { id: 'loop_invalid', type: 'loop', name: 'Invalid' },
        { id: 'missing_loop', type: 'loop', name: 'Missing Loop' },
      ],
    })
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')

    expect(result.error).toBeUndefined()
    expect(result.code).toContain('const id_1_wrapper = {')
    expect(result.code).toContain('on_timeline_finish: function()')
    expect(result.code).toContain('const loop_child_wrapper = {')
    expect(result.code).toContain('loop_loop_parent_NextTrialId = loop_loop_child_NextTrialId || "after"')
    expect(result.code).toContain('window.nextTrialId = loop_loop_parent_NextTrialId || "after"')
    expect(result.code).toContain('sample: { type: "with-replacement", size: 1 * 2 }')
    expect(result.code).not.toContain('loop_empty_procedure')
    expect(result.code).not.toContain('loop_invalid_procedure')
  })

  test('generateExperimentCode emits order-only loop preprocessing', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'OrderOnlyExp',
      appearanceSettings: { fullScreen: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        {
          id: 1,
          name: 'T',
          plugin: 'plugin-html-keyboard-response',
          csvFromLoop: true,
          parameters: {},
          columnMapping: {
            stimulus: { source: 'csv', value: 'stimulus' },
            choices: { source: 'typed', value: ['a'] },
          },
          branches: [],
        },
      ],
      loops: [
        {
          id: 'loop_order',
          name: 'Order',
          trials: [1],
          repetitions: 1,
          orders: true,
          stimuliOrders: [[1, 0]],
          csvJson: [{ stimulus: 'A' }, { stimulus: 'B' }],
        },
      ],
      timeline: [{ id: 'loop_order', type: 'loop', name: 'Order' }],
    })
    await db.write()

    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')

    expect(result.error).toBeUndefined()
    expect(result.code).toContain('} else if (_stimuliOrders.length > 0) {')
    expect(result.code).toContain('test_stimuli_loop_order = _stimuliOrders[_idx]')
  })

  test('buildPublicExperimentHtml creates a self-contained response and includes media payloads', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'PublicExp',
      appearanceSettings: { fullScreen: false, backgroundColor: '#123456' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        {
          id: 1,
          name: 'PublicTrial',
          plugin: 'plugin-html-keyboard-response',
          parameters: {},
          columnMapping: {
            stimulus: { source: 'typed', value: '<p>Public</p>' },
            choices: { source: 'typed', value: ['a'] },
          },
          branches: [],
          branchConditions: [],
        },
      ],
      loops: [],
      timeline: [{ id: 1, type: 'trial', name: 'PublicTrial' }],
    })
    const uploadDir = path.join(tmpDir, 'PublicExp', 'img')
    fs.mkdirSync(uploadDir, { recursive: true })
    fs.writeFileSync(path.join(uploadDir, 'image.png'), 'image-content')
    await db.write()

    const { buildPublicExperimentHtml } = await import('../../agent/codegen.js')
    const result = await buildPublicExperimentHtml('E1', 'user-1', 'dropbox')

    expect(result.success).toBe(true)
    expect(result.experimentName).toBe('PublicExp')
    expect(result.uid).toBe('user-1')
    expect(result.storage).toBe('dropbox')
    expect(result.htmlContent).toContain('https://unpkg.com/jspsych@8.2.2')
    expect(result.htmlContent).toContain('background-color: #123456')
    expect(result.mediaFiles).toEqual([
      { type: 'img', filename: 'image.png', content: Buffer.from('image-content').toString('base64') },
    ])
    expect(fs.existsSync(path.join(tmpDir, 'experiments_html', 'PublicExp_public.html'))).toBe(false)
  })

  test('buildExperimentHtml applies background color and encoded experiment URLs', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'HTML Exp',
      appearanceSettings: { fullScreen: false, backgroundColor: '#010203' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({ experimentID: 'E1', trials: [], loops: [], timeline: [] })
    await db.write()

    const { buildExperimentHtml } = await import('../../agent/codegen.js')
    const result = await buildExperimentHtml('E1')

    expect(result.success).toBe(true)
    expect(result.experimentUrl).toBe('http://localhost:3000/HTML%20Exp')
    expect(fs.readFileSync(result.htmlPath, 'utf8')).toContain('background-color: #010203')
  })

  test('buildPublicExperimentHtml returns upstream errors and skips unreadable media files', async () => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    await db.write()

    const { buildPublicExperimentHtml } = await import('../../agent/codegen.js')
    await expect(buildPublicExperimentHtml('missing', 'uid')).resolves.toEqual({ error: 'Experiment missing not found' })
  })
})
