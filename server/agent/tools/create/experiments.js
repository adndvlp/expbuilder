import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb, userDataRoot } from './state.js'

export const experimentTools = {
  // ── Experiments ────────────────────────────────────────────────────────────

  create_experiment: tool({
    description: '',
    parameters: z.object({
      name: z.string().min(1, 'name is required').describe('Experiment name'),
      description: z.string().optional().describe('Short description'),
      author: z.string().optional().describe('Author name'),
    }),
    execute: async ({ name, description, author }) => {
      await readDb()
      const trimmed = (name ?? '').trim()
      if (!trimmed || /^undefined$/i.test(trimmed) || /^null$/i.test(trimmed)) {
        return { error: 'Experiment name required. Cannot be empty, "undefined", or "null".' }
      }
      const experimentID = uuidv4()
      const now = new Date().toISOString()
      const experiment = {
        experimentID,
        name: trimmed,
        ...(description !== undefined && { description }),
        ...(author !== undefined && { author }),
        createdAt: now,
        updatedAt: now,
      }
      db.data.experiments.push(experiment)
      await db.write()
      return { success: true, experiment }
    },
  }),

  update_experiment: tool({
    description: '',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      updates: z.record(z.any()).describe('Fields to update'),
    }),
    execute: async ({ experimentID, updates }) => {
      await readDb()
      const idx = db.data.experiments.findIndex(e => e.experimentID === experimentID)
      if (idx === -1) return { error: `Experiment ${experimentID} not found` }
      if (updates.name !== undefined) {
        const t = (updates.name ?? '').trim()
        if (!t || /^undefined$/i.test(t) || /^null$/i.test(t)) return { error: 'Name cannot be empty, "undefined", or "null".' }
        updates.name = t
      }
      db.data.experiments[idx] = {
        ...db.data.experiments[idx],
        ...updates,
        experimentID,
        updatedAt: new Date().toISOString(),
      }
      await db.write()
      return { success: true, experiment: db.data.experiments[idx] }
    },
  }),

  delete_experiment: tool({
    description:
      'Delete an experiment and ALL its related data: trials, loops, timeline, configs, session results, participant file records. ' +
      'Also removes on-disk HTML files and the uploads directory for this experiment. ' +
      'This is irreversible. Does NOT call Firebase/GitHub — published repos are unaffected.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID to delete'),
    }),
    execute: async ({ experimentID }) => {
      await readDb()
      const experiment = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!experiment) return { error: `Experiment ${experimentID} not found` }

      // Remove from all collections
      db.data.experiments = db.data.experiments.filter(e => e.experimentID !== experimentID)
      db.data.trials = db.data.trials.filter(t => t.experimentID !== experimentID)
      db.data.configs = db.data.configs.filter(c => c.experimentID !== experimentID)
      db.data.sessionResults = db.data.sessionResults.filter(s => s.experimentID !== experimentID)
      db.data.participantFiles = (db.data.participantFiles ?? []).filter(f => f.experimentID !== experimentID)
      await db.write()

      // Clean up HTML files
      if (experiment.name) {
        const expHtmlDir = path.join(userDataRoot, 'experiments_html')
        const previewHtmlDir = path.join(userDataRoot, 'trials_previews_html')
        const expHtml = path.join(expHtmlDir, `${experiment.name}.html`)
        const previewHtml = path.join(previewHtmlDir, `${experiment.name}.html`)
        if (fs.existsSync(expHtml)) fs.unlinkSync(expHtml)
        if (fs.existsSync(previewHtml)) fs.unlinkSync(previewHtml)

        // Remove uploads directory
        const uploadsDir = path.join(userDataRoot, experiment.name)
        if (fs.existsSync(uploadsDir)) fs.rmSync(uploadsDir, { recursive: true, force: true })
      }

      return { success: true, deletedExperimentID: experimentID }
    },
  }),

  update_experiment_config: tool({
    description:
      'Save or update the config doc for an experiment. Creates the doc if it does not exist. ' +
      'All parameters are optional — only the ones you pass are updated (PATCH semantics on the config doc). ' +
      'isDevMode: show DevTools panel during run. ' +
      'isSaveMode: auto-save session results to DB. ' +
      'customCode: arbitrary JS injected at the END of the generated experiment script (runs after jsPsych.run). ' +
      'customPreInitCode: JS injected BEFORE jsPsych.initJsPsych() — for global vars, external library setup, hardware init. Separate local/public variants. ' +
      'customInitJsPsychParams: key-value overrides merged into the jsPsych.initJsPsych() call. Separate local/public variants. ' +
      'sessionNameConfig: token-based formula for auto-naming session files.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      isDevMode: z.boolean().optional().describe('Show developer toolbar during experiment run'),
      isSaveMode: z.boolean().optional().describe('Auto-save participant results to DB'),
      customCode: z.string().optional().describe('JS code injected at the end of the generated experiment script (after jsPsych.run)'),
      customPreInitCode: z.object({
        local: z.string().optional().describe('Code run before initJsPsych() in local builds'),
        public: z.string().optional().describe('Code run before initJsPsych() in published builds'),
      }).optional().describe('JS injected before jsPsych.initJsPsych() — for global setup, hardware init, external libraries'),
      customInitJsPsychParams: z.object({
        local: z.record(z.string()).optional().describe('Key-value overrides for initJsPsych() in local builds, e.g. { "show_progress_bar": "true" }'),
        public: z.record(z.string()).optional().describe('Key-value overrides for initJsPsych() in published builds'),
      }).optional().describe('Overrides merged into jsPsych.initJsPsych() call'),
      sessionNameConfig: z.object({
        tokens: z.array(z.any()).describe('Array of token objects (type: "date"|"time"|"randomAlpha"|"customText"|"counter", value, format, length, digits)'),
        separator: z.string().describe('Separator between tokens: "_", "-", or ""'),
      }).optional().describe('Formula for auto-constructing participant session filenames'),
    }),
    execute: async ({ experimentID, isDevMode, isSaveMode, customCode, customPreInitCode, customInitJsPsychParams, sessionNameConfig }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }

      const now = new Date().toISOString()
      const idx = db.data.configs.findIndex(c => c.experimentID === experimentID)

      if (idx !== -1) {
        const existing = db.data.configs[idx]
        const existingData = existing.data ?? {}

        // Merge data sub-fields
        const newData = { ...existingData }
        if (customCode !== undefined) newData.customCode = customCode
        if (customPreInitCode !== undefined) {
          newData.customPreInitCode = {
            ...(existingData.customPreInitCode ?? { local: '', public: '' }),
            ...customPreInitCode,
          }
        }
        if (customInitJsPsychParams !== undefined) {
          newData.customInitJsPsychParams = {
            ...(existingData.customInitJsPsychParams ?? { local: {}, public: {} }),
            ...customInitJsPsychParams,
          }
        }

        db.data.configs[idx] = {
          ...existing,
          data: newData,
          ...(isDevMode !== undefined && { isDevMode }),
          ...(isSaveMode !== undefined && { isSaveMode }),
          ...(sessionNameConfig !== undefined && { sessionNameConfig }),
          updatedAt: now,
        }
      } else {
        const data = {}
        if (customCode !== undefined) data.customCode = customCode
        if (customPreInitCode !== undefined) data.customPreInitCode = { local: '', public: '', ...customPreInitCode }
        if (customInitJsPsychParams !== undefined) data.customInitJsPsychParams = { local: {}, public: {}, ...customInitJsPsychParams }

        db.data.configs.push({
          experimentID,
          data,
          isDevMode: isDevMode ?? false,
          isSaveMode: isSaveMode ?? false,
          ...(sessionNameConfig !== undefined && { sessionNameConfig }),
          createdAt: now,
          updatedAt: now,
        })
      }

      await db.write()
      const saved = db.data.configs.find(c => c.experimentID === experimentID)
      return { success: true, config: saved }
    },
  }),
}
