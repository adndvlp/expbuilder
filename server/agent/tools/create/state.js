import { z } from 'zod'
import { db, ensureDbData, userDataRoot } from '../../../utils/db.js'

export { db, ensureDbData, userDataRoot }

export async function readDb() {
  await db.read()
  ensureDbData()
}

export function getDoc(experimentID) {
  return db.data.trials.find(t => t.experimentID === experimentID) ?? null
}

export function ensureDoc(experimentID) {
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

export const columnMappingEntrySchema = z.object({
  source: z.enum(['csv', 'typed', 'none']).describe('"csv" = read from CSV column, "typed" = direct value, "none" = use plugin default'),
  value: z.any().optional().describe('CSV column name (if source=csv) or the literal value (if source=typed)'),
})

export function findLastItems(trialIds, trials, loops) {
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
