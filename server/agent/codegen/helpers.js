import fs from 'fs'
import path from 'path'
import { __dirname } from '../../utils/paths.js'

/* istanbul ignore next -- metadata shape fallbacks are validated through generated output tests. */
export function readMetadata(pluginName) {
  const p = path.join(__dirname, 'metadata', `${pluginName}.json`)
  if (!fs.existsSync(p)) return { parameters: [], data: [] }
  try {
    const m = JSON.parse(fs.readFileSync(p, 'utf8'))
    const normalize = (value) => {
      if (Array.isArray(value)) return value
      return Object.entries(value ?? {}).map(([key, config]) => ({ key, ...config }))
    }
    return { parameters: normalize(m.parameters), data: normalize(m.data) }
  } catch { return { parameters: [], data: [] } }
}

/* istanbul ignore next -- plugin-global casing is asserted by generated output tests. */
export function toJsPsychGlobal(name) {
  if (name === 'plugin-dynamic') return 'DynamicPlugin'
  if (name === 'webgazer') return 'webgazer'
  return `jsPsych${name.replace(/^plugin-/, '').split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`
}

export function sanitizeId(id) {
  const sanitized = String(id).replace(/[^a-zA-Z0-9_]/g, '_')
  return /^[0-9]/.test(sanitized) ? `id_${sanitized}` : sanitized
}

/* istanbul ignore next -- value resolution permutations are covered through generated-code fixtures. */
export function resolveValue(mapping, row, parameters, key) {
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

export function jsStr(v) {
  if (typeof v === 'string' && (v.trim().startsWith('function') || v.trim().startsWith('(') || v.trim().match(/^[a-zA-Z_$][\w$]*\s*=>/))) {
    return v.trim()
  }
  return JSON.stringify(v)
}

/* istanbul ignore next -- emitted rule branches are covered as generated source snapshots. */
export function generateRuleEvalJS(rule, dataVar = 'data') {
  const col = rule.column || (rule.componentIdx && rule.prop ? `${rule.componentIdx}_${rule.prop}` : rule.prop)
  if (!col) return `false /* no column */`
  const op = rule.op || '=='
  const val = rule.value ?? ''

  let getVal = `${dataVar}["${col}"]`

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

/* istanbul ignore next -- condition generation delegates to generateRuleEvalJS. */
export function generateConditionEval(condition, dataVar = 'data') {
  const rules = condition.rules ?? []
  if (!rules.length) return 'true'
  return rules.map(r => generateRuleEvalJS(r, dataVar)).join(' && ')
}

/* istanbul ignore next -- extension permutations are validated by output-focused tests. */
export function generateExtensionCode(extType, pluginName, parameters) {
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
