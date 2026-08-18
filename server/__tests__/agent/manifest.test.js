import path from 'path'
import fs from 'fs'
import os from 'os'
import { jest } from '@jest/globals'

describe('agent codegen P3 manifest producer', () => {
  let tmpDir

  // NOTE: this suite NEVER writes tracked metadata. It reads the REAL
  // server/metadata/plugin-dynamic.json (normalized by readMetadata) and
  // fixtures only use `typed` sources, which never hit default lookups.
  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-mf-'))
    process.env.DB_ROOT = tmpDir
    delete process.env.DB_PATH
    jest.resetModules()
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.DB_ROOT
  })

  const setupExperiment = async (timelineItems, trials) => {
    const { db, ensureDbData } = await import('../../utils/db.js')
    db.data = {}
    ensureDbData()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'ManifestExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials,
      loops: [],
      timeline: timelineItems,
    })
    await db.write()
    const { generateExperimentCode } = await import('../../agent/codegen.js')
    const result = await generateExperimentCode('E1')
    return result
  }

  const dynamicTrial = (id, columnMapping = {}) => ({
    id,
    name: `T${id}`,
    plugin: 'plugin-dynamic',
    parameters: {},
    columnMapping,
    branches: [],
    branchConditions: [],
    csvJson: [],
  })

  const typed = (value) => ({ source: 'typed', value })

  test('A simple → B simple: emits __stableTrialId and a correct prepare manifest', async () => {
    const a = dynamicTrial(1, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/a.png') }] },
    })
    const b = dynamicTrial(2, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/b.png') }] },
    })

    const result = await setupExperiment(
      [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
      [a, b],
    )

    expect(result.code).toContain('__stableTrialId: "1"')
    expect(result.code).toContain('__stableTrialId: "2"')
    expect(result.code).toContain('prepare_next_manifest: {"stableTrialId":"2","images":["img/b.png"],"audio":[],"video":[]}')
  })

  test('A with branch conditions: NO prepare manifest', async () => {
    const a = dynamicTrial(1, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/a.png') }] },
    })
    a.branchConditions = [{ rules: [{ column: 'rt', op: '<', value: 300 }], nextTrialId: 3 }]
    const b = dynamicTrial(2, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/b.png') }] },
    })

    const result = await setupExperiment(
      [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
      [a, b],
    )

    expect(result.code).toContain('__stableTrialId: "1"')
    expect(result.code).not.toContain('prepare_next_manifest')
  })

  test('successor is a loop: NO prepare manifest', async () => {
    const a = dynamicTrial(1, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/a.png') }] },
    })

    const result = await setupExperiment(
      [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 9, type: 'loop', name: 'L1' },
      ],
      [a],
    )

    expect(result.code).not.toContain('prepare_next_manifest')
  })

  test('function-valued asset is NOT included in the manifest', async () => {
    const a = dynamicTrial(1, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/a.png') }] },
    })
    const b = dynamicTrial(2, {
      components: {
        value: [
          {
            type: 'ImageComponent',
            name: 'img',
            stimulus: typed('function(){ return "img/dynamic.png"; }'),
          },
        ],
      },
    })

    const result = await setupExperiment(
      [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
      [a, b],
    )

    // The function must never be evaluated NOR emitted inside the manifest
    // (its raw code still appears as B's own runtime parameter, by design).
    const manifestLine = result.code
      .split('\n')
      .find((line) => line.includes('prepare_next_manifest'))
    expect(manifestLine).not.toContain('img/dynamic.png')
    expect(manifestLine).toContain('"images":[]')
  })

  test('video arrays and multiple categories use the canonical typed-array form end-to-end', async () => {
    const a = dynamicTrial(1, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/a.png') }] },
    })
    const b = dynamicTrial(2, {
      components: {
        value: [
          { type: 'ImageComponent', name: 'i', stimulus: typed('img/b.png') },
          { type: 'AudioComponent', name: 'au', stimulus: typed('aud/c.mp3') },
          {
            type: 'VideoComponent',
            name: 'v',
            // Canonical form: ONE typed mapping whose value is a plain array.
            stimulus: typed(['vid/d.mp4', 'vid/e.mp4']),
          },
          { type: 'SketchpadComponent', name: 'sk', background_image: typed('img/sk.png') },
        ],
      },
      response_components: {
        value: [
          {
            type: 'ButtonResponseComponent',
            name: 'btn',
            // Canonical form: typed mapping with array value.
            choices: typed(['img/choice.png', 'label-a']),
          },
        ],
      },
    })

    const result = await setupExperiment(
      [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
      [a, b],
    )

    // Manifest declares the literals…
    expect(result.code).toContain('"images":["img/b.png","img/sk.png","img/choice.png"]')
    expect(result.code).toContain('"audio":["aud/c.mp3"]')
    expect(result.code).toContain('"video":["vid/d.mp4","vid/e.mp4"]')
    // …and the GENERATED trial B contains the same literals (never null):
    expect(result.code).toContain('"type":"VideoComponent"')
    expect(result.code).toContain('"stimulus":["vid/d.mp4","vid/e.mp4"]')
    expect(result.code).toContain('"type":"ButtonResponseComponent"')
    expect(result.code).toContain('"choices":["img/choice.png","label-a"]')
  })

  test('A CSV multi-row (multiple runtime executions) → NO prepare manifest for B', async () => {
    const a = dynamicTrial(1, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/a.png') }] },
    })
    a.csvJson = [
      { row: 'r1' },
      { row: 'r2' },
      { row: 'r3' },
    ]
    const b = dynamicTrial(2, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/b.png') }] },
    })

    const result = await setupExperiment(
      [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
      [a, b],
    )

    expect(result.code).toContain('__stableTrialId: "1"')
    expect(result.code).not.toContain('prepare_next_manifest')
  })

  test('A with csvFromLoop → NO prepare manifest', async () => {
    const a = dynamicTrial(1, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/a.png') }] },
    })
    a.csvFromLoop = true
    const b = dynamicTrial(2, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/b.png') }] },
    })

    const result = await setupExperiment(
      [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
      [a, b],
    )

    expect(result.code).not.toContain('prepare_next_manifest')
  })

  test('CSV-driven successor (multiple rows): NO prepare manifest', async () => {
    const a = dynamicTrial(1, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/a.png') }] },
    })
    const b = dynamicTrial(2, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: { source: 'csv', value: 'stim' } }] },
    })
    b.csvJson = [{ stim: 'img/r1.png' }, { stim: 'img/r2.png' }]

    const result = await setupExperiment(
      [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
      [a, b],
    )

    expect(result.code).not.toContain('prepare_next_manifest')
  })

  test('explicit: plain component type + typed array stimulus round-trip (never null)', async () => {
    const a = dynamicTrial(1, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/a.png') }] },
    })
    const b = dynamicTrial(2, {
      components: {
        value: [
          {
            type: 'VideoComponent',
            name: 'v',
            stimulus: typed(['vid/d.mp4', 'vid/e.mp4']),
          },
        ],
      },
    })

    const result = await setupExperiment(
      [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
      [a, b],
    )

    // Manifest declares the literals…
    expect(result.code).toContain('"video":["vid/d.mp4","vid/e.mp4"]')
    // …and the generated B keeps the PLAIN type and the resolved array:
    expect(result.code).toContain('"type":"VideoComponent"')
    expect(result.code).toContain('"stimulus":["vid/d.mp4","vid/e.mp4"]')
    expect(result.code).not.toContain('"type":null')
  })

  test('explicit: plain literal component fields survive generation unchanged', async () => {
    const a = dynamicTrial(1, {
      components: { value: [{ type: 'ImageComponent', name: 'img', stimulus: typed('img/a.png') }] },
    })
    const b = dynamicTrial(2, {
      components: {
        value: [
          {
            type: 'ImageComponent',
            name: 'img',
            plainLabel: 'plain',
            stimulus: typed('img/b.png'),
          },
        ],
      },
    })

    const result = await setupExperiment(
      [
        { id: 1, type: 'trial', name: 'T1' },
        { id: 2, type: 'trial', name: 'T2' },
      ],
      [a, b],
    )

    expect(result.code).toContain('"plainLabel":"plain"')
    expect(result.code).not.toContain('"plainLabel":null')
    expect(result.code).toContain('"images":["img/b.png"]')
  })
})
