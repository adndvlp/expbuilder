import { sanitizeId } from './helpers.js'
import { generateTrialCode } from './trial.js'

/* istanbul ignore next -- loop code generation is covered by output-focused fixture tests. */
export function generateLoopCode(loop, doc, parentLoopId) {
  if (!loop.trials?.length) return ''

  const loopId = sanitizeId(loop.id)
  const csvData = loop.csvJson?.length ? loop.csvJson : [{}]
  const rep = loop.repetitions ?? 1

  const children = []
  for (const tid of loop.trials) {
    const t = doc.trials.find(tr => tr.id === tid)
    const l = doc.loops.find(lp => lp.id === tid)
    if (t) children.push({ ...generateTrialCode(t, true, loop.csvJson, loop.id), id: tid, name: t.name, type: 'trial' })
    else if (l) children.push({ code: generateLoopCode(l, doc, loop.id), timelineRef: '', procedureRef: '', id: tid, name: l.name, type: 'loop', hasCsv: false })
  }
  const validChildren = children.filter(c => c.code)

  if (!validChildren.length) return ''

  let preCode = ''
  if (loop.orders || loop.categories) {
    preCode += `\nlet test_stimuli_${loopId} = [];\n`
    preCode += `if (typeof participantNumber === "number" && !isNaN(participantNumber)) {\n`
    preCode += `  const _stimuliOrders = ${JSON.stringify(loop.stimuliOrders || [])};\n`
    preCode += `  const _categoryData = ${JSON.stringify(loop.categoryData || [])};\n`
    preCode += `  const _allStimuli = ${JSON.stringify(csvData)};\n`
    preCode += `  if (_categoryData.length > 0) {\n`
    preCode += `    const _allCats = [...new Set(_categoryData)];\n`
    preCode += `    const _catIdx = (participantNumber - 1) % _allCats.length;\n`
    preCode += `    const _cat = _allCats[_catIdx];\n`
    preCode += `    const _indices = _categoryData.reduce((a, c, i) => { if (c === _cat) a.push(i); return a; }, []);\n`
    preCode += `    let _filtered = _indices.map(i => _allStimuli[i]);\n`
    preCode += `    if (_stimuliOrders.length > 0) {\n`
    preCode += `      const _orderIdx = (participantNumber - 1) % _stimuliOrders.length;\n`
    preCode += `      _filtered = _stimuliOrders[_orderIdx].map(i => _filtered[i]).filter(Boolean);\n`
    preCode += `    }\n`
    preCode += `    test_stimuli_${loopId} = _filtered;\n`
    preCode += `  } else if (_stimuliOrders.length > 0) {\n`
    preCode += `    const _idx = (participantNumber - 1) % _stimuliOrders.length;\n`
    preCode += `    test_stimuli_${loopId} = _stimuliOrders[_idx].filter(i => i >= 0 && i < _allStimuli.length).map(i => _allStimuli[i]);\n`
    preCode += `  }\n`
    preCode += `} else {\n`
    preCode += `  test_stimuli_${loopId} = ${JSON.stringify(csvData)};\n`
    preCode += `}\n`
  } else {
    preCode += `\nconst test_stimuli_${loopId} = ${JSON.stringify(csvData)};\n`
  }

  let childCode = ''
  const timelineRefs = []

  for (const child of validChildren) {
    childCode += child.code
    const childId = sanitizeId(child.id)
    if (child.type === 'trial' && child.hasCsv) {
      timelineRefs.push(`${childId}_wrapper`)
      childCode += `\nconst ${childId}_wrapper = {\n`
      childCode += `  timeline: [${childId}_procedure],\n`
      childCode += `  conditional_function: function() {\n`
      childCode += `    if (loop_${loopId}_SkipRemaining) {\n`
      childCode += `      if (String("${child.id}") === String(loop_${loopId}_NextTrialId)) {\n`
      childCode += `        loop_${loopId}_TargetExecuted = true;\n`
      childCode += `        return true;\n`
      childCode += `      }\n`
      childCode += `      return false;\n`
      childCode += `    }\n`
      childCode += `    if (loop_${loopId}_TargetExecuted) return false;\n`
      childCode += `    return true;\n`
      childCode += `  },\n`
      childCode += `  on_timeline_finish: function() {\n`
      childCode += `    loop_${loopId}_IterationComplete = true;\n`
      childCode += `  }\n`
      childCode += `};\n\n`
    } else if (child.type === 'trial') {
      timelineRefs.push(`${childId}_timeline`)
    } else {
      const cid = sanitizeId(child.id)
      timelineRefs.push(`${cid}_wrapper`)
      childCode += `\nconst ${cid}_wrapper = {\n`
      childCode += `  timeline: [${cid}_procedure],\n`
      childCode += `  conditional_function: function() {\n`
      childCode += `    if (loop_${loopId}_SkipRemaining) {\n`
      childCode += `      if (String("${child.id}") === String(loop_${loopId}_NextTrialId)) {\n`
      childCode += `        loop_${loopId}_TargetExecuted = true;\n`
      childCode += `        return true;\n`
      childCode += `      }\n`
      childCode += `      return false;\n`
      childCode += `    }\n`
      childCode += `    if (loop_${loopId}_TargetExecuted) return false;\n`
      childCode += `    return true;\n`
      childCode += `  }\n`
      childCode += `};\n\n`
    }
  }

  childCode += `// Branching state for loop ${loop.id}\n`
  childCode += `let loop_${loopId}_NextTrialId = null;\n`
  childCode += `let loop_${loopId}_SkipRemaining = false;\n`
  childCode += `let loop_${loopId}_TargetExecuted = false;\n`
  childCode += `let loop_${loopId}_BranchingActive = false;\n`
  childCode += `let loop_${loopId}_BranchCustomParameters = null;\n`
  childCode += `let loop_${loopId}_IterationComplete = false;\n`

  let procedure = childCode
  procedure += `\nconst ${loopId}_procedure = {\n`
  procedure += `  timeline: [${timelineRefs.join(', ')}],\n`
  procedure += `  timeline_variables: test_stimuli_${loopId},\n`
  procedure += `  sample: { type: "with-replacement", size: ${rep}${csvData.length > 1 ? ` * ${csvData.length}` : ''} },\n`
  if (loop.randomize) procedure += `  randomize_order: true,\n`

  if (loop.isConditionalLoop && loop.loopConditions?.length) {
    procedure += `  loop_function: function(data) {\n`
    procedure += `    const _loopConds = ${JSON.stringify(loop.loopConditions)};\n`
    procedure += `    for (const _lc of _loopConds) {\n`
    procedure += `      if (!_lc.rules) continue;\n`
    procedure += `      const _trials = data.values();\n`
    procedure += `      const _targetTrial = _trials.reverse().find(t => String(t.trial_id) === String(_lc.rules[0]?.trialId));\n`
    procedure += `      if (!_targetTrial) return false;\n`
    procedure += `      const _match = _lc.rules.every(_r => {\n`
    procedure += `        const _v = _targetTrial[_r.column || _r.prop];\n`
    procedure += `        const _cv = _r.value;\n`
    procedure += `        const _nv = parseFloat(_v); const _ncv = parseFloat(_cv);\n`
    procedure += `        return !isNaN(_nv) && !isNaN(_ncv) ? _nv == _ncv : _v == _cv;\n`
    procedure += `      });\n`
    procedure += `      if (_match) return true;\n`
    procedure += `    }\n`
    procedure += `    return false;\n`
    procedure += `  },\n`
  }

  const hasBranch = loop.branchConditions?.length
  const hasRepeat = loop.repeatConditions?.length
  if (hasBranch || hasRepeat) {
    procedure += `  on_finish: function(data) {\n`
    if (hasRepeat) {
      procedure += `    const _rConditions = ${JSON.stringify(loop.repeatConditions)};\n`
      procedure += `    for (const _rc of _rConditions) {\n`
      procedure += `      if (!_rc.rules) continue;\n`
      procedure += `      const _loopData = jsPsych.data.get().filter({ loop_id: "${loop.id}" }).values();\n`
      procedure += `      const _last = _loopData[_loopData.length - 1];\n`
      procedure += `      if (!_last) continue;\n`
      procedure += `      const _match = _rc.rules.every(_r => {\n`
      procedure += `        const _v = _last[_r.column || _r.prop];\n`
      procedure += `        const _cv = _r.value;\n`
      procedure += `        const _nv = parseFloat(_v); const _ncv = parseFloat(_cv);\n`
      procedure += `        return !isNaN(_nv) && !isNaN(_ncv) ? _nv == _ncv : _v == _cv;\n`
      procedure += `      });\n`
      procedure += `      if (_match && _rc.jumpToTrialId) {\n`
      procedure += `        localStorage.setItem('jsPsych_jumpToTrial', String(_rc.jumpToTrialId));\n`
      procedure += `        sessionStorage.setItem('jsPsych_jumpReload', '1');\n`
      procedure += `        window.location.reload();\n`
      procedure += `        return;\n`
      procedure += `      }\n`
      procedure += `    }\n`
    }
    if (hasBranch) {
      procedure += `    if (loop_${loopId}_ShouldBranchOnFinish) {\n`
      if (parentLoopId) {
        const pid = sanitizeId(parentLoopId)
        procedure += `      loop_${pid}_NextTrialId = loop_${loopId}_NextTrialId || ${JSON.stringify(loop.branches?.[0])};\n`
        procedure += `      loop_${pid}_SkipRemaining = true;\n`
      } else {
        procedure += `      window.nextTrialId = loop_${loopId}_NextTrialId || ${JSON.stringify(loop.branches?.[0])};\n`
        procedure += `      window.skipRemaining = true;\n`
      }
      procedure += `    }\n`
    }
    procedure += `    loop_${loopId}_NextTrialId = null;\n`
    procedure += `    loop_${loopId}_SkipRemaining = false;\n`
    procedure += `    loop_${loopId}_TargetExecuted = false;\n`
    procedure += `    loop_${loopId}_BranchingActive = false;\n`
    procedure += `    loop_${loopId}_BranchCustomParameters = null;\n`
    procedure += `    loop_${loopId}_IterationComplete = false;\n`
    procedure += `  },\n`
  }

  procedure += `  on_timeline_start: function() {\n`
  procedure += `    loop_${loopId}_NextTrialId = null;\n`
  procedure += `    loop_${loopId}_SkipRemaining = false;\n`
  procedure += `    loop_${loopId}_TargetExecuted = false;\n`
  procedure += `    loop_${loopId}_BranchingActive = false;\n`
  procedure += `    loop_${loopId}_BranchCustomParameters = null;\n`
  procedure += `    loop_${loopId}_IterationComplete = false;\n`
  procedure += `    loop_${loopId}_ShouldBranchOnFinish = false;\n`
  procedure += `    window.nextTrialId = null; window.skipRemaining = false;\n`
  procedure += `  },\n`
  procedure += `  data: { loop_id: "${loop.id}" }\n`
  procedure += `};\n`

  if (!parentLoopId) {
    procedure += `timeline.push(${loopId}_procedure);\n`
  }

  return preCode + procedure
}
