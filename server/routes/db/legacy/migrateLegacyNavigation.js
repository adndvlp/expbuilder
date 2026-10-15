// TEMPORARY: import-only conversion for the migration release.
// Remove this directory and its import/call in db/import.js afterwards.
// See docs/legacy-experiment-import.md. Runtime accepts only the current contract.
import { assertExperimentNavigation } from "../../timeline/branchContract.js";

const navigationFields = ["branches", "branchConditions", "repeatConditions"];
const finish = "FINISH_EXPERIMENT";

export function migrateLegacyNavigation(source) {
  if (!source || !Array.isArray(source.trials) || !Array.isArray(source.loops) || !Array.isArray(source.timeline)) return source;
  // A partially current document must still fail current validation, not be healed.
  if (Object.hasOwn(source, "entryItemId") ||
      source.trials.some(t => Object.hasOwn(t, "defaultNextTrialId")) ||
      [...source.loops, ...source.timeline].some(item =>
        ["entryItemId", "nextItemId", "defaultNextTrialId"].some(field => Object.hasOwn(item, field)))) return source;

  const doc = structuredClone(source);
  const fail = detail => {
    const error = new Error(`Cannot migrate legacy experiment ${doc.experimentID}: ${detail}`);
    error.status = 400;
    error.code = "LEGACY_IMPORT_NOT_MIGRATABLE";
    throw error;
  };
  const list = (value, label) => {
    if (value == null) return [];
    if (!Array.isArray(value)) fail(`${label} must be an array`);
    return value;
  };
  const removeLoopNavigation = loop => {
    for (const field of navigationFields) {
      if (list(loop[field], `loop ${loop.id} ${field}`).length)
        fail(`loop ${loop.id} has ${field}; a trial source cannot be inferred`);
      delete loop[field];
    }
  };
  const items = new Map();
  const loops = new Map(doc.loops.map(loop => [String(loop.id), loop]));
  for (const item of [...doc.trials, ...doc.loops]) {
    if (item.id == null || !["string", "number"].includes(typeof item.id) || item.id === finish || items.has(String(item.id)))
      fail(`invalid or duplicate item ${item.id}`);
    items.set(String(item.id), item);
  }
  const itemFor = id => {
    const item = items.get(String(id));
    if (!item) fail(`item ${id} does not exist`);
    return item;
  };
  const owners = new Map();
  for (const loop of doc.loops) {
    if (!Array.isArray(loop.trials)) fail(`loop ${loop.id} has no member list`);
    for (const id of loop.trials) {
      itemFor(id);
      if (owners.has(String(id))) fail(`item ${id} has multiple placements`);
      owners.set(String(id), String(loop.id));
    }
    removeLoopNavigation(loop);
  }
  // Some old exports repeated loop-owned items in the root summary.
  const rootSeen = new Set();
  doc.timeline = doc.timeline.filter(summary => {
    itemFor(summary.id);
    if (loops.has(String(summary.id))) removeLoopNavigation(summary);
    const key = String(summary.id);
    if (rootSeen.has(key)) fail(`duplicate timeline item ${summary.id}`);
    rootSeen.add(key);
    if (owners.has(key)) return false;
    owners.set(key, null);
    return true;
  });
  for (const [key, item] of items) {
    if (!owners.has(key)) fail(`item ${item.id} has no placement`);
    const owner = owners.get(key);
    if (item.parentLoopId != null && item.parentLoopId !== "" && String(item.parentLoopId) !== owner)
      fail(`item ${item.id} has conflicting ownership`);
    item.parentLoopId = owner;
    const visited = new Set([key]);
    let parent = owner;
    while (parent !== null) {
      if (visited.has(parent)) fail(`cyclic ownership at ${parent}`);
      visited.add(parent);
      if (!loops.has(parent)) fail(`parent loop ${parent} does not exist`);
      if (!owners.has(parent)) fail(`parent loop ${parent} has no placement`);
      parent = owners.get(parent);
    }
  }
  const trialTarget = id => {
    if (id === finish) return id;
    let item = itemFor(id);
    while (loops.has(String(item.id))) {
      if (!item.trials.length) fail(`loop ${item.id} has no entry trial`);
      item = itemFor(item.trials[0]);
    }
    return item.id;
  };
  const unique = ids => [...new Map(ids.map(id => [String(id), id])).values()];
  const originalBranches = new Map(doc.trials.map(t => [String(t.id), unique(list(t.branches, `trial ${t.id} branches`).map(trialTarget))]));
  const incoming = new Map();
  for (const [sourceId, targets] of originalBranches) {
    for (const id of targets) {
      if (id === finish) continue;
      const sources = incoming.get(String(id)) ?? new Set();
      sources.add(sourceId);
      incoming.set(String(id), sources);
    }
  }
  // Reproduce the old normal sequence once, then persist it as explicit edges.
  // Incoming root branches were excluded; a shared terminal restored continuation.
  const rootSequence = doc.timeline.map(item => itemFor(item.id))
    .filter(item => !incoming.has(String(item.id)));
  if (doc.timeline.length && !rootSequence.length) fail("the root entry cannot be inferred");
  doc.entryItemId = rootSequence[0]?.id ?? null;
  const successors = new Map();
  for (const sequence of [rootSequence, ...doc.loops.map(l => l.trials.map(itemFor))]) {
    sequence.forEach((item, index) => successors.set(String(item.id), sequence[index + 1]?.id ?? null));
  }
  // Shared root terminals were absent from the normal sequence themselves.
  for (let index = 0; index < doc.timeline.length; index++) {
    const id = doc.timeline[index].id;
    if ((incoming.get(String(id))?.size ?? 0) > 1) {
      const next = doc.timeline.slice(index + 1).find(item => !incoming.has(String(item.id)));
      successors.set(String(id), next?.id ?? null);
    }
  }
  for (const loop of doc.loops) {
    loop.entryItemId = loop.trials[0] ?? null;
    loop.nextItemId = successors.get(String(loop.id)) ?? null;
  }
  for (const trial of doc.trials) {
    const branches = originalBranches.get(String(trial.id));
    const successor = successors.get(String(trial.id));
    const mayContinue = (incoming.get(String(trial.id))?.size ?? 0) !== 1;
    trial.defaultNextTrialId = branches.length ? branches[0]
      : mayContinue && successor != null ? trialTarget(successor) : null;

    const convertCondition = (condition, target) => {
      if (!condition || Array.isArray(condition) || !Array.isArray(condition.rules) || target == null)
        fail(`trial ${trial.id} has an invalid navigation condition`);
      const result = { ...condition, nextTrialId: trialTarget(target) };
      delete result.jumpToTrialId;
      return result;
    };
    // Former navigation conditions ran before branching in on_finish.
    const conditions = list(trial.repeatConditions, `trial ${trial.id} repeatConditions`)
      .map(c => convertCondition(c, c?.jumpToTrialId));
    const branchConditions = list(trial.branchConditions, `trial ${trial.id} branchConditions`).flat();
    if (branchConditions.length && !branches.length) fail(`trial ${trial.id} has conditions without branch destinations`);
    conditions.push(...branchConditions.map(c => convertCondition(c, c?.nextTrialId ?? branches[0])));
    const usedIds = new Set();
    let nextId = 1;
    for (const condition of conditions) {
      if (condition.id == null || usedIds.has(String(condition.id))) {
        while (usedIds.has(String(nextId))) nextId++;
        condition.id = nextId++;
      }
      usedIds.add(String(condition.id));
    }
    trial.branches = unique([...branches, trial.defaultNextTrialId, ...conditions.map(c => c.nextTrialId)]
      .filter(id => id != null && id !== finish));
    trial.branchConditions = conditions;
    delete trial.repeatConditions;
  }
  doc.timeline = doc.timeline.map(summary => {
    const item = itemFor(summary.id);
    const result = { ...summary, parentLoopId: null };
    for (const field of navigationFields) delete result[field];
    if (loops.has(String(item.id))) {
      result.entryItemId = item.entryItemId;
      result.nextItemId = item.nextItemId;
    } else {
      result.branches = item.branches;
      result.branchConditions = item.branchConditions;
      result.defaultNextTrialId = item.defaultNextTrialId;
    }
    return result;
  });
  doc.updatedAt = new Date().toISOString();
  try {
    assertExperimentNavigation(doc);
  } catch (error) {
    fail(error.message);
  }
  return doc;
}
