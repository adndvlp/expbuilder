import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb, getDoc } from './state.js'
import { findLoop } from '../../../routes/timeline/graph/identity.js'
import { updateLoop } from '../../../routes/timeline/loops/mutations.js'

import { assertLoopHasNoBranching } from '../../../routes/timeline/branchContract.js'

export const loopUpdateTools = {
  update_loop: tool({
    description:
      'Update one or more fields on an existing loop (PATCH semantics). ' +
      'Membership edits preserve trial connections and restore removed children beside the loop in its parent scope. ' +
      'If csvJson is added/removed, csvFromLoop is updated on all child trials automatically. ' +
      'Commonly updated: name, repetitions, randomize, csvJson, csvColumns, loopConditions, isConditionalLoop, customOnTimelineStart, customOnTimelineFinish.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      loopId: z.string().describe('Loop ID — starts with "loop_"'),
      updates: z.record(z.any()).describe('Fields to update. E.g. { "repetitions": 3 } or { "csvJson": [...], "csvColumns": ["stimulus","condition"] }.'),
    }),
    execute: async ({ experimentID, loopId, updates }) => {
      try {
        assertLoopHasNoBranching(updates)
      } catch (error) {
        return { error: error.message, code: error.code }
      }
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { error: `Experiment ${experimentID} not found` }

      const currentLoop = findLoop(doc, loopId)
      if (!currentLoop) return { error: `Loop ${loopId} not found` }

      let loop
      try {
        loop = updateLoop(doc, currentLoop, updates)
      } catch (error) {
        return { error: error.message, code: error.code }
      }
      const now = new Date().toISOString()
      doc.updatedAt = now
      await db.write()

      return { success: true, loop }
    },
  }),
}
