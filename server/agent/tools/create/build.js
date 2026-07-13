import { tool } from 'ai'
import { z } from 'zod'
import { buildExperimentHtml, buildPublicExperimentHtml } from '../../codegen.js'
import { db, readDb } from './state.js'

export const buildTools = {
  // ── Build & Run ──────────────────────────────────────────────────────────────

  run_experiment: tool({
    description:
      'Build (compile) and run an experiment. Reads all trial/loop configs from the DB, generates jsPsych JavaScript code, injects it into the experiment HTML template, and returns the local experiment URL. ' +
      'The experiment is served at http://localhost:3000/{experimentName}. ' +
      'Prerequisites: experiment must have a timeline with trials/loops configured with plugins and columnMapping. ' +
      'Use create_experiment → create_trial/loop → update_trial (for columnMapping) → run_experiment.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      const result = await buildExperimentHtml(experimentID)
      return result
    },
  }),

  // ── Publish ──────────────────────────────────────────────────────────────────

  publish_experiment: tool({
    description:
      'Publish an experiment to GitHub Pages. Generates public code (CDN plugins, base64 media), builds the HTML, and sends it to the Firebase backend which creates/updates a GitHub repository with GitHub Pages enabled. ' +
      'Requires: uid (Firebase user ID) and a storage provider token (googledrive, dropbox, or osf) already configured by the user in Settings. ' +
      'Returns the public GitHub Pages URL. Prerequisites: experiment must have been built with run_experiment or have a complete timeline.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      uid: z.string().describe('Firebase user ID (required for publishing)'),
      storage: z.string().optional().describe('Storage provider: "googledrive", "dropbox", or "osf". Defaults to "googledrive".'),
    }),
    execute: async ({ experimentID, uid, storage }) => {
      const result = await buildPublicExperimentHtml(experimentID, uid, storage)
      if (result.error) return result

      const { htmlContent, experimentName, mediaFiles, uid: finalUid, storage: finalStorage } = result

      // Sanitize repo name
      const sanitizedRepoName = experimentName
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-_]/g, '')
        .toLowerCase()

      const firebaseUrl = process.env.FIREBASE_URL
      if (!firebaseUrl) return { error: 'FIREBASE_URL not configured — cannot publish' }

      try {
        const res = await fetch(`${firebaseUrl}/publishExperiment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: finalUid,
            repoName: sanitizedRepoName,
            htmlContent,
            description: `Experiment: ${experimentName}`,
            isPrivate: false,
            mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
            experimentID,
            storageProvider: finalStorage,
          }),
        })

        const data = await res.json()
        if (data.success) {
          // Save pagesUrl to experiment
          await readDb()
          const exp = db.data.experiments.find(e => e.experimentID === experimentID)
          if (exp && data.pagesUrl) {
            exp.pagesUrl = data.pagesUrl
            exp.updatedAt = new Date().toISOString()
            await db.write()
          }
          return { success: true, pagesUrl: data.pagesUrl, repoUrl: data.repoUrl }
        }
        return { success: false, error: data.message || 'Publish failed' }
      } catch (err) {
        return { success: false, error: `Publish error: ${err.message}` }
      }
    },
  }),
}
