import fs from 'fs'
import path from 'path'
import * as cheerio from 'cheerio'
import { db, ensureDbData, userDataRoot } from '../utils/db.js'
import { __dirname } from '../utils/paths.js'
import { ensureTemplate } from '../utils/templates.js'
import { getPluginScriptsFromTrials } from '../utils/plugin-scripts.js'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function readMetadata(pluginName) {
  const p = path.join(__dirname, 'metadata', `${pluginName}.json`)
  if (!fs.existsSync(p)) return { parameters: [], data: [] }
  try {
    const m = JSON.parse(fs.readFileSync(p, 'utf8'))
    return { parameters: m.parameters ?? [], data: m.data ?? [] }
  } catch { return { parameters: [], data: [] } }
}

function toJsPsychGlobal(name) {
  if (name === 'plugin-dynamic') return 'DynamicPlugin'
  if (name === 'webgazer') return 'webgazer'
  return name.replace(/^plugin-/, 'jsPsych').split('-')
    .map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

function toCamelPluginRef(name) {
  return name.replace(/-/g, '_')
}

function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_]/g, '_')
}

function resolveValue(mapping, row, parameters, key) {
  if (!mapping || mapping.source === 'none') {
    const p = parameters.find(x => x.key === key)
    return p?.default ?? null
  }
  if (mapping.source === 'typed') return mapping.value ?? null
  if (mapping.source === 'csv' && row) {
    const raw = row[mapping.value]
    const p = parameters.find(x => x.key === key)
    if (!p) return raw
    if (/int|number/i.test(String(p.type))) { const n = parseInt(String(raw)); return isNaN(n) ? 0 : n }
    if (/float|decimal/i.test(String(p.type))) { const n = parseFloat(String(raw)); return isNaN(n) ? 0 : n }
    if (/bool/i.test(String(p.type))) return typeof raw === 'boolean' ? raw : String(raw).toLowerCase() === 'true' || String(raw) === '1'
    return raw
  }
  return null
}

function jsStr(v) {
  if (typeof v === 'string' && (v.trim().startsWith('function') || v.trim().startsWith('(') || v.trim().match(/^[a-zA-Z_$][\w$]*\s*=>/))) {
    return v.trim()
  }
  return JSON.stringify(v)
}

// ═══════════════════════════════════════════════════════════════════════════════
// RULE EVALUATION CODE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generateRuleEvalJS(rule, dataVar = 'data') {
  const col = rule.column || (rule.componentIdx && rule.prop ? `${rule.componentIdx}_${rule.prop}` : rule.prop)
  if (!col) return `false /* no column */`
  const op = rule.op || '=='
  const val = rule.value ?? ''

  let getVal = `${dataVar}["${col}"]`

  // Handle numeric comparison
  let code = `(function(){
  const _v = ${getVal};
  const _cv = ${jsStr(val)};
  const _nv = parseFloat(_v);
  const _ncv = parseFloat(_cv);
  const _isNum = !isNaN(_nv) && !isNaN(_ncv);`

  switch (op) {
    case '==': code += ` return _isNum ? _nv === _ncv : _v == _cv;`; break
    case '!=': code += ` return _isNum ? _nv !== _ncv : _v != _cv;`; break
    case '>':  code += ` return _isNum && _nv > _ncv;`; break
    case '<':  code += ` return _isNum && _nv < _ncv;`; break
    case '>=': code += ` return _isNum && _nv >= _ncv;`; break
    case '<=': code += ` return _isNum && _nv <= _ncv;`; break
    case 'includes': code += ` return Array.isArray(_v) ? _v.includes(_cv) : String(_v).includes(String(_cv));`; break
    default: code += ` return _v == _cv;`
  }
  code += `\n})()`
  return code
}

function generateConditionEval(condition, dataVar = 'data') {
  const rules = condition.rules ?? []
  if (!rules.length) return 'true'
  return rules.map(r => generateRuleEvalJS(r, dataVar)).join(' && ')
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENSION CODE
// ═══════════════════════════════════════════════════════════════════════════════

function generateExtensionCode(extType, pluginName, parameters) {
  if (!extType) return ''
  let targets = []

  if (extType === 'jsPsychExtensionMouseTracking') {
    targets = ['#target']
  } else if (extType === 'jsPsychExtensionWebgazer') {
    if (pluginName === 'plugin-dynamic') {
      targets = []
    } else {
      for (const p of parameters) {
        if (p.key === 'stimulus' || p.key === 'stimuli') {
          targets = [pluginName.replace(/^plugin-/, '#jspsych-').replace(/$/, p.key === 'stimulus' ? '-stimulus' : '-stimuli')]
          break
        }
      }
    }
  }

  if (extType === 'jsPsychExtensionRecordVideo') {
    return `\n      extensions: [{ type: ${extType} }],\n`
  }

  if (targets.length) {
    const tStr = targets.map(t => `"${t}"`).join(', ')
    return `\n      extensions: [{ type: ${extType}, params: { targets: [${tStr}] } }],\n`
  }

  return `\n      extensions: [{ type: ${extType} }],\n`
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIAL CODE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generateTrialCode(trial, isInLoop, loopCsvJson, loopId) {
  if (!trial.plugin) return { code: '', timelineRef: '', procedureRef: '' }

  // WebGazer: uses saved trialCode
  if (trial.plugin === 'webgazer') return { code: trial.trialCode || '', timelineRef: '', procedureRef: '' }

  const meta = readMetadata(trial.plugin)
  const parameters = meta.parameters
  const dataFields = meta.data

  const trialId = trial.id
  const trialIdStr = sanitizeId(trialId)
  const pluginGlobal = toJsPsychGlobal(trial.plugin)

  // CSV resolution
  const csvJson = trial.csvFromLoop && loopCsvJson?.length ? loopCsvJson : (trial.csvJson || [])
  const rows = csvJson.length > 0 ? csvJson : [{}]
  const hasCsv = csvJson.length > 1

  // Build trial props from columnMapping
  const buildProps = (row) => {
    const props = {}
    const cm = trial.columnMapping || {}

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
        props[param.key] = resolveValue(cm[param.key], row, param.key)
      }
    }
    return props
  }

  const rowsMapped = rows.map(r => buildProps(r))

  // ── Hook code generators ──────────────────────────────────────────────────

  // on_start: params override + custom code
  let onStartCode = ''
  if (trial.paramsOverride?.length) {
    onStartCode += `    // ── Params override ──\n`
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
    onStartCode += `    // ── User custom on_start ──\n    ${trial.customOnStart.trim()}\n`
  }

  // on_finish: branching + repeat/jump + custom code
  let onFinishCode = ''
  const hasBranches = trial.branchConditions?.length
  const hasRepeats = trial.repeatConditions?.length

  if (hasBranches) {
    onFinishCode += `    // ── Branch conditions ──\n`
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

    // Multiple branch conditions with OR logic
    if (trial.branchConditions.length > 1) {
      onFinishCode = onFinishCode.replace(
        `if (${generateConditionEval({ rules: trial.branchConditions[0].rules })})`,
        `(function() { const _bc = _bConditions.find(c => ${trial.branchConditions.map((bc, i) => generateConditionEval(bc)).join(' || ')}); return _bc; })()`
      )
      // Ugh this is getting complex. Let me just write it properly.
      onFinishCode = `    // ── Branch conditions ──\n`
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
    onFinishCode += `    // ── Repeat/Jump conditions ──\n`
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
    onFinishCode += `    // ── User custom on_finish ──\n    ${trial.customOnFinish.trim()}\n`
  }

  // ── Build trial code ──────────────────────────────────────────────────────

  let code = ''
  const dataFieldsJS = dataFields.map(d => d.key)

  const buildTrialObj = (rowMapped, useTimelineVar) => {
    let obj = ''
    obj += `    type: ${pluginGlobal},\n`

    // Extensions
    const extType = trial.parameters?.extensionType
    const includesExt = trial.parameters?.includesExtensions
    if (includesExt && extType) {
      obj += generateExtensionCode(extType, trial.plugin, parameters)
    }

    // Props
    for (const [key, val] of Object.entries(rowMapped)) {
      if (useTimelineVar) {
        obj += `    ${key}: jsPsych.timelineVariable("${key}"),\n`
      } else {
        obj += `    ${key}: ${jsStr(val)},\n`
      }
    }

    // Data
    obj += `    data: {\n      trial_id: "${trial.id}",\n      trial_name: "${trial.name}",\n      builder_id: "${trial.id}",\n      branches: ${JSON.stringify(trial.branches || [])},\n      branchConditions: ${JSON.stringify(trial.branchConditions || [])}\n`
    for (const dk of dataFieldsJS) obj += `,\n      ${dk}: "${dk}"`
    obj += `\n    }`

    // Hooks
    if (onStartCode) obj += `,\n    on_start: function(trial) {\n${onStartCode}    }`
    if (trial.customOnLoad?.trim()) obj += `,\n    on_load: function() {\n      ${trial.customOnLoad.trim()}\n    }`
    if (onFinishCode) obj += `,\n    on_finish: function(data) {\n${onFinishCode}    }`

    // Initialize
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

// ═══════════════════════════════════════════════════════════════════════════════
// LOOP CODE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generateLoopCode(loop, doc, parentLoopId) {
  if (!loop.trials?.length) return ''

  const loopId = sanitizeId(loop.id)
  const csvData = loop.csvJson?.length ? loop.csvJson : [{}]
  const hasCsv = loop.csvJson?.length > 1
  const rep = loop.repetitions ?? 1

  // ── Generate code for each child ─────────────────────────────────────────

  const children = []
  for (const tid of loop.trials) {
    const t = doc.trials.find(tr => tr.id === tid)
    const l = doc.loops.find(lp => lp.id === tid)
    if (t) children.push({ ...generateTrialCode(t, true, loop.csvJson, loop.id), id: tid, name: t.name, type: 'trial' })
    else if (l) children.push({ code: generateLoopCode(l, doc, loop.id), timelineRef: '', procedureRef: '', id: tid, name: l.name, type: 'loop', hasCsv: false })
  }
  const validChildren = children.filter(c => c.code)

  if (!validChildren.length) return ''

  // ── Orders & Categories pre-processing ────────────────────────────────────

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

  // ── Child code blocks ─────────────────────────────────────────────────────

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
      // Loop child
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

  // ── Branching flags ───────────────────────────────────────────────────────

  childCode += `// Branching state for loop ${loop.id}\n`
  childCode += `let loop_${loopId}_NextTrialId = null;\n`
  childCode += `let loop_${loopId}_SkipRemaining = false;\n`
  childCode += `let loop_${loopId}_TargetExecuted = false;\n`
  childCode += `let loop_${loopId}_BranchingActive = false;\n`
  childCode += `let loop_${loopId}_BranchCustomParameters = null;\n`
  childCode += `let loop_${loopId}_IterationComplete = false;\n`

  // ── Loop procedure ────────────────────────────────────────────────────────

  let procedure = childCode
  procedure += `\nconst ${loopId}_procedure = {\n`
  procedure += `  timeline: [${timelineRefs.join(', ')}],\n`
  procedure += `  timeline_variables: test_stimuli_${loopId},\n`
  procedure += `  sample: { type: "with-replacement", size: ${rep}${csvData.length > 1 ? ` * ${csvData.length}` : ''} },\n`
  if (loop.randomize) procedure += `  randomize_order: true,\n`

  // Conditional loop
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

  // Loop on_finish: branching + repeat/jump
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

// ═══════════════════════════════════════════════════════════════════════════════
// FULL EXPERIMENT CODE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateExperimentCode(experimentID, isPublic = false) {
  await db.read()
  ensureDbData()

  const exp = db.data.experiments.find(e => e.experimentID === experimentID)
  if (!exp) return { error: `Experiment ${experimentID} not found` }

  const doc = db.data.trials.find(t => t.experimentID === experimentID)
  if (!doc) return { error: 'No timeline data found' }

  const timeline = doc.timeline || []
  const appearance = exp.appearanceSettings || {}
  const fullScreen = appearance.fullScreen ?? true

  const experimentName = exp.name
  let uploadedUrls = []
  if (experimentName) {
    const uploadsBase = path.join(userDataRoot, experimentName)
    for (const type of ['img', 'aud', 'vid']) {
      const d = path.join(uploadsBase, type)
      if (fs.existsSync(d)) uploadedUrls.push(...fs.readdirSync(d).map(f => `${type}/${f}`))
    }
  }

  const pluginNames = new Set()
  for (const item of timeline) {
    if (item.type === 'trial') {
      const t = doc.trials.find(tr => tr.id === item.id)
      if (t?.plugin) pluginNames.add(t.plugin)
    }
  }

  let code = ''

  if (uploadedUrls.length > 0) {
    code += `timeline.push({\n  type: jsPsychPreload,\n  files: ${JSON.stringify(uploadedUrls)}\n});\n\n`
  }

  if (fullScreen) {
    code += `timeline.push({\n  type: jsPsychFullscreen,\n  fullscreen_mode: true\n});\n\n`
  }

  for (const item of timeline) {
    if (item.type === 'trial') {
      const t = doc.trials.find(tr => tr.id === item.id)
      if (t) code += generateTrialCode(t, false).code + '\n'
    } else if (item.type === 'loop') {
      const l = doc.loops.find(lp => lp.id === item.id)
      if (l) code += generateLoopCode(l, doc, null) + '\n'
    }
  }

  code += 'jsPsych.run(timeline);\n'

  if (isPublic) {
    const { scriptUrls, styleUrls } = getPluginScriptsFromTrials(
      doc.trials.map(t => ({ plugin: t.plugin }))
    )
    return { code, experimentName, fullScreen, backgroundColor: appearance.backgroundColor, scriptUrls, styleUrls, uploadedUrls, pluginNames: [...pluginNames] }
  }

  return { code, experimentName, fullScreen, backgroundColor: appearance.backgroundColor, uploadedUrls, pluginNames: [...pluginNames] }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD HTML
// ═══════════════════════════════════════════════════════════════════════════════

export async function buildExperimentHtml(experimentID) {
  const result = await generateExperimentCode(experimentID, false)
  if (result.error) return result

  const { code, experimentName, backgroundColor } = result
  const experimentsHtmlDir = path.join(userDataRoot, 'experiments_html')
  if (!fs.existsSync(experimentsHtmlDir)) fs.mkdirSync(experimentsHtmlDir, { recursive: true })

  const templatePath = ensureTemplate('experiment_template.html')
  const htmlPath = path.join(experimentsHtmlDir, `${experimentName}.html`)
  fs.copyFileSync(templatePath, htmlPath)

  let html = fs.readFileSync(htmlPath, 'utf8')
  const $ = cheerio.load(html)
  $('style#canvas-styles').remove()
  if (backgroundColor) {
    $('head').append(`<style id="canvas-styles">\n  body { background-color: ${backgroundColor}; }\n</style>`)
  }
  $('script#generated-script').remove()
  $('body').append(`<script id="generated-script">\nconst timeline = [];\n\n${code}\n</script>`)
  fs.writeFileSync(htmlPath, $.html())

  return { success: true, experimentUrl: `http://localhost:3000/${encodeURIComponent(experimentName)}`, htmlPath }
}

export async function buildPublicExperimentHtml(experimentID, uid, storage) {
  const result = await generateExperimentCode(experimentID, true)
  if (result.error) return result

  const { code, experimentName, backgroundColor, scriptUrls, styleUrls } = result

  const experimentsHtmlDir = path.join(userDataRoot, 'experiments_html')
  const templatePath = ensureTemplate('experiment_template.html')
  const htmlPath = path.join(experimentsHtmlDir, `${experimentName}_public.html`)
  fs.copyFileSync(templatePath, htmlPath)

  let html = fs.readFileSync(htmlPath, 'utf8')
  const $ = cheerio.load(html)
  $('link[href*="jspsych-bundle"]').remove()
  $('script[src*="jspsych-bundle"]').remove()
  $('script[src*="webgazer"]').remove()
  $('script[src*="dynamicplugin"]').remove()
  $('head').append('<link href="https://unpkg.com/jspsych@8.2.2/css/jspsych.css" rel="stylesheet" />')
  $('head').append('<script src="https://unpkg.com/jspsych@8.2.2"></script>')
  let dv = '1.0.2'
  try { dv = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'dynamicplugin/package.json'), 'utf8')).version } catch {}
  $('head').append(`<script src="https://unpkg.com/jspsych-expbuilder-plugin-dynamic@${dv}/dist/index.iife.js"></script>`)
  for (const u of styleUrls) $('head').append(`<link rel="stylesheet" href="${u}" />`)
  for (const u of scriptUrls) $('head').append(`<script src="${u}"></script>`)

  $('style#canvas-styles').remove()
  if (backgroundColor) $('head').append(`<style id="canvas-styles">\n  body { background-color: ${backgroundColor}; }\n</style>`)
  $('script#generated-script').remove()
  $('body').append(`<script id="generated-script">\nconst timeline = [];\n\n${code}\n</script>`)
  fs.writeFileSync(htmlPath, $.html())

  const finalHtml = $.html()

  const uploadsBase = path.join(userDataRoot, experimentName)
  let mediaFiles = []
  for (const type of ['img', 'vid', 'aud']) {
    const d = path.join(uploadsBase, type)
    if (fs.existsSync(d)) {
      for (const fn of fs.readdirSync(d)) {
        try { mediaFiles.push({ type, filename: fn, content: fs.readFileSync(path.join(d, fn)).toString('base64') }) } catch {}
      }
    }
  }

  if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath)

  return { success: true, htmlContent: finalHtml, experimentName, mediaFiles, uid, storage: storage || 'googledrive' }
}
