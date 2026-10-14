// TEMPORARY: import compatibility for the next release only.
// Remove this module and its import/call in db/import.js after the migration
// release. See docs/legacy-experiment-import.md for the supported conversion.

class LegacyImportError extends Error {
  constructor(experimentID, detail) {
    super(`Cannot migrate legacy experiment ${experimentID}: ${detail}`);
    this.status = 400;
    this.code = "LEGACY_IMPORT_NOT_MIGRATABLE";
  }
}

export function migrateLegacyBranching(doc) {
  if (!doc || !Array.isArray(doc.trials) || !Array.isArray(doc.loops) || !Array.isArray(doc.timeline)) {
    return doc;
  }

  const trials = new Map(doc.trials.map(trial => [String(trial.id), trial]));
  const loops = new Map(doc.loops.map(loop => [String(loop.id), loop]));
  let changed = false;
  const fail = detail => { throw new LegacyImportError(doc.experimentID, detail); };

  function trialTarget(targetId) {
    let loop = loops.get(String(targetId));
    if (!loop) return targetId;
    const visited = new Set();
    while (loop) {
      const key = String(loop.id);
      if (visited.has(key)) fail(`loop ${loop.id} has a cyclic entrance`);
      visited.add(key);
      const firstId = loop.trials?.[0];
      if (firstId == null) fail(`loop ${loop.id} has no entry trial`);
      const trial = trials.get(String(firstId));
      if (trial) {
        changed = true;
        return trial.id;
      }
      const child = loops.get(String(firstId));
      if (!child) fail(`loop ${loop.id} starts with missing item ${firstId}`);
      loop = child;
    }
  }

  function migrateTrial(trial) {
    let result = trial;
    if (Array.isArray(trial.branches)) {
      const branches = trial.branches.map(trialTarget);
      if (branches.some((id, index) => id !== trial.branches[index])) {
        // A loop and its entry trial may have been separate legacy targets.
        const seen = new Set();
        result = { ...result, branches: branches.filter(id => {
          const key = String(id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }) };
      }
    }
    if (Array.isArray(trial.branchConditions)) {
      const conditions = trial.branchConditions.map(condition => {
        if (condition?.nextTrialId == null) return condition;
        const nextTrialId = trialTarget(condition.nextTrialId);
        return nextTrialId === condition.nextTrialId ? condition : { ...condition, nextTrialId };
      });
      if (conditions.some((condition, index) => condition !== trial.branchConditions[index])) {
        result = { ...result, branchConditions: conditions };
      }
    }
    return result;
  }

  function migrateLoop(loop) {
    let result = loop;
    for (const field of ["branches", "branchConditions"]) {
      if (!Object.hasOwn(loop, field)) continue;
      const value = loop[field];
      if (value != null && (!Array.isArray(value) || value.length > 0)) {
        fail(`loop ${loop.id} has ${field}; its trial source cannot be inferred`);
      }
      if (result === loop) result = { ...loop };
      delete result[field];
      changed = true;
    }
    return result;
  }

  const migratedTrials = doc.trials.map(migrateTrial);
  const migratedLoops = doc.loops.map(migrateLoop);
  const timeline = doc.timeline.map(item => item.type === "loop" || loops.has(String(item.id))
    ? migrateLoop(item) : migrateTrial(item));
  return changed ? {
    ...doc,
    trials: migratedTrials,
    loops: migratedLoops,
    timeline,
    updatedAt: new Date().toISOString(),
  } : doc;
}
