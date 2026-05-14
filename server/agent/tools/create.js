import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { tool } from 'ai'
import { z } from 'zod'
import { db, ensureDbData, userDataRoot } from '../../utils/db.js'
import { __dirname } from '../../utils/paths.js'
import { buildExperimentHtml, buildPublicExperimentHtml } from '../codegen.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function readDb() {
  await db.read()
  ensureDbData()
}

function getDoc(experimentID) {
  return db.data.trials.find(t => t.experimentID === experimentID) ?? null
}

function ensureDoc(experimentID) {
  let doc = getDoc(experimentID)
  if (!doc) {
    doc = {
      experimentID,
      trials: [],
      loops: [],
      timeline: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.data.trials.push(doc)
  }
  return doc
}

// Zod schema for a single ColumnMappingEntry
const columnMappingEntrySchema = z.object({
  source: z.enum(['csv', 'typed', 'none']).describe('"csv" = read from CSV column, "typed" = direct value, "none" = use plugin default'),
  value: z.any().optional().describe('CSV column name (if source=csv) or the literal value (if source=typed)'),
})

// Returns ids of items that have no further branches pointing inside the same set
function findLastItems(trialIds, trials, loops) {
  const lastItems = []
  for (const tid of trialIds) {
    const t = trials.find(t => t.id === tid)
    const l = loops.find(l => l.id === tid)
    const branches = t?.branches ?? l?.branches ?? []
    const hasBranchInside = branches.some(bid => trialIds.includes(bid))
    if (!hasBranchInside) lastItems.push(tid)
  }
  return lastItems.length > 0 ? lastItems : [trialIds[0]]
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export const createTrialTools = {

  // ── Create ─────────────────────────────────────────────────────────────────

  create_trial: tool({
    description:
      'Create a new trial in an experiment. The trial is appended to the main timeline unless parentLoopId is set, in which case it is only added to trials[] (the loop manages its own ordering). Returns the created trial with its auto-generated numeric id (timestamp). Use list_plugins first if unsure which plugin to use.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      name: z.string().describe('Display name for the trial (e.g. "Welcome Screen")'),
      plugin: z.string().describe('jsPsych plugin id, e.g. "plugin-html-keyboard-response", "plugin-dynamic". Use list_plugins to see all options.'),
      parameters: z.record(z.any()).optional().describe('Plugin-level parameters object (e.g. { stimulus: "Hello", choices: ["y","n"] }). For DynamicPlugin, leave empty and use columnMapping instead.'),
      columnMapping: z.record(columnMappingEntrySchema).optional().describe(
        'Maps each plugin parameter to a source. E.g. { "stimulus": { source: "csv", value: "image_col" }, "trial_duration": { source: "typed", value: 2000 } }. ' +
        'For DynamicPlugin: columnMapping must include "components" and "response_components" keys whose values are arrays of component config objects.',
      ),
      parentLoopId: z.string().optional().describe('Loop ID ("loop_xxx") if this trial lives inside a loop. Omit for top-level trials.'),
      branches: z.array(z.union([z.string(), z.number()])).optional().describe('IDs of trials/loops this trial connects to (visual arrows). Usually set after creation via update_trial.'),
    }),
    execute: async ({ experimentID, name, plugin, parameters, columnMapping, parentLoopId, branches }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }

      const doc = ensureDoc(experimentID)

      const id = Date.now()
      const now = new Date().toISOString()
      const newTrial = {
        id,
        name,
        type: 'trial',
        plugin: plugin ?? null,
        parameters: parameters ?? {},
        ...(columnMapping !== undefined && { columnMapping }),
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

  // ── Loops ──────────────────────────────────────────────────────────────────

  create_loop: tool({
    description:
      'Create a new loop that groups existing trials (and/or nested loops). ' +
      'The grouped trials are pulled out of the main timeline and owned by the loop. ' +
      'Any trial/loop that previously had one of the grouped items in its branches[] will have those IDs replaced by the new loop ID. ' +
      'Pass an empty trials[] to create a loop first and add trials later via create_trial with parentLoopId.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      name: z.string().describe('Display name for the loop'),
      trials: z.array(z.union([z.string(), z.number()])).describe('IDs of trials (numbers) or nested loops (strings starting with "loop_") to group inside this loop. Can be empty.'),
      repetitions: z.number().int().min(1).optional().default(1).describe('How many times to repeat the loop (ignored when isConditionalLoop=true)'),
      randomize: z.boolean().optional().default(false).describe('Randomize trial order inside the loop each repetition'),
      isConditionalLoop: z.boolean().optional().default(false).describe('If true, loop repeats based on loopConditions instead of a fixed repetitions count'),
      loopConditions: z.array(z.any()).optional().describe('Array of LoopCondition objects. Only used when isConditionalLoop=true.'),
      parentLoopId: z.string().optional().describe('Parent loop ID if this loop is nested inside another loop'),
      branches: z.array(z.union([z.string(), z.number()])).optional().describe('IDs of trials/loops this loop connects to after it ends'),
      csvJson: z.array(z.any()).optional().describe('CSV data rows for timeline_variables. Setting this automatically makes child trials use loop CSV.'),
      csvColumns: z.array(z.string()).optional().describe('CSV column names matching csvJson rows'),
    }),
    execute: async ({ experimentID, name, trials: trialIds, repetitions, randomize, isConditionalLoop, loopConditions, parentLoopId, branches, csvJson, csvColumns }) => {
      await readDb()
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
        branches: branches ?? [],
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
          branches: newLoop.branches,
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

      // Replace grouped trial IDs with loop ID in other trials' branches
      doc.trials.forEach(trial => {
        if (newLoop.trials.includes(trial.id)) return
        if (!trial.branches?.length) return
        if (trial.branches.some(bid => newLoop.trials.includes(bid))) {
          const filtered = trial.branches.filter(bid => !newLoop.trials.includes(bid))
          if (!filtered.includes(newLoop.id)) filtered.push(newLoop.id)
          trial.branches = filtered
        }
      })

      doc.loops.forEach(loop => {
        if (loop.id === newLoop.id || !loop.branches?.length) return
        if (loop.branches.some(bid => newLoop.trials.includes(bid))) {
          const filtered = loop.branches.filter(bid => !newLoop.trials.includes(bid))
          if (!filtered.includes(newLoop.id)) filtered.push(newLoop.id)
          loop.branches = filtered
        }
      })

      // Sync timeline branches
      doc.timeline.forEach(item => {
        if (item.type === 'trial') {
          const t = doc.trials.find(t => t.id === item.id)
          if (t) item.branches = t.branches ?? []
        } else if (item.type === 'loop') {
          const l = doc.loops.find(l => l.id === item.id)
          if (l) item.branches = l.branches ?? []
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
      timeline: z.array(z.object({
        id: z.union([z.string(), z.number()]).describe('Trial ID (number) or Loop ID (string starting with "loop_")'),
        type: z.enum(['trial', 'loop']).describe('"trial" or "loop"'),
        name: z.string().describe('Display name (must match existing item name)'),
        branches: z.array(z.union([z.string(), z.number()])).optional().describe('Branch connections from this item'),
        trials: z.array(z.union([z.string(), z.number()])).optional().describe('For loops: IDs of trials inside the loop'),
      })).describe('Full ordered array of top-level timeline items. Every existing top-level item must be included — omitting an item removes it from the view.'),
    }),
    execute: async ({ experimentID, timeline }) => {
      await readDb()
      const doc = getDoc(experimentID)
      if (!doc) return { error: `Experiment ${experimentID} not found` }

      doc.timeline = timeline
      doc.updatedAt = new Date().toISOString()
      await db.write()

      return { success: true, timeline }
    },
  }),

  // ── Experiments ────────────────────────────────────────────────────────────

  create_experiment: tool({
    description:
      'Create a new experiment. Returns the created experiment with its UUID. ' +
      'After creation, use create_trial or create_loop to build its timeline.',
    parameters: z.object({
      name: z.string().describe('Experiment display name (must be unique — used as filename)'),
      description: z.string().optional().describe('Short description of the experiment'),
      author: z.string().optional().describe('Author name'),
    }),
    execute: async ({ name, description, author }) => {
      await readDb()
      const experimentID = uuidv4()
      const now = new Date().toISOString()
      const experiment = {
        experimentID,
        name,
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
    description:
      'Update metadata fields on an existing experiment (PATCH semantics). ' +
      'Updatable fields: name, description, author, appearanceSettings ({ backgroundColor, fullScreen, progressBar }). ' +
      'WARNING: renaming an experiment (changing name) does not rename on-disk HTML/upload files — ' +
      'the old files remain under the old name. Only safe for experiments that have not been built/run yet.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      updates: z.record(z.any()).describe(
        'Fields to update. E.g. { "description": "New desc" } or { "appearanceSettings": { "backgroundColor": "#f0f0f0", "fullScreen": true, "progressBar": false } }.',
      ),
    }),
    execute: async ({ experimentID, updates }) => {
      await readDb()
      const idx = db.data.experiments.findIndex(e => e.experimentID === experimentID)
      if (idx === -1) return { error: `Experiment ${experimentID} not found` }
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

  // ── File Upload ─────────────────────────────────────────────────────────────

  upload_file: tool({
    description:
      'Upload a media file (image, audio, or video) to an experiment. ' +
      'The file is stored on disk in {experimentName}/{type}/ and served via URL like "img/filename.jpg". ' +
      'Use the returned url in trial columnMapping (source: "typed", value: "img/filename.jpg") for stimuli. ' +
      'Supports: .png, .jpg, .jpeg, .gif, .svg, .webp, .bmp (img), .mp3, .wav, .ogg, .m4a, .flac, .aac (aud), .mp4, .webm, .mov, .avi, .mkv (vid).',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      filename: z.string().describe('Desired filename, e.g. "cat.jpg" or "sound.mp3". Extension determines type.'),
      base64Content: z.string().describe('Base64-encoded file content (without data URI prefix)'),
    }),
    execute: async ({ experimentID, filename, base64Content }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }
      const experimentName = exp.name || experimentID
      const ext = path.extname(filename).toLowerCase()
      let type
      if (/\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(ext)) type = 'img'
      else if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(ext)) type = 'aud'
      else if (/\.(mp4|webm|mov|avi|mkv)$/i.test(ext)) type = 'vid'
      else if (/\.(txt|csv|json|pdf|zip)$/i.test(ext)) type = 'others'
      else return { error: `Unsupported file type: ${ext}` }
      const targetDir = path.join(userDataRoot, experimentName, type)
      fs.mkdirSync(targetDir, { recursive: true })
      const filePath = path.join(targetDir, filename)
      fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'))
      const url = `${type}/${encodeURIComponent(filename)}`
      return { success: true, url, type, filename, sizeBytes: Buffer.byteLength(Buffer.from(base64Content, 'base64')) }
    },
  }),

  delete_file: tool({
    description:
      'Delete a previously uploaded file from an experiment. Provide the file URL as returned by upload_file (e.g. "img/cat.jpg").',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      fileUrl: z.string().describe('File URL like "img/cat.jpg" or "aud/sound.mp3" as returned by upload_file or list_files'),
    }),
    execute: async ({ experimentID, fileUrl }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }
      const experimentName = exp.name || experimentID
      const parts = fileUrl.split('/')
      if (parts.length !== 2) return { error: `Invalid fileUrl format. Expected "type/filename", got "${fileUrl}"` }
      const [type, encodedFilename] = parts
      const filename = decodeURIComponent(encodedFilename)
      if (!['img', 'aud', 'vid', 'others'].includes(type)) return { error: `Invalid type: ${type}` }
      const filePath = path.join(userDataRoot, experimentName, type, filename)
      if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` }
      fs.unlinkSync(filePath)
      return { success: true, deleted: fileUrl }
    },
  }),

  // ── Custom Plugin ────────────────────────────────────────────────────────────

  create_custom_plugin: tool({
    description:
      'Save a custom jsPsych plugin. Plugins must implement the jsPsych plugin spec: define an info object with name/version/parameters/data, and a class with a trial(display_element, trial) method. ' +
      'The plugin becomes available in list_plugins and can be used in create_trial with plugin name matching the info.name value. ' +
      'If a plugin with the same index already exists, it is overwritten.',
    parameters: z.object({
      index: z.number().int().min(0).describe('Plugin slot index (0, 1, 2...). Use 0 for the first custom plugin.'),
      name: z.string().describe('Plugin name matching jsPsych plugin spec (info.name). E.g. "my-custom-plugin"'),
      pluginCode: z.string().describe('Full JavaScript source code of the plugin. Must include info object and trial() method.'),
    }),
    execute: async ({ index, name, pluginCode }) => {
      await readDb()
      ensureDbData()

      const scripTag = `/plugins/${name}.js`

      let pluginConfig = db.data.pluginConfigs[0]
      if (!pluginConfig) {
        pluginConfig = { plugins: [], config: {} }
        db.data.pluginConfigs.push(pluginConfig)
      }

      const existingIdx = pluginConfig.plugins.findIndex(p => p.index === index)

      // Clean up old files if overwriting
      if (existingIdx >= 0) {
        const old = pluginConfig.plugins[existingIdx]
        if (old.scripTag && old.name !== name) {
          const oldFile = path.join(userDataRoot, 'plugins', path.basename(old.scripTag))
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile)
          const oldMeta = path.join(__dirname, 'metadata', `${old.name}.json`)
          if (fs.existsSync(oldMeta)) fs.unlinkSync(oldMeta)
        }
      }

      const plugin = { name, scripTag, pluginCode, index }

      if (existingIdx >= 0) {
        pluginConfig.plugins[existingIdx] = plugin
      } else {
        pluginConfig.plugins.push(plugin)
      }

      // Write plugin file to disk
      const pluginsDir = path.join(userDataRoot, 'plugins')
      fs.mkdirSync(pluginsDir, { recursive: true })
      const filePath = path.join(pluginsDir, `${name}.js`)
      fs.writeFileSync(filePath, pluginCode, 'utf8')

      await db.write()

      return { success: true, plugin: { name, index, scripTag } }
    },
  }),

  delete_custom_plugin: tool({
    description:
      'Delete a custom plugin by its index. Removes the plugin file from disk and its metadata. This is irreversible.',
    parameters: z.object({
      index: z.number().int().min(0).describe('Plugin slot index to delete'),
    }),
    execute: async ({ index }) => {
      await readDb()
      const pluginConfig = db.data.pluginConfigs[0]
      if (!pluginConfig) return { error: 'No custom plugins configured' }

      const plugin = pluginConfig.plugins.find(p => p.index === index)
      if (!plugin) return { error: `Plugin at index ${index} not found` }

      // Remove from DB
      pluginConfig.plugins = pluginConfig.plugins.filter(p => p.index !== index)

      // Remove plugin file
      if (plugin.scripTag) {
        const filePath = path.join(userDataRoot, 'plugins', path.basename(plugin.scripTag))
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }

      // Remove metadata
      if (plugin.name) {
        const metaPath = path.join(__dirname, 'metadata', `${plugin.name}.json`)
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath)
      }

      await db.write()
      return { success: true, deleted: plugin.name }
    },
  }),

  // ── Tunnel ───────────────────────────────────────────────────────────────────

  update_tunnel_settings: tool({
    description:
      'Save Cloudflare tunnel settings for an experiment. Set hostname to a custom domain (must be in Cloudflare DNS) or leave empty for a random *.trycloudflare.com URL. Set persistent to true to auto-start the tunnel on server boot.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      hostname: z.string().optional().describe('Custom domain (e.g. "experiment.mydomain.com") or empty string for quick tunnel'),
      persistent: z.boolean().optional().describe('Keep tunnel running automatically on server start'),
    }),
    execute: async ({ experimentID, hostname, persistent }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }
      const norm = (hostname || '').replace(/^https?:\/\//, '').replace(/\/$/, '').trim()
      exp.tunnelSettings = {
        ...(exp.tunnelSettings || { hostname: '', persistent: false }),
        ...(hostname !== undefined && { hostname: norm }),
        ...(persistent !== undefined && { persistent: !!persistent }),
      }
      exp.updatedAt = new Date().toISOString()
      await db.write()
      return { success: true, tunnelSettings: exp.tunnelSettings }
    },
  }),

  create_tunnel: tool({
    description:
      'Start a Cloudflare tunnel to share the experiment publicly. If hostname is set in tunnel settings, uses that custom domain (must be in Cloudflare DNS). Otherwise creates a random *.trycloudflare.com URL. Only one tunnel can be active at a time.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }
      const hostname = exp.tunnelSettings?.hostname || ''
      // Tunnel creation requires cloudflared binary + spawn — delegate to existing API
      const apiUrl = process.env.API_URL || 'http://localhost:3000'
      try {
        const res = await fetch(`${apiUrl}/api/create-tunnel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ experimentID, hostname }),
        })
        const data = await res.json()
        return data
      } catch (err) {
        return { success: false, error: `Tunnel error: ${err.message}. Ensure cloudflared is installed.` }
      }
    },
  }),

  close_tunnel: tool({
    description: 'Close the currently active Cloudflare tunnel.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      const apiUrl = process.env.API_URL || 'http://localhost:3000'
      try {
        const res = await fetch(`${apiUrl}/api/close-tunnel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ experimentID }),
        })
        const data = await res.json()
        return data
      } catch (err) {
        return { success: false, error: err.message }
      }
    },
  }),

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
