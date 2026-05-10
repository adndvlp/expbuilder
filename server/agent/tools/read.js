import { tool } from 'ai'
import { z } from 'zod'
import { db, ensureDbData } from '../../utils/db.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function readDb() {
  await db.read()
  ensureDbData()
}

function getDoc(experimentID) {
  return db.data.trials.find(t => t.experimentID === experimentID) ?? null
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export const readTools = {

  // ── Experiments ────────────────────────────────────────────────────────────

  list_experiments: tool({
    description:
      'List all experiments. Returns: experimentID, name, description, author, storage, pagesUrl, tunnelUrl, appearanceSettings, trialCount, loopCount, sessionCount, createdAt, updatedAt.',
    parameters: z.object({}),
    execute: async () => {
      await readDb()
      return db.data.experiments
        .map(exp => {
          const doc = getDoc(exp.experimentID)
          const sessionCount = db.data.sessionResults.filter(
            s => s.experimentID === exp.experimentID,
          ).length
          return {
            experimentID: exp.experimentID,
            name: exp.name,
            description: exp.description ?? null,
            author: exp.author ?? null,
            storage: exp.storage ?? null,
            pagesUrl: exp.pagesUrl ?? null,
            tunnelUrl: exp.tunnelUrl ?? null,
            appearanceSettings: exp.appearanceSettings ?? null,
            trialCount: doc?.trials?.length ?? 0,
            loopCount: doc?.loops?.length ?? 0,
            sessionCount,
            createdAt: exp.createdAt,
            updatedAt: exp.updatedAt,
          }
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },
  }),

  get_experiment: tool({
    description:
      'Get full metadata for one experiment: all Experiment fields (name, description, author, storage, pagesUrl, tunnelUrl, tunnelSettings, appearanceSettings) plus trialCount, loopCount, sessionCount.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }
      const doc = getDoc(experimentID)
      const sessionCount = db.data.sessionResults.filter(
        s => s.experimentID === experimentID,
      ).length
      return {
        ...exp,
        trialCount: doc?.trials?.length ?? 0,
        loopCount: doc?.loops?.length ?? 0,
        sessionCount,
      }
    },
  }),

  // ── Timeline ───────────────────────────────────────────────────────────────

  get_timeline: tool({
    description:
      'Get the ordered top-level timeline for an experiment. Each item: { id, type ("trial"|"loop"), name, branches[], trials[] (loops only) }. Loops contain trial IDs — use get_loop to expand them.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { timeline: [], message: 'No timeline yet' }
      return { timeline: doc.timeline ?? [] }
    },
  }),

  // ── Trials ─────────────────────────────────────────────────────────────────

  list_trials: tool({
    description:
      'List all trials and loops (flat) for an experiment. Trials: id, name, plugin, parentLoopId, branches[], conditionCounts (branchConditions, repeatConditions, paramsOverride). Loops: id, name, trialIds[], parentLoopId, branches[], repetitions, isConditionalLoop. Use get_trial / get_loop for full data.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { trials: [], loops: [] }
      return {
        trials: doc.trials.map(t => ({
          id: t.id,
          name: t.name,
          plugin: t.plugin ?? null,
          parentLoopId: t.parentLoopId ?? null,
          branches: t.branches ?? [],
          branchConditionCount: t.branchConditions?.length ?? 0,
          repeatConditionCount: t.repeatConditions?.length ?? 0,
          paramsOverrideCount: t.paramsOverride?.length ?? 0,
          hasCustomCode: !!(t.customInitialize || t.customOnStart || t.customOnLoad || t.customOnFinish),
          csvFromLoop: t.csvFromLoop ?? false,
        })),
        loops: doc.loops.map(l => ({
          id: l.id,
          name: l.name,
          trialIds: l.trials ?? [],
          parentLoopId: l.parentLoopId ?? null,
          branches: l.branches ?? [],
          repetitions: l.repetitions ?? 1,
          randomize: l.randomize ?? false,
          isConditionalLoop: l.isConditionalLoop ?? false,
          loopConditionCount: l.loopConditions?.length ?? 0,
          hasCsv: (l.csvJson?.length ?? 0) > 0,
        })),
      }
    },
  }),

  get_trial: tool({
    description:
      'Get complete data for one trial. Key fields: plugin (e.g. "plugin-dynamic", "plugin-html-keyboard-response"), columnMapping (source of truth for all parameter values — for DynamicPlugin this contains components[], response_components[] arrays with full component configs including survey_json for SurveyComponent), branches[], branchConditions[], repeatConditions[], paramsOverride[], customOnStart/Finish/Load/Initialize code, csvFromLoop, parentLoopId. Note: trialCode is generated dynamically at runtime via the code generation pipeline (useTrialCode → TrialCodeGenerators, see 13-CODE_GENERATION.md) — not stored in DB, except for WebGazer trials.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      trialId: z.number().describe('Numeric trial ID from list_trials'),
    }),
    execute: async ({ experimentID, trialId }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { error: 'Experiment not found' }
      const trial = doc.trials.find(t => t.id === trialId)
      if (!trial) return { error: `Trial ${trialId} not found` }
      return { trial }
    },
  }),

  // ── Loops ──────────────────────────────────────────────────────────────────

  get_loop: tool({
    description:
      'Get complete data for one loop: repetitions, randomize, csvJson, csvColumns, orders, stimuliOrders, orderColumns, categories, categoryColumn, categoryData, trials (IDs + resolved name/plugin), branches, branchConditions, repeatConditions, isConditionalLoop, loopConditions, parentLoopId, customOnTimelineStart/Finish.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      loopId: z.string().describe('Loop ID — starts with "loop_"'),
    }),
    execute: async ({ experimentID, loopId }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { error: 'Experiment not found' }
      const loop = doc.loops.find(l => l.id === loopId)
      if (!loop) return { error: `Loop ${loopId} not found` }
      const trialDetails = (loop.trials ?? []).map(id => {
        const t = doc.trials.find(tr => tr.id === id)
        return t
          ? { id: t.id, name: t.name, plugin: t.plugin ?? null }
          : { id, name: 'unknown', plugin: null }
      })
      return { loop: { ...loop, trialDetails } }
    },
  }),

  // ── Config ─────────────────────────────────────────────────────────────────

  get_config: tool({
    description:
      'Get experiment config: isDevMode, isSaveMode, sessionNameConfig (tokens + separator), and the data object (may contain cached generatedCode).',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await readDb()
      const configDoc = db.data.configs.find(c => c.experimentID === experimentID)
      if (!configDoc)
        return { config: null, isDevMode: false, isSaveMode: false, sessionNameConfig: null }
      return {
        config: configDoc.data ?? null,
        isDevMode: configDoc.isDevMode ?? false,
        isSaveMode: configDoc.isSaveMode ?? false,
        sessionNameConfig: configDoc.sessionNameConfig ?? null,
      }
    },
  }),

  // ── Sessions ───────────────────────────────────────────────────────────────

  list_sessions: tool({
    description:
      'List session metadata (no raw trial data) for an experiment: sessionId, state (initiated|in-progress|completed), participantNumber, trialCount, createdAt, lastUpdate, isOnline, browser metadata.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await readDb()
      const sessions = db.data.sessionResults
        .filter(s => s.experimentID === experimentID)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((s, i) => ({
          sessionId: s.sessionId,
          state: s.state,
          participantNumber: i + 1,
          trialCount: s.data?.length ?? 0,
          createdAt: s.createdAt,
          lastUpdate: s.lastUpdate,
          isOnline: s.isOnline ?? false,
          metadata: s.metadata ?? {},
        }))
      return { sessions, total: sessions.length }
    },
  }),

  get_session: tool({
    description:
      'Get full data for one session including all trial response objects. Use list_sessions first to get sessionId. Note: data array can be large.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      sessionId: z.string().describe('Session ID from list_sessions'),
    }),
    execute: async ({ experimentID, sessionId }) => {
      await readDb()
      const session = db.data.sessionResults.find(
        s => s.experimentID === experimentID && s.sessionId === sessionId,
      )
      if (!session) return { error: `Session ${sessionId} not found` }
      return { session }
    },
  }),

  // ── Plugins ────────────────────────────────────────────────────────────────

  list_plugins: tool({
    description:
      'List available plugin types. Returns: native jsPsych plugins (from server/metadata/), custom user plugins (from DB), and DynamicPlugin component types. IMPORTANT: surveys must use DynamicPlugin with SurveyComponent (survey_json) — native survey plugins (plugin-survey-*) are no longer used. Useful before creating a trial to know what plugin to use.',
    parameters: z.object({}),
    execute: async () => {
      await readDb()
      const nativePlugins = [
        'plugin-animation', 'plugin-audio-button-response', 'plugin-audio-keyboard-response',
        'plugin-audio-slider-response', 'plugin-browser-check', 'plugin-call-function',
        'plugin-canvas-button-response', 'plugin-canvas-keyboard-response', 'plugin-canvas-slider-response',
        'plugin-categorize-animation', 'plugin-categorize-html', 'plugin-categorize-image',
        'plugin-cloze', 'plugin-external-html', 'plugin-free-sort', 'plugin-fullscreen',
        'plugin-html-audio-response', 'plugin-html-button-response', 'plugin-html-keyboard-response',
        'plugin-html-slider-response', 'plugin-html-video-response', 'plugin-iat-html', 'plugin-iat-image',
        'plugin-image-button-response', 'plugin-image-keyboard-response', 'plugin-image-slider-response',
        'plugin-initialize-camera', 'plugin-initialize-microphone', 'plugin-instructions',
        'plugin-maxdiff', 'plugin-mirror-camera', 'plugin-multi-image-keyboard-response',
        'plugin-preload', 'plugin-reconstruction', 'plugin-resize',
        'plugin-same-different-html', 'plugin-same-different-image', 'plugin-serial-reaction-time',
        'plugin-serial-reaction-time-mouse', 'plugin-sketchpad',
        'plugin-video-button-response', 'plugin-video-keyboard-response',
        'plugin-video-slider-response', 'plugin-virtual-chinrest', 'plugin-visual-search-circle',
        'plugin-webgazer-calibrate', 'plugin-webgazer-init-camera', 'plugin-webgazer-recalibrate',
        'plugin-webgazer-validate',
      ]
      const dynamicComponents = {
        stimulus: ['ImageComponent', 'TextComponent', 'HtmlComponent', 'AudioComponent', 'VideoComponent', 'SketchpadComponent'],
        response: ['ButtonResponseComponent', 'KeyboardResponseComponent', 'SliderResponseComponent', 'ClickResponseComponent', 'InputResponseComponent', 'AudioResponseComponent', 'FileUploadResponseComponent', 'SurveyComponent'],
        note: 'SurveyComponent is the canonical way to collect survey data. Use survey_json (SurveyJS format) inside a plugin-dynamic trial. See 07-DYNAMIC_PLUGIN.md for full schema and examples.',
      }
      const customPlugins = (db.data.pluginConfigs ?? []).map(p => ({
        name: p.name,
        id: p.id,
      }))
      return { nativePlugins, dynamicPlugin: { pluginId: 'plugin-dynamic', components: dynamicComponents }, customPlugins }
    },
  }),
}
