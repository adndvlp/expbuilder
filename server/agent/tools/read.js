import { tool } from 'ai'
import { z } from 'zod'
import { db, ensureDbData } from '../../utils/db.js'

export const readTools = {
  list_experiments: tool({
    description:
      'List all experiments in the database with name, ID, description, trial count, loop count, and session count.',
    parameters: z.object({}),
    execute: async () => {
      await db.read()
      ensureDbData()
      return db.data.experiments
        .map(exp => {
          const doc = db.data.trials.find(t => t.experimentID === exp.experimentID)
          const sessionCount = db.data.sessionResults.filter(
            s => s.experimentID === exp.experimentID,
          ).length
          return {
            experimentID: exp.experimentID,
            name: exp.name,
            description: exp.description ?? null,
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
      'Get full metadata for one experiment: name, description, appearanceSettings, pagesUrl, storage, timestamps, trial/loop/session counts.',
    parameters: z.object({
      experimentID: z.string().describe('The experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await db.read()
      ensureDbData()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }
      const doc = db.data.trials.find(t => t.experimentID === experimentID)
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

  get_timeline: tool({
    description:
      'Get the ordered top-level timeline for an experiment. Each item has id, type ("trial"|"loop"), name, and branches. Loops also include their contained trial IDs.',
    parameters: z.object({
      experimentID: z.string().describe('The experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await db.read()
      ensureDbData()
      const doc = db.data.trials.find(t => t.experimentID === experimentID)
      if (!doc) return { timeline: [], message: 'No timeline yet for this experiment' }
      return { timeline: doc.timeline ?? [] }
    },
  }),

  list_trials: tool({
    description:
      'List all trials and loops (flat arrays) for an experiment. Trials show id, name, plugin, branches, parentLoopId. Loops show id, name, trial IDs they contain, branches. Use this for an overview before fetching full data with get_trial or get_loop.',
    parameters: z.object({
      experimentID: z.string().describe('The experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await db.read()
      ensureDbData()
      const doc = db.data.trials.find(t => t.experimentID === experimentID)
      if (!doc) return { trials: [], loops: [] }
      return {
        trials: doc.trials.map(t => ({
          id: t.id,
          name: t.name,
          plugin: t.plugin,
          branches: t.branches ?? [],
          parentLoopId: t.parentLoopId ?? null,
        })),
        loops: doc.loops.map(l => ({
          id: l.id,
          name: l.name,
          trials: l.trials ?? [],
          branches: l.branches ?? [],
          parentLoopId: l.parentLoopId ?? null,
        })),
      }
    },
  }),

  get_trial: tool({
    description:
      'Get full data for a specific trial: plugin name, all parameters, branches, trialCode, columnMapping. Call list_trials first to get the numeric trial ID.',
    parameters: z.object({
      experimentID: z.string().describe('The experiment UUID'),
      trialId: z.number().describe('Numeric trial ID'),
    }),
    execute: async ({ experimentID, trialId }) => {
      await db.read()
      ensureDbData()
      const doc = db.data.trials.find(t => t.experimentID === experimentID)
      if (!doc) return { error: 'Experiment not found' }
      const trial = doc.trials.find(t => t.id === trialId)
      if (!trial) return { error: `Trial ${trialId} not found` }
      return { trial }
    },
  }),

  get_loop: tool({
    description:
      'Get full data for a specific loop: loopConfig (repetitions, conditional function, etc.), trial IDs with their names/plugins, branches, generated code.',
    parameters: z.object({
      experimentID: z.string().describe('The experiment UUID'),
      loopId: z.string().describe('Loop ID string — starts with "loop_"'),
    }),
    execute: async ({ experimentID, loopId }) => {
      await db.read()
      ensureDbData()
      const doc = db.data.trials.find(t => t.experimentID === experimentID)
      if (!doc) return { error: 'Experiment not found' }
      const loop = doc.loops.find(l => l.id === loopId)
      if (!loop) return { error: `Loop ${loopId} not found` }
      const trialDetails = (loop.trials ?? []).map(id => {
        const t = doc.trials.find(tr => tr.id === id)
        return t ? { id: t.id, name: t.name, plugin: t.plugin } : { id, name: 'unknown' }
      })
      return { loop: { ...loop, trialDetails } }
    },
  }),

  get_config: tool({
    description:
      'Get the saved jsPsych init config for an experiment: isDevMode, isSaveMode, sessionNameConfig (tokens + separator), and the generatedCode config object.',
    parameters: z.object({
      experimentID: z.string().describe('The experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await db.read()
      ensureDbData()
      const configDoc = db.data.configs.find(c => c.experimentID === experimentID)
      if (!configDoc) return { config: null, isDevMode: false, isSaveMode: false, sessionNameConfig: null }
      return {
        config: configDoc.data,
        isDevMode: configDoc.isDevMode,
        isSaveMode: configDoc.isSaveMode ?? false,
        sessionNameConfig: configDoc.sessionNameConfig ?? null,
      }
    },
  }),

  list_sessions: tool({
    description:
      'List session results metadata (no raw trial data) for an experiment: sessionId, state (initiated|in-progress|completed), participantNumber, trial count, timestamps.',
    parameters: z.object({
      experimentID: z.string().describe('The experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await db.read()
      ensureDbData()
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
        }))
      return { sessions, total: sessions.length }
    },
  }),
}
