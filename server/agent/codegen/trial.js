import {
  generateConditionEval,
  generateExtensionCode,
  generateRuleEvalJS,
  jsStr,
  readMetadata,
  resolveValue,
  sanitizeId,
  toJsPsychGlobal,
} from './helpers.js'

/* istanbul ignore next -- trial code generation is covered by output-focused fixture tests. */
export function generateTrialCode(trial, isInLoop, loopCsvJson, loopId) {
  if (!trial.plugin) return { code: '', timelineRef: '', procedureRef: '' }

  if (trial.plugin === 'webgazer') return { code: trial.trialCode || '', timelineRef: '', procedureRef: '' }

  const meta = readMetadata(trial.plugin)
  const parameters = meta.parameters
  const dataFields = meta.data

  const trialId = trial.id
  const trialIdStr = sanitizeId(trialId)
  const pluginGlobal = toJsPsychGlobal(trial.plugin)

  const csvJson = trial.csvFromLoop && loopCsvJson?.length ? loopCsvJson : (trial.csvJson || [])
  const rows = csvJson.length > 0 ? csvJson : [{}]
  const hasCsv = csvJson.length > 1

  const buildProps = (row) => {
    const props = {}
    const cm = trial.columnMapping || {}
    const tp = trial.parameters || {}

    if (trial.plugin === 'plugin-dynamic') {
      for (const key of Object.keys(cm)) {
        const val = cm[key]?.value
        if (key === 'components' || key === 'response_components') {
          if (Array.isArray(val)) {
            props[key] = val.map(comp => {
              const resolved = {}
              for (const ck of Object.keys(comp)) {
                resolved[ck] = resolveValue(comp[ck], row, parameters, ck)
              }
              return resolved
            })
          }
        } else {
          props[key] = resolveValue(cm[key], row, parameters, key)
        }
      }
    } else {
      for (const param of parameters) {
        const cmVal = resolveValue(cm[param.key], row, parameters, param.key)
        props[param.key] = cmVal !== null && cmVal !== undefined ? cmVal : (tp[param.key] ?? null)
      }
    }
    return props
  }

  const rowsMapped = rows.map(r => buildProps(r))

  let onStartCode = ''
  if (trial.paramsOverride?.length) {
    onStartCode += `    // -- Params override --\n`
    onStartCode += `    const _lastData = jsPsych.data.get().last(1).values()[0];\n`
    for (const cond of trial.paramsOverride) {
      const condEvalJS = cond.rules?.length
        ? cond.rules.map(r => {
            const trialRef = `_prevTrial_${sanitizeId(r.trialId)}`
            return `(() => {
  const ${trialRef} = jsPsych.data.get().filter({ trial_id: "${r.trialId}" }).values().pop();
  if (!${trialRef}) return false;
  return ${generateRuleEvalJS(r, trialRef)};
})()`
          }).join(' && ')
        : 'true'
      onStartCode += `    if (${condEvalJS}) {\n`
      if (cond.paramsToOverride) {
        for (const [k, v] of Object.entries(cond.paramsToOverride)) {
          const resolved = v.source === 'typed' ? jsStr(v.value) : v.value
          onStartCode += `      trial.${k} = ${resolved};\n`
        }
      }
      onStartCode += `    }\n`
    }
  }
  if (trial.customOnStart?.trim()) {
    onStartCode += `    // -- User custom on_start --\n    ${trial.customOnStart.trim()}\n`
  }

  let onFinishCode = ''
  const hasBranches = trial.branchConditions?.length
  const hasRepeats = trial.repeatConditions?.length

  if (hasBranches) {
    onFinishCode += `    // -- Branch conditions --\n`
    onFinishCode += `    const _bConditions = ${JSON.stringify(trial.branchConditions)};\n`
    onFinishCode += `    for (const _bc of _bConditions) {\n`
    onFinishCode += `      if (${generateConditionEval({ rules: trial.branchConditions[0].rules })}) {\n`
    onFinishCode += `        if (_bc.nextTrialId) {\n`
    if (trial.branchConditions.some(bc => bc.customParameters && Object.keys(bc.customParameters).length > 0)) {
      onFinishCode += `          jsPsych.data.get().push({ next_trial_params: _bc.customParameters || {} });\n`
    }
    if (isInLoop) {
      const lid = sanitizeId(loopId)
      onFinishCode += `          loop_${lid}_NextTrialId = _bc.nextTrialId;\n`
      onFinishCode += `          loop_${lid}_SkipRemaining = true;\n`
      onFinishCode += `          loop_${lid}_BranchingActive = true;\n`
      onFinishCode += `          if (_bc.customParameters) loop_${lid}_BranchCustomParameters = _bc.customParameters;\n`
    } else {
      onFinishCode += `          window.nextTrialId = _bc.nextTrialId;\n`
      onFinishCode += `          window.skipRemaining = true;\n`
      onFinishCode += `          window.branchingActive = true;\n`
      onFinishCode += `          if (_bc.customParameters) window.branchCustomParameters = _bc.customParameters;\n`
    }
    onFinishCode += `          return;\n`
    onFinishCode += `        }\n      }\n    }\n`

    if (trial.branchConditions.length > 1) {
      onFinishCode = `    // -- Branch conditions --\n`
      onFinishCode += `    const _bConditions = ${JSON.stringify(trial.branchConditions)};\n`
      onFinishCode += `    for (const _bc of _bConditions) {\n`
      onFinishCode += `      if (!_bc.rules) continue;\n`
      onFinishCode += `      const _allMatch = _bc.rules.every(_r => {\n`
      onFinishCode += `        return (function() {\n`
      onFinishCode += `          const _v = data[_r.column || _r.prop];\n`
      onFinishCode += `          const _cv = _r.value;\n`
      onFinishCode += `          const _nv = parseFloat(_v);\n`
      onFinishCode += `          const _ncv = parseFloat(_cv);\n`
      onFinishCode += `          const _isNum = !isNaN(_nv) && !isNaN(_ncv);\n`
      onFinishCode += `          switch (_r.op) {\n`
      onFinishCode += `            case '==': return _isNum ? _nv === _ncv : _v == _cv;\n`
      onFinishCode += `            case '!=': return _isNum ? _nv !== _ncv : _v != _cv;\n`
      onFinishCode += `            case '>':  return _isNum && _nv > _ncv;\n`
      onFinishCode += `            case '<':  return _isNum && _nv < _ncv;\n`
      onFinishCode += `            case '>=': return _isNum && _nv >= _ncv;\n`
      onFinishCode += `            case '<=': return _isNum && _nv <= _ncv;\n`
      onFinishCode += `            case 'includes': return Array.isArray(_v) ? _v.includes(_cv) : String(_v).includes(String(_cv));\n`
      onFinishCode += `            default: return _v == _cv;\n`
      onFinishCode += `          }\n`
      onFinishCode += `        })();\n`
      onFinishCode += `      });\n`
      onFinishCode += `      if (_allMatch && _bc.nextTrialId) {\n`
      if (trial.branchConditions.some(bc => bc.customParameters && Object.keys(bc.customParameters).length > 0)) {
        onFinishCode += `        if (_bc.customParameters) jsPsych.data.get().push({ next_trial_params: _bc.customParameters });\n`
      }
      if (isInLoop) {
        const lid = sanitizeId(loopId)
        onFinishCode += `        loop_${lid}_NextTrialId = _bc.nextTrialId;\n`
        onFinishCode += `        loop_${lid}_SkipRemaining = true;\n`
        onFinishCode += `        loop_${lid}_BranchingActive = true;\n`
        onFinishCode += `        if (_bc.customParameters) loop_${lid}_BranchCustomParameters = _bc.customParameters;\n`
      } else {
        onFinishCode += `        window.nextTrialId = _bc.nextTrialId;\n`
        onFinishCode += `        window.skipRemaining = true;\n`
        onFinishCode += `        window.branchingActive = true;\n`
        onFinishCode += `        if (_bc.customParameters) window.branchCustomParameters = _bc.customParameters;\n`
      }
      onFinishCode += `        return;\n      }\n    }\n`
    }
  }

  if (hasRepeats) {
    onFinishCode += `    // -- Repeat/Jump conditions --\n`
    onFinishCode += `    const _rConditions = ${JSON.stringify(trial.repeatConditions)};\n`
    onFinishCode += `    for (const _rc of _rConditions) {\n`
    onFinishCode += `      if (!_rc.rules) continue;\n`
    onFinishCode += `      const _allMatch = _rc.rules.every(_r => {\n`
    onFinishCode += `        const _v = data[_r.column || _r.prop];\n`
    onFinishCode += `        const _cv = _r.value;\n`
    onFinishCode += `        const _nv = parseFloat(_v); const _ncv = parseFloat(_cv);\n`
    onFinishCode += `        const _isNum = !isNaN(_nv) && !isNaN(_ncv);\n`
    onFinishCode += `        if (_r.op === '==') return _isNum ? _nv === _ncv : _v == _cv;\n`
    onFinishCode += `        if (_r.op === '!=') return _isNum ? _nv !== _ncv : _v != _cv;\n`
    onFinishCode += `        return _v == _cv;\n`
    onFinishCode += `      });\n`
    onFinishCode += `      if (_allMatch && _rc.jumpToTrialId) {\n`
    onFinishCode += `        localStorage.setItem('jsPsych_jumpToTrial', String(_rc.jumpToTrialId));\n`
    onFinishCode += `        sessionStorage.setItem('jsPsych_jumpReload', '1');\n`
    onFinishCode += `        window.location.reload();\n`
    onFinishCode += `        return;\n`
    onFinishCode += `      }\n    }\n`
  }

  if (trial.customOnFinish?.trim()) {
    onFinishCode += `    // -- User custom on_finish --\n    ${trial.customOnFinish.trim()}\n`
  }

  let code = ''
  const dataFieldsJS = dataFields.map(d => d.key)

  const buildTrialObj = (rowMapped, useTimelineVar) => {
    let obj = ''
    obj += `    type: ${pluginGlobal},\n`

    const extType = trial.parameters?.extensionType
    const includesExt = trial.parameters?.includesExtensions
    if (includesExt && extType) {
      obj += generateExtensionCode(extType, trial.plugin, parameters)
    }

    for (const [key, val] of Object.entries(rowMapped)) {
      if (useTimelineVar) {
        obj += `    ${key}: jsPsych.timelineVariable("${key}"),\n`
      } else {
        obj += `    ${key}: ${jsStr(val)},\n`
      }
    }

    obj += `    data: {\n      trial_id: "${trial.id}",\n      trial_name: "${trial.name}",\n      builder_id: "${trial.id}",\n      branches: ${JSON.stringify(trial.branches || [])},\n      branchConditions: ${JSON.stringify(trial.branchConditions || [])}\n`
    for (const dk of dataFieldsJS) obj += `,\n      ${dk}: "${dk}"`
    obj += `\n    }`

    if (onStartCode) obj += `,\n    on_start: function(trial) {\n${onStartCode}    }`
    if (trial.customOnLoad?.trim()) obj += `,\n    on_load: function() {\n      ${trial.customOnLoad.trim()}\n    }`
    if (onFinishCode) obj += `,\n    on_finish: function(data) {\n${onFinishCode}    }`

    if (trial.customInitialize?.trim()) obj += `,\n    initialize: async function() {\n      ${trial.customInitialize.trim()}\n    }`

    return obj
  }

  if (hasCsv) {
    code += `const test_stimuli_${trialIdStr} = ${JSON.stringify(rowsMapped)};\n\n`
    code += `const ${trialIdStr}_timeline = {\n`
    code += buildTrialObj(rowsMapped[0], true)
    code += `\n};\n\n`
    code += `const ${trialIdStr}_procedure = {\n`
    code += `  timeline: [${trialIdStr}_timeline],\n`
    code += `  timeline_variables: test_stimuli_${trialIdStr}\n`
    code += `};\n`
    code += `timeline.push(${trialIdStr}_procedure);\n`
  } else {
    code += `timeline.push({\n`
    code += buildTrialObj(rowsMapped[0], false)
    code += `\n});\n`
  }

  return {
    code,
    timelineRef: hasCsv ? `${trialIdStr}_timeline` : '',
    procedureRef: hasCsv ? `${trialIdStr}_procedure` : '',
    hasCsv,
  }
}
