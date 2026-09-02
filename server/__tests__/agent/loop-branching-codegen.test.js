import { describe, expect, test } from '@jest/globals'
import { generateLoopCode } from '../../agent/codegen/loop.js'

describe('agent loop branching codegen', () => {
  test('executes an exact nested-loop exit with its parameters', () => {
    const doc = {
      trials: [
        {
          id: 1,
          name: 'Source',
          plugin: 'plugin-html-keyboard-response',
          parameters: {},
          columnMapping: {
            stimulus: { source: 'typed', value: '<p>Source</p>' },
            choices: { source: 'typed', value: ['go'] },
          },
          branches: [2],
          branchConditions: [{
            id: 1,
            rules: [{ column: 'response', op: '==', value: 'go' }],
            nextTrialId: 2,
            customParameters: {
              stimulus: { source: 'typed', value: '<p>Branched</p>' },
            },
          }],
        },
        {
          id: 2,
          name: 'Outer target',
          plugin: 'plugin-html-keyboard-response',
          parameters: {},
          columnMapping: {
            stimulus: { source: 'typed', value: '<p>Default</p>' },
            choices: { source: 'typed', value: ['ok'] },
          },
          branches: [],
          branchConditions: [],
        },
      ],
      loops: [
        { id: 'outer', name: 'Outer', trials: ['inner', 2], repetitions: 1 },
        { id: 'inner', name: 'Inner', trials: [1], repetitions: 1, parentLoopId: 'outer' },
      ],
    }
    const code = generateLoopCode(doc.loops[0], doc, null)

    expect(code).toContain('const loop_inner_DescendantIds = [1]')
    expect(code).toContain('const loop_outer_DescendantIds = ["inner", ...loop_inner_DescendantIds, 2]')
    expect(code).toContain('loop_outer_NextTrialId = pendingBranchTarget')
    expect(code).toContain('window.nextTrialId = pendingBranchTarget')

    const runtime = new Function(`
      const timeline = [];
      const jsPsychHtmlKeyboardResponse = {};
      const localStorage = {
        getItem: () => null,
        removeItem: () => {},
        setItem: () => {},
      };
      const window = {
        nextTrialId: null,
        skipRemaining: false,
        branchingActive: false,
        branchCustomParameters: null,
      };
      const jsPsych = {
        data: { get: () => ({ push: () => {} }) },
        timelineVariable: () => null,
      };
      ${code}
      return {
        finishInner: () => inner_procedure.on_timeline_finish(),
        finishOuter: () => outer_procedure.on_timeline_finish(),
        finishSource: (data) => id_1_timeline.on_finish(data),
        prepareTarget: (trial) => id_2_timeline.on_start(trial),
        targetCanRun: () => id_2_wrapper.conditional_function(),
        windowState: () => ({ ...window }),
      };
    `)()

    runtime.finishSource({ response: 'go' })
    runtime.finishInner()
    expect(runtime.targetCanRun()).toBe(true)
    const targetConfig = {}
    runtime.prepareTarget(targetConfig)
    expect(targetConfig.stimulus).toBe('<p>Branched</p>')
    runtime.finishOuter()
    expect(runtime.windowState()).toMatchObject({
      nextTrialId: null,
      skipRemaining: false,
      branchingActive: false,
      branchCustomParameters: null,
    })
  })
})
