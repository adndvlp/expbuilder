import { describe, expect, test } from '@jest/globals'
import { generateLoopCode } from '../../agent/codegen/loop.js'
import { generateTrialBranching } from '../../agent/codegen/trialBranching.js'

const trial = {
  id: 'loop_trial', name: 'Target', plugin: 'plugin-html-button-response',
  parameters: {}, csvFromLoop: true,
  columnMapping: {
    stimulus: { source: 'csv', value: 'stimulus' },
    choices: { source: 'typed', value: ['Continue'] },
  },
}
const doc = {
  trials: [trial],
  loops: [
    { id: 'outer', trials: ['inner'], repetitions: 2 },
    { id: 'inner', trials: ['loop_trial'], repetitions: 2,
      parentLoopId: 'outer', csvJson: [{ stimulus: 'row1' }, { stimulus: 'row2' }] },
  ],
}
const codeFor = (loop = doc.loops[0]) => generateLoopCode(loop, doc, null)

describe('agent trial-only loop codegen', () => {
  test('does not generate loop-owned branch flags or legacy branch fallback', () => {
    const code = codeFor({
      ...doc.loops[0], branches: ['legacy'],
      branchConditions: [{ rules: [], nextTrialId: 'legacy' }],
    })
    expect(code).not.toMatch(/ShouldBranchOnFinish|HasBranches|IterationComplete|legacy/)
  })

  test.each(['outer', 'inner', 'loop_trial'])(
    'only a trial ID can activate a route through nested containers: %s', target => {
      const runtime = new Function('window', `
        const timeline = [];
        const jsPsychHtmlButtonResponse = {};
        const jsPsych = { timelineVariable: () => null };
        const localStorage = { getItem: () => null };
        ${codeFor()}
        return { enter: () => outer_procedure.conditional_function() };
      `)({ skipRemaining: true, nextTrialId: target })
      expect(runtime.enter()).toBe(target === 'loop_trial')
    },
  )

  test('loops own CSV iteration and repetition; child trials do not iterate the same CSV again', () => {
    const code = codeFor()
    const runtime = new Function(`
      const timeline = [];
      const jsPsychHtmlButtonResponse = {};
      const jsPsych = { timelineVariable: key => ({ key }) };
      ${code}
      return { inner: inner_procedure, child: loop_trial_wrapper.timeline[0] };
    `)()
    expect(runtime.inner.timeline_variables).toEqual(doc.loops[1].csvJson.map(row => expect.objectContaining(row)))
    expect(runtime.inner.repetitions).toBe(2)
    expect(runtime.inner.sample).toBeUndefined()
    expect(runtime.child.timeline_variables).toBeUndefined()
  })

  test('a numeric zero loop ID remains the parent and appends only its root procedure', () => {
    const outer = { ...doc.loops[0], id: 0 }
    const code = generateLoopCode(outer, { ...doc, loops: [outer, doc.loops[1]] }, null)
    const timelines = new Function(`
      const timeline = [];
      const jsPsychHtmlButtonResponse = {};
      const jsPsych = { timelineVariable: () => null };
      ${code}
      return timeline;
    `)()
    expect(timelines).toHaveLength(1)
    expect(code).toContain('loop_id_0_NextTrialId = pendingBranchTarget')
  })

  test.each([
    ['second', 2, { stimulus: { value: 'selected' } }],
    ['fallthrough', 1, { stimulus: { value: 'fallback payload' } }],
    ['unmatched', 1, null],
  ])('trial conditions preserve their destination, fallback and parameters: %s', (response, target, parameters) => {
    const conditions = [
      { rules: [{ column: 'response', op: '==', value: 'first' }], nextTrialId: 1 },
      { rules: [{ column: 'response', op: '==', value: 'second' }], nextTrialId: 2,
        customParameters: { stimulus: { value: 'selected' } } },
      { rules: [{ column: 'response', op: '==', value: 'fallthrough' }], nextTrialId: null,
        customParameters: { stimulus: { value: 'fallback payload' } } },
    ]
    const code = generateTrialBranching({ branches: [1, 2], branchConditions: conditions }, 'scope')
    const run = new Function('data', `
      let loop_scope_NextTrialId = null;
      let loop_scope_SkipRemaining = false;
      let loop_scope_BranchingActive = false;
      let loop_scope_TargetExecuted = true;
      let loop_scope_BranchCustomParameters = { stale: true };
      ${code}
      return { target: loop_scope_NextTrialId,
        parameters: loop_scope_BranchCustomParameters,
        executed: loop_scope_TargetExecuted };
    `)
    expect(run({ response })).toEqual({ target, parameters, executed: false })
  })
})
