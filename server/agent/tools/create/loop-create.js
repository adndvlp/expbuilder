import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb, ensureDoc } from './state.js'

import { assertLoopHasNoBranching } from '../../../routes/timeline/branchContract.js'

export const loopCreateTools = {
  // ── Loops ──────────────────────────────────────────────────────────────────

  create_loop: tool({
    description: '',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      name: z.string().min(1, 'name is required').describe('Loop display name'),
      trials: z.array(z.union([z.string(), z.number()])).describe('IDs of trials/loops inside loop'),
      repetitions: z.number().int().min(1).optional().default(1).describe('Repeat count'),
      randomize: z.boolean().optional().default(false).describe('Randomize order'),
      isConditionalLoop: z.boolean().optional().default(false).describe('Conditional loop'),
      loopConditions: z.array(z.any()).optional().describe('Loop condition rules'),
      parentLoopId: z.string().optional().describe('Nested parent loop'),
      csvJson: z.array(z.any()).optional().describe('CSV rows for timeline_variables'),
      csvColumns: z.array(z.string()).optional().describe('CSV column names'),
    }).strict(),
    execute: async (args) => {
      try {
        assertLoopHasNoBranching(args)
      } catch (error) {
        return { error: error.message, code: error.code }
      }
      const {
        experimentID, name, trials: trialIds, repetitions, randomize,
        isConditionalLoop, loopConditions, parentLoopId, csvJson, csvColumns,
      } = args
      await readDb()
      const trimmed = (name ?? '').trim()
      if (!trimmed || /^undefined$/i.test(trimmed) || /^null$/i.test(trimmed)) {
        return { error: 'Loop name required. Cannot be empty, "undefined", or "null".' }
      }
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }

      const doc = ensureDoc(experimentID)

      const id = 'loop_' + Date.now()
      const now = new Date().toISOString()
      const newLoop = {
        id,
        name,
        trials: trialIds ?? [],
        repetitions: repetitions ?? 1,
        randomize: randomize ?? false,
        orders: false,
        stimuliOrders: [],
        orderColumns: [],
        categories: false,
        categoryColumn: '',
        categoryData: [],
        isConditionalLoop: isConditionalLoop ?? false,
        ...(loopConditions !== undefined && { loopConditions }),
        ...(parentLoopId ? { parentLoopId } : {}),
        ...(csvJson !== undefined && { csvJson }),
        ...(csvColumns !== undefined && { csvColumns }),
        createdAt: now,
        updatedAt: now,
      }

      doc.loops.push(newLoop)

      if (!parentLoopId) {
        // Remove grouped trials/loops from main timeline
        doc.timeline = doc.timeline.filter(
          item => !newLoop.trials.includes(item.id),
        )

        // Add loop to timeline
        doc.timeline.push({
          id: newLoop.id,
          type: 'loop',
          name: newLoop.name,
          trials: newLoop.trials,
        })
      } else {
        // Add nested loop to outer loop's trials[]
        const outerLoop = doc.loops.find(l => l.id === parentLoopId)
        if (outerLoop && !outerLoop.trials.includes(id)) {
          outerLoop.trials.push(id)
          const tItem = doc.timeline.find(item => item.id === parentLoopId && item.type === 'loop')
          if (tItem) tItem.trials = outerLoop.trials
        }
      }

      // Sync timeline branches
      doc.timeline.forEach(item => {
        if (item.type === 'trial') {
          const t = doc.trials.find(t => t.id === item.id)
          if (t) item.branches = t.branches ?? []
        }
      })

      // Set parentLoopId on all contained trials and nested loops
      for (const tid of newLoop.trials) {
        const t = doc.trials.find(tr => tr.id === tid)
        if (t) t.parentLoopId = id
        const l = doc.loops.find(l => l.id === tid)
        if (l) l.parentLoopId = id
      }

      // If loop has CSV, mark all contained trials as csvFromLoop
      if (csvJson?.length) {
        for (const tid of newLoop.trials) {
          const t = doc.trials.find(tr => tr.id === tid)
          if (t) t.csvFromLoop = true
        }
      }

      doc.updatedAt = now
      await db.write()

      return { success: true, loop: newLoop }
    },
  }),
}
