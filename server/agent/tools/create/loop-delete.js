import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb, getDoc } from './state.js'
import { findLoop } from '../../../routes/timeline/graph/identity.js'
import { ungroupLoop } from '../../../routes/timeline/loops/mutations.js'

export const loopDeleteTools = {
  delete_loop: tool({
    description:
      'Delete a loop and restore its ordered contents at its original position in the parent scope. ' +
      'Preserve all connections between trials and keep nested loops intact.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      loopId: z.string().describe('Loop ID — starts with "loop_"'),
    }),
    execute: async ({ experimentID, loopId }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { error: `Experiment ${experimentID} not found` }

      const loopToDelete = findLoop(doc, loopId)
      if (!loopToDelete) return { error: `Loop ${loopId} not found` }

      ungroupLoop(doc, loopToDelete)

      doc.updatedAt = new Date().toISOString()
      await db.write()

      return { success: true, deletedLoopId: loopId }
    },
  }),
}
