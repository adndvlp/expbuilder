import type { ModelInternals } from "../modelContracts.js";
export function create(api: () => ModelInternals) {
  const FINISH: ModelInternals["FINISH"] = "FINISH_EXPERIMENT";
  const copy: ModelInternals["copy"] = (value) =>
    JSON.parse(JSON.stringify(value));
  const trial: ModelInternals["trial"] = (
    id,
    name,
    parentLoopId = null,
    defaultNextTrialId = null,
  ) => ({
    id: String(id),
    name,
    parentLoopId,
    defaultNextTrialId,
    thenGoTo: [],
  });
  const makeState: ModelInternals["makeState"] = (
    name,
    trials = [],
    loops = [],
    entryId = null,
  ) => ({
    schema: "branching-workspace-model/2",
    name,
    entryId,
    trials,
    loops,
    anchors: {},
    scopeOrder: {},
    sequence: 1,
    notes: [],
  });
  const item: ModelInternals["item"] = (s, id) =>
    [...s.trials, ...s.loops].find((t) => t.id === id);
  const realTrial: ModelInternals["realTrial"] = (s, id) =>
    s.trials.find((t) => t.id === id);
  const uniqueId: ModelInternals["uniqueId"] = (s, prefix) => {
    let id;
    do {
      id = `${prefix}_${s.sequence++}`;
    } while (api().item(s, id));
    return id;
  };
  const members: ModelInternals["members"] = (s, loopId) =>
    [...s.trials, ...s.loops].filter((t) => t.parentLoopId === loopId);
  const ancestors: ModelInternals["ancestors"] = (s, t) => {
    const result = [];
    const seen = new Set();
    let id = t?.parentLoopId;
    while (id && !seen.has(id)) {
      seen.add(id);
      const l = s.loops.find((l) => l.id === id);
      if (!l) break;
      result.push(l);
      id = l.parentLoopId;
    }
    return result;
  };
  const resolve: ModelInternals["resolve"] = (s, id, seen = new Set()) => {
    if (!id || id === api().FINISH || seen.has(id)) return null;
    seen.add(id);
    if (api().realTrial(s, id)) return id;
    const loop = s.loops.find((l) => l.id === id);
    return loop ? api().resolve(s, loop.entryId, seen) : null;
  };
  return {
    FINISH,
    copy,
    trial,
    makeState,
    item,
    realTrial,
    uniqueId,
    members,
    ancestors,
    resolve,
  };
}
