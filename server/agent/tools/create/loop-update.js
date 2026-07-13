import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb, getDoc } from './state.js'

export const loopUpdateTools = {
  update_loop: tool({
    description:
      'Update one or more fields on an existing loop (PATCH semantics). ' +
      'If trials[] changes, new trial IDs are pulled from the main timeline into the loop. ' +
      'If csvJson is added/removed, csvFromLoop is updated on all child trials automatically. ' +
      'Commonly updated: name, repetitions, randomize, csvJson, csvColumns, branches, loopConditions, isConditionalLoop, customOnTimelineStart, customOnTimelineFinish.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      loopId: z.string().describe('Loop ID — starts with "loop_"'),
      updates: z.record(z.any()).describe('Fields to update. E.g. { "repetitions": 3 } or { "csvJson": [...], "csvColumns": ["stimulus","condition"] }.'),
    }),
    execute: async ({ experimentID, loopId, updates }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { error: `Experiment ${experimentID} not found` }

      const idx = doc.loops.findIndex(l => l.id === loopId)
      if (idx === -1) return { error: `Loop ${loopId} not found` }

      // Capture prevTrials BEFORE the merge
      const prevTrials = doc.loops[idx].trials ?? []

      const now = new Date().toISOString()
      doc.loops[idx] = {
        ...doc.loops[idx],
        ...updates,
        id: loopId,
        updatedAt: now,
      }

      const loop = doc.loops[idx]

      // Sync timeline entry
      const tIdx = doc.timeline.findIndex(item => item.id === loopId && item.type === 'loop')
      if (tIdx !== -1) {
        if (updates.name !== undefined) doc.timeline[tIdx].name = updates.name
        if (updates.branches !== undefined) doc.timeline[tIdx].branches = updates.branches
        if (updates.trials !== undefined) {
          doc.timeline[tIdx].trials = updates.trials
          // Pull any newly-added trials out of the main timeline
          doc.timeline = doc.timeline.filter(
            item => !(item.type === 'trial' && updates.trials.includes(item.id)),
          )
        }
      }

      // Sync parentLoopId when trials array changes
      if (updates.trials !== undefined) {
        const nextTrials = updates.trials

        // Clear parentLoopId on removed items
        const removed = prevTrials.filter(id => !nextTrials.includes(id))
        for (const tid of removed) {
          const t = doc.trials.find(tr => tr.id === tid)
          if (t) t.parentLoopId = null
          const l = doc.loops.find(l => l.id === tid)
          if (l) l.parentLoopId = null
        }

        // Set parentLoopId on added items AND remove them from any other loop's trials[]
        const added = nextTrials.filter(id => !prevTrials.includes(id))
        for (const tid of added) {
          const t = doc.trials.find(tr => tr.id === tid)
          if (t) {
            // If this trial was already in another loop, remove it from there
            if (t.parentLoopId && t.parentLoopId !== loopId) {
              const oldLoop = doc.loops.find(l => l.id === t.parentLoopId)
              if (oldLoop && oldLoop.trials) {
                oldLoop.trials = oldLoop.trials.filter(id => id !== tid)
                const oldTl = doc.timeline.find(item => item.id === t.parentLoopId && item.type === 'loop')
                if (oldTl) oldTl.trials = oldLoop.trials
              }
            }
            t.parentLoopId = loopId
          }
          const l = doc.loops.find(l => l.id === tid)
          if (l) {
            if (l.parentLoopId && l.parentLoopId !== loopId) {
              const oldLoop = doc.loops.find(ol => ol.id === l.parentLoopId)
              if (oldLoop && oldLoop.trials) {
                oldLoop.trials = oldLoop.trials.filter(id => id !== tid)
                const oldTl = doc.timeline.find(item => item.id === l.parentLoopId && item.type === 'loop')
                if (oldTl) oldTl.trials = oldLoop.trials
              }
            }
            l.parentLoopId = loopId
          }
        }
      }

      // Sync csvFromLoop on child trials when csvJson changes
      if (updates.csvJson !== undefined) {
        const hasCsv = (updates.csvJson?.length ?? 0) > 0
        for (const tid of loop.trials ?? []) {
          const t = doc.trials.find(tr => tr.id === tid)
          if (t) t.csvFromLoop = hasCsv
        }
      }

      doc.updatedAt = now
      await db.write()

      return { success: true, loop: doc.loops[idx] }
    },
  }),
}
