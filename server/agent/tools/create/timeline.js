import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb, getDoc } from './state.js'

import { assertTimelineBranching } from '../../../routes/timeline/branchContract.js'

export const timelineTools = {
  // ── Timeline ───────────────────────────────────────────────────────────────

  reorder_timeline: tool({
    description:
      'Replace the top-level timeline order for an experiment. ' +
      'Use this after creating multiple trials/loops to put them in the correct sequence. ' +
      'Each item must be a valid TimelineItem already in the experiment (do not invent IDs). ' +
      'Use get_timeline first to get the current order, then pass the reordered array. ' +
      'Only affects top-level timeline — loop-internal order is controlled by the loop\'s trials[] array (use update_loop for that).',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      timeline: z.array(z.discriminatedUnion('type', [
        z.object({
          id: z.union([z.string(), z.number()]),
          type: z.literal('trial'),
          name: z.string(),
          branches: z.array(z.union([z.string(), z.number()])).optional(),
          parentLoopId: z.string().nullable().optional(),
        }).strict(),
        z.object({
          id: z.string(),
          type: z.literal('loop'),
          name: z.string(),
          trials: z.array(z.union([z.string(), z.number()])).optional(),
          parentLoopId: z.string().nullable().optional(),
        }).strict(),
      ])).describe('Full ordered array of top-level timeline items. Every existing top-level item must be included — omitting an item removes it from the view.'),
    }),
    execute: async ({ experimentID, timeline }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { error: `Experiment ${experimentID} not found` }

      try {
        assertTimelineBranching(doc, timeline)
      } catch (error) {
        return { error: error.message, code: error.code }
      }
      doc.timeline = timeline
      doc.updatedAt = new Date().toISOString()
      await db.write()

      return { success: true, timeline }
    },
  }),
}
