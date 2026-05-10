import { DOC_SECTIONS } from './docs-content.js'

// Sections always injected regardless of query
const ANCHOR_IDS = new Set(['timeline', 'data-format', 'api-reference'])

// Keywords that raise score for each section
const SECTION_KEYWORDS = {
  anatomy:           ['html', 'template', 'generated', 'script', 'bundle'],
  'session-local':   ['session', 'local', 'socket', 'participant', 'sessionid'],
  'session-public':  ['publish', 'firebase', 'github pages', 'captcha', 'prolific', 'mturk'],
  overlays:          ['overlay', 'loading', 'success', 'spinner'],
  timeline:          ['timeline', 'trial', 'procedure', 'structure', 'order'],
  'dynamic-plugin':  ['dynamic', 'plugin', 'custom plugin', 'dynamicplugin'],
  'survey-component':['survey', 'surveyjs', 'form', 'questionnaire', 'likert'],
  branching:         ['branch', 'condition', 'conditional', 'jump', 'if'],
  resume:            ['resume', 'continue', 'restart', 'localstorage', 'reload'],
  'conditional-loops':['loop', 'while', 'repeat', 'condition'],
  'nested-loops':    ['nested', 'loop', 'inner loop', 'outer loop'],
  'init-jspsych':    ['initjspsych', 'init', 'settings', 'configuration', 'on_finish'],
  'custom-code':     ['custom code', 'inject', 'javascript', 'on_start', 'on_finish'],
  extensions:        ['extension', 'mouse tracking', 'webcam', 'record'],
  webgazer:          ['webgazer', 'eye tracking', 'gaze', 'calibration'],
  csv:               ['csv', 'column', 'mapping', 'data column', 'export'],
  counterbalancing:  ['counterbalance', 'order', 'category', 'latin square', 'group'],
  plugins:           ['plugin', 'jspsych-', 'stimulus', 'response', 'rt'],
  publish:           ['publish', 'github', 'pages', 'deploy', 'upload'],
  'data-format':     ['data', 'format', 'json', 'result', 'response', 'rt'],
  'api-reference':   ['api', 'endpoint', 'route', 'internal', 'reference'],
  troubleshooting:   ['error', 'bug', 'not working', 'fix', 'problem', 'slow', 'cors'],
}

function score(section, tokens) {
  const keywords = SECTION_KEYWORDS[section.id] ?? []
  return keywords.reduce((acc, kw) => {
    return acc + (tokens.some(t => t.includes(kw)) ? 1 : 0)
  }, 0)
}

/**
 * Returns markdown string: anchor sections + top-K relevant sections.
 * @param {string} userMessage
 * @param {number} topK
 */
export function retrieveRelevantDocs(userMessage, topK = 3) {
  const tokens = userMessage.toLowerCase().split(/\s+/)

  const anchors = []
  const candidates = []

  for (const section of DOC_SECTIONS) {
    if (ANCHOR_IDS.has(section.id)) {
      anchors.push(section)
    } else {
      candidates.push({ section, score: score(section, tokens) })
    }
  }

  const top = candidates
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(c => c.section)

  return [...anchors, ...top]
    .map(s => `## ${s.title}\n\n${s.content}`)
    .join('\n\n---\n\n')
}
