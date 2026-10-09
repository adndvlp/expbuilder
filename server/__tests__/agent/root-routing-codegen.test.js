import { describe, expect, jest, test } from '@jest/globals'
import { generateTrialCode } from '../../agent/codegen/trial.js'
import { getRootBranchTargetIds, getRootMergePointIds } from '../../agent/codegen/rootRouting.js'

function createTargetRuntime({ isMergePoint = false, isBranchTarget = false, csvJson = [] } = {}) {
  const state = {
    nextTrialId: 2, skipRemaining: true, branchingActive: true,
    branchCustomParameters: { stimulus: { value: 'received' } },
  }
  const abortExperiment = jest.fn()
  const trial = {
    id: 2, name: 'Target', plugin: 'plugin-html-keyboard-response', csvJson,
    parameters: {}, branches: [], branchConditions: [],
    columnMapping: {
      stimulus: { source: 'typed', value: 'original' },
      choices: { source: 'typed', value: ['go'] },
    },
  }
  const generated = generateTrialCode(trial, false, undefined, undefined, { isMergePoint, isBranchTarget })
  const procedure = new Function('window', 'jsPsych', `
    const timeline = [];
    const jsPsychHtmlKeyboardResponse = {};
    const localStorage = { getItem: () => null };
    ${generated.code}
    return timeline[0];
  `)(state, { timelineVariable: () => null, abortExperiment })
  return { state, abortExperiment, procedure, target: procedure.timeline[0] }
}

describe('agent root trial destinations', () => {
  test.each([{ csvJson: [] }, { csvJson: [{ row: 1 }, { row: 2 }] }])(
    'selects only the requested root procedure and delivers its parameters (CSV=$csvJson)', ({ csvJson }) => {
      const runtime = createTargetRuntime({ csvJson })
      runtime.state.nextTrialId = 3
      expect(runtime.procedure.conditional_function()).toBe(false)
      runtime.state.nextTrialId = '2'
      expect(runtime.procedure.conditional_function()).toBe(true)
      const config = {}
      runtime.target.on_start(config)
      expect(config.stimulus).toBe('received')
      runtime.target.on_finish({})
      expect(runtime.abortExperiment).toHaveBeenCalledWith('', {})
    },
  )

  test('a shared root target completes its branch and allows the sequence to continue', () => {
    const runtime = createTargetRuntime({ isMergePoint: true })
    expect(runtime.procedure.conditional_function()).toBe(true)
    runtime.target.on_finish({})
    expect(runtime.abortExperiment).not.toHaveBeenCalled()
    expect(runtime.state).toMatchObject({
      nextTrialId: null, skipRemaining: false, branchingActive: false,
      branchCustomParameters: null,
    })
  })

  test('an unselected root alternative stays skipped after a nested route clears its destination', () => {
    const runtime = createTargetRuntime({ isBranchTarget: true })
    runtime.state.skipRemaining = false
    runtime.state.nextTrialId = null
    runtime.state.branchingActive = false
    expect(runtime.procedure.conditional_function()).toBe(false)
    runtime.state.skipRemaining = true
    runtime.state.nextTrialId = 2
    expect(runtime.procedure.conditional_function()).toBe(true)
    expect(runtime.procedure.conditional_function()).toBe(false)
  })

  test('root alternatives include exits from any nested scope', () => {
    expect(getRootBranchTargetIds({
      timeline: [{ type: 'trial', id: 2 }, { type: 'loop', id: 'outer' }],
      trials: [{ id: 1, parentLoopId: 'inner', branches: [2, 3] }],
    })).toEqual(new Set(['2']))
  })

  test('root merges count distinct root sources, independently of loop exits', () => {
    expect(getRootMergePointIds({
      timeline: [{ type: 'trial', id: 1 }, { type: 'trial', id: 2 }, { type: 'loop', id: 'loop' }],
      trials: [
        { id: 1, branches: [3, '3', 5] }, { id: 2, branches: ['3'] },
        { id: 4, parentLoopId: 'loop', branches: [5] },
      ],
    })).toEqual(new Set(['3']))
  })
})
