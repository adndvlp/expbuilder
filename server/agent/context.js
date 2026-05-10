import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = path.resolve(__dirname, '../../docs')

// Load all markdown docs at startup
const DOC_FILES = [
  { id: '01-architecture',     file: '01-ARCHITECTURE.md',     keywords: ['architecture', 'stack', 'electron', 'express', 'directory', 'structure', 'tech'] },
  { id: '02-data-model',       file: '02-DATA_MODEL.md',       keywords: ['data model', 'schema', 'experiment', 'trial', 'loop', 'timeline', 'db', 'database', 'type', 'field', 'struct'] },
  { id: '03-api',              file: '03-API.md',              keywords: ['api', 'endpoint', 'route', 'request', 'response', 'post', 'get', 'patch', 'delete', 'put'] },
  { id: '04-plugins',          file: '04-PLUGINS.md',          keywords: ['plugin', 'jspsych', 'native', 'html-keyboard', 'audio', 'video', 'image', 'survey', 'parameters'] },
  { id: '05-trials-loops',     file: '05-TRIALS_AND_LOOPS.md', keywords: ['trial', 'loop', 'create', 'add', 'repetition', 'randomize', 'csv', 'orders', 'categories', 'nested', 'parent'] },
  { id: '06-branching',        file: '06-BRANCHING.md',        keywords: ['branch', 'condition', 'jump', 'jumpto', 'repeat', 'conditional', 'rule', 'on_finish', 'next trial', 'params override', 'paramsoverride'] },
  { id: '07-dynamic-plugin',   file: '07-DYNAMIC_PLUGIN.md',   keywords: ['dynamic', 'plugin-dynamic', 'component', 'image', 'text', 'button', 'slider', 'keyboard', 'survey', 'canvas', 'response', 'stimulus'] },
  { id: '08-execution',        file: '08-EXECUTION.md',        keywords: ['run', 'execute', 'preview', 'html', 'generated', 'build', 'trial code', 'trialcode'] },
  { id: '09-client-server',    file: '09-CLIENT_SERVER.md',    keywords: ['client', 'server', 'frontend', 'backend', 'context', 'hook', 'fetch', 'socket'] },
  { id: '10-experiment-config',file: '10-EXPERIMENT_CONFIG.md',keywords: ['config', 'settings', 'appearance', 'background', 'fullscreen', 'session name', 'devmode', 'savemode', 'initjspsych'] },
  { id: '11-devmode',          file: '11-DEVMODE.md',          keywords: ['devmode', 'dev mode', 'development', 'console', 'debug', 'inspector'] },
  { id: '12-publish',          file: '12-PUBLISH_FLOW.md',     keywords: ['publish', 'github', 'pages', 'deploy', 'firebase', 'cdn', 'public', 'online'] },
  { id: '13-code-generation',  file: '13-CODE_GENERATION.md',  keywords: ['code generation', 'survey', 'surveyjs', 'survey_json', 'elements', 'rating', 'radiogroup', 'checkbox', 'dropdown', 'imagepicker', 'trialcode', 'generate', 'pipeline', 'usetrialcode', 'useloopcode'] },
]

// Always injected regardless of query — core context every agent call needs
const ANCHOR_IDS = new Set(['02-data-model', '03-api', '05-trials-loops'])

// Load file contents once at module init
const CHUNKS = DOC_FILES.map(({ id, file, keywords }) => {
  const filePath = path.join(DOCS_DIR, file)
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : `[${file} not found]`
  return { id, title: file.replace('.md', ''), content, keywords }
})

function score(chunk, tokens) {
  return chunk.keywords.reduce((acc, kw) => {
    return acc + (tokens.some(t => t.includes(kw)) ? 1 : 0)
  }, 0)
}

/**
 * Returns markdown string: anchor docs + top-K scored docs based on userMessage.
 * @param {string} userMessage
 * @param {number} topK
 */
export function retrieveRelevantDocs(userMessage, topK = 3) {
  const tokens = userMessage.toLowerCase().split(/\W+/).filter(Boolean)

  const anchors = []
  const candidates = []

  for (const chunk of CHUNKS) {
    if (ANCHOR_IDS.has(chunk.id)) {
      anchors.push(chunk)
    } else {
      candidates.push({ chunk, score: score(chunk, tokens) })
    }
  }

  const top = candidates
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(c => c.chunk)

  return [...anchors, ...top]
    .map(c => `## ${c.title}\n\n${c.content}`)
    .join('\n\n---\n\n')
}
