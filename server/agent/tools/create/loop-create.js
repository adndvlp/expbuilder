import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb, getDoc } from './state.js'
import { allocateLoopId } from '../../../routes/timeline/graph/itemIds.js'
import { groupItemsInLoop } from '../../../routes/timeline/loops/mutations.js'

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

      const now = new Date().toISOString()
      const existingDoc = getDoc(experimentID)
      const doc = existingDoc ?? { experimentID, trials: [], loops: [], timeline: [], createdAt: now }
      const id = allocateLoopId(doc)
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

      try {
        groupItemsInLoop(doc, newLoop)
      } catch (error) {
        return { error: error.message, code: error.code }
      }
      if (!existingDoc) db.data.trials.push(doc)

      doc.updatedAt = now
      await db.write()

      return { success: true, loop: newLoop }
    },
  }),
}
