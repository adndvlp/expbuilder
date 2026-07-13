import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb, getDoc, findLastItems } from './state.js'

export const loopDeleteTools = {
  delete_loop: tool({
    description:
      'Delete a loop and restore its contents to the timeline at the loop\'s original position. ' +
      'Smart reconnect: parents of the loop get connected to the first item inside the loop; ' +
      'the last item inside the loop inherits the loop\'s own branches. ' +
      'Child trials\' parentLoopId is cleared. Nested loops\' parentLoopId is also cleared.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      loopId: z.string().describe('Loop ID — starts with "loop_"'),
    }),
    execute: async ({ experimentID, loopId }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { error: `Experiment ${experimentID} not found` }

      const loopToDelete = doc.loops.find(l => l.id === loopId)
      if (!loopToDelete) return { error: `Loop ${loopId} not found` }

      const loopTimelineIdx = doc.timeline.findIndex(item => item.id === loopId && item.type === 'loop')
      const firstId = loopToDelete.trials?.[0] ?? null
      const loopBranches = loopToDelete.branches ?? []

      // Reconnect parents → first item inside loop
      if (firstId) {
        doc.trials.forEach(t => {
          if (t.branches?.includes(loopId)) {
            t.branches = t.branches.map(bid => bid === loopId ? firstId : bid)
          }
        })
        doc.loops.forEach(l => {
          if (l.branches?.includes(loopId)) {
            l.branches = l.branches.map(bid => bid === loopId ? firstId : bid)
          }
        })
      } else {
        doc.trials.forEach(t => {
          if (t.branches?.includes(loopId)) t.branches = t.branches.filter(bid => bid !== loopId)
        })
        doc.loops.forEach(l => {
          if (l.branches?.includes(loopId)) l.branches = l.branches.filter(bid => bid !== loopId)
        })
      }

      // Connect loop's branches to the last item inside the loop
      if (loopBranches.length > 0 && loopToDelete.trials?.length) {
        const lastItems = findLastItems(loopToDelete.trials, doc.trials, doc.loops)
        const lastId = lastItems[lastItems.length - 1]
        const lt = doc.trials.find(t => t.id === lastId)
        const ll = doc.loops.find(l => l.id === lastId)
        const target = lt ?? ll
        if (target) {
          const cur = target.branches ?? []
          loopBranches.forEach(bid => { if (!cur.includes(bid)) cur.push(bid) })
          target.branches = cur
        }
      }

      // Remove loop from arrays
      doc.loops = doc.loops.filter(l => l.id !== loopId)
      doc.timeline = doc.timeline.filter(item => !(item.id === loopId && item.type === 'loop'))

      // Restore children to timeline at original position
      if (loopTimelineIdx !== -1) {
        const toInsert = []

        doc.trials.forEach(t => {
          if (t.parentLoopId === loopId) {
            t.parentLoopId = null
            toInsert.push({ id: t.id, type: 'trial', name: t.name, branches: t.branches ?? [] })
          }
        })
        doc.loops.forEach(l => {
          if (l.parentLoopId === loopId) {
            l.parentLoopId = null
            toInsert.push({ id: l.id, type: 'loop', name: l.name, branches: l.branches ?? [], trials: l.trials ?? [] })
          }
        })

        if (toInsert.length > 0) doc.timeline.splice(loopTimelineIdx, 0, ...toInsert)
      }

      // Final branch sync across timeline
      doc.timeline.forEach(item => {
        if (item.type === 'trial') {
          const t = doc.trials.find(t => t.id === item.id)
          if (t) item.branches = t.branches ?? []
        } else if (item.type === 'loop') {
          const l = doc.loops.find(l => l.id === item.id)
          if (l) item.branches = l.branches ?? []
        }
      })

      doc.updatedAt = new Date().toISOString()
      await db.write()

      return { success: true, deletedLoopId: loopId }
    },
  }),
}
