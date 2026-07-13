import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb, getDoc, ensureDoc, columnMappingEntrySchema } from './state.js'

export const trialTools = {
  // ── Create ─────────────────────────────────────────────────────────────────

  create_trial: tool({
    description: '',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      name: z.string().min(1, 'name is required').describe('Trial display name'),
      plugin: z.string().min(1).describe('Plugin id'),
      parameters: z.record(z.any()).optional().describe('Plugin params. Auto-converted to columnMapping.'),
      columnMapping: z.record(columnMappingEntrySchema).optional().describe('{ param: { source:"csv"|"typed"|"none", value } }'),
      parentLoopId: z.string().optional().describe('Parent loop ID'),
      branches: z.array(z.union([z.string(), z.number()])).optional().describe('Branch target IDs'),
    }),
    execute: async ({ experimentID, name, plugin, parameters, columnMapping, parentLoopId, branches }) => {
      await readDb()
      const trimmed = (name ?? '').trim()
      if (!trimmed || /^undefined$/i.test(trimmed) || /^null$/i.test(trimmed)) {
        return { error: 'Trial name required. Cannot be empty, "undefined", or "null".' }
      }
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }

      const doc = ensureDoc(experimentID)

      const id = Date.now()
      const now = new Date().toISOString()

      // Convert parameters to columnMapping format for codegen compatibility
      const finalColumnMapping = { ...(columnMapping || {}) }
      if (parameters && typeof parameters === 'object') {
        for (const [key, value] of Object.entries(parameters)) {
          if (finalColumnMapping[key] === undefined) {
            finalColumnMapping[key] = { source: 'typed', value }
          }
        }
      }

      const newTrial = {
        id,
        name,
        type: 'trial',
        plugin: plugin ?? null,
        parameters: parameters ?? {},
        columnMapping: Object.keys(finalColumnMapping).length > 0 ? finalColumnMapping : undefined,
        branches: branches ?? [],
        ...(parentLoopId ? { parentLoopId } : {}),
        createdAt: now,
        updatedAt: now,
      }

      doc.trials.push(newTrial)

      if (!parentLoopId) {
        doc.timeline.push({
          id,
          type: 'trial',
          name,
          branches: newTrial.branches,
        })
      } else {
        // Add to parent loop's trials[] so the loop knows about it
        const parentLoop = doc.loops.find(l => l.id === parentLoopId)
        if (parentLoop && !parentLoop.trials.includes(id)) {
          parentLoop.trials.push(id)
          // Also sync the loop's timeline entry if it exists
          const tItem = doc.timeline.find(item => item.id === parentLoopId && item.type === 'loop')
          if (tItem) tItem.trials = parentLoop.trials
          // If parent loop has CSV, mark trial as csvFromLoop
          if ((parentLoop.csvJson?.length ?? 0) > 0) newTrial.csvFromLoop = true
        }
      }

      doc.updatedAt = now
      await db.write()

      return { success: true, trial: newTrial }
    },
  }),

  // ── Update ─────────────────────────────────────────────────────────────────

  update_trial: tool({
    description:
      'Update one or more fields on an existing trial. Only provided fields are changed (PATCH semantics). ' +
      'Commonly updated fields: name, plugin, parameters, columnMapping, branches, branchConditions, repeatConditions, paramsOverride, ' +
      'customInitialize, customOnStart, customOnLoad, customOnFinish, csvJson, csvColumns, csvFromLoop. ' +
      'If name or branches change, the timeline entry is also updated automatically.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      trialId: z.number().describe('Numeric trial ID from create_trial or list_trials'),
      updates: z.record(z.any()).describe(
        'Object with the fields to update. E.g. { "name": "New Name" } or { "columnMapping": { "stimulus": { "source": "csv", "value": "img_col" } } }. ' +
        'For branchConditions/repeatConditions/paramsOverride pass the full updated array.',
      ),
    }),
    execute: async ({ experimentID, trialId, updates }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { error: `Experiment ${experimentID} not found` }

      const idx = doc.trials.findIndex(t => t.id === trialId)
      if (idx === -1) return { error: `Trial ${trialId} not found` }

      const now = new Date().toISOString()
      doc.trials[idx] = {
        ...doc.trials[idx],
        ...updates,
        id: trialId,
        updatedAt: now,
      }

      // Keep timeline in sync
      if (updates.name !== undefined || updates.branches !== undefined) {
        const tIdx = doc.timeline.findIndex(item => item.id === trialId && item.type === 'trial')
        if (tIdx !== -1) {
          if (updates.name !== undefined) doc.timeline[tIdx].name = updates.name
          if (updates.branches !== undefined) doc.timeline[tIdx].branches = updates.branches
        }
      }

      doc.updatedAt = now
      await db.write()

      return { success: true, trial: doc.trials[idx] }
    },
  }),
  // ── Delete ─────────────────────────────────────────────────────────────────

  delete_trial: tool({
    description:
      'Delete a trial and clean up all references. Smart reconnect: any trial/loop that had this trial in its branches[] will inherit the deleted trial\'s own branches[] so the timeline graph stays connected. Also removes the trial from its parent loop\'s trials[] if applicable.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      trialId: z.number().describe('Numeric trial ID to delete'),
    }),
    execute: async ({ experimentID, trialId }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { error: `Experiment ${experimentID} not found` }

      const trialToDelete = doc.trials.find(t => t.id === trialId)
      if (!trialToDelete) return { error: `Trial ${trialId} not found` }

      const childrenBranches = trialToDelete.branches ?? []

      // Smart reconnect in trials
      doc.trials.forEach(trial => {
        if (trial.branches?.includes(trialId)) {
          const filtered = trial.branches.filter(id => id !== trialId)
          childrenBranches.forEach(cid => {
            if (!filtered.includes(cid)) filtered.push(cid)
          })
          trial.branches = filtered
        }
      })

      // Smart reconnect in loops
      doc.loops.forEach(loop => {
        if (loop.branches?.includes(trialId)) {
          const filtered = loop.branches.filter(id => id !== trialId)
          childrenBranches.forEach(cid => {
            if (!filtered.includes(cid)) filtered.push(cid)
          })
          loop.branches = filtered
        }
        // Remove from loop.trials
        if (loop.trials) loop.trials = loop.trials.filter(id => id !== trialId)
      })

      // Remove from trials[]
      doc.trials = doc.trials.filter(t => t.id !== trialId)

      // Remove from timeline
      doc.timeline = doc.timeline.filter(item => !(item.id === trialId && item.type === 'trial'))

      // Sync branches in timeline
      doc.timeline = doc.timeline.map(item => {
        if (item.type === 'trial') {
          const t = doc.trials.find(t => t.id === item.id)
          return { ...item, branches: t?.branches ?? [] }
        }
        if (item.type === 'loop') {
          const l = doc.loops.find(l => l.id === item.id)
          return { ...item, branches: l?.branches ?? [], trials: l?.trials ?? [] }
        }
        return item
      })

      doc.updatedAt = new Date().toISOString()
      await db.write()

      return { success: true, deletedTrialId: trialId }
    },
  }),
}
