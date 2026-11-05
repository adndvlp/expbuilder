import { FINISH, idKey } from "./navigation.js";

/** Potential execution paths, including loop completion, without evaluating participant data. */
export function projectExecutable(source) {
  if (source.workspaceSchemaVersion !== 2) return structuredClone(source);
  const document = structuredClone(source),
    trials = new Map(document.trials.map((t) => [idKey(t.id), t])),
    loops = new Map(document.loops.map((l) => [idKey(l.id), l]));
  const included = new Set(),
    queue = [idKey(document.entryItemId)],
    visited = new Set(),
    completed = new Set();
  const owner = (id) => idKey((trials.get(id) || loops.get(id))?.parentLoopId);
  const contains = (loopId, target) => {
    const seen = new Set();
    let current = target;
    while (current && !seen.has(current)) {
      if (current === loopId) return true;
      seen.add(current);
      current = owner(current);
    }
    return false;
  };
  const enqueue = (id) => {
    if (id && id !== FINISH) queue.push(idKey(id));
  };
  const includeAncestors = (id) => {
    const seen = new Set();
    let current = owner(id);
    while (current && !seen.has(current)) {
      seen.add(current);
      included.add(current);
      current = owner(current);
    }
  };
  const advance = (scope, target) => {
    target = idKey(target);
    if (target === FINISH) return;
    if (scope && (!target || !contains(scope, target))) complete(scope, target);
    else enqueue(target);
  };
  const complete = (id, deferred) => {
    const key = JSON.stringify([id, deferred]);
    if (completed.has(key)) return;
    completed.add(key);
    const loop = loops.get(id);
    if (!loop) return;
    included.add(id);
    includeAncestors(id);
    const repeats =
      Number(loop.repetitions) > 1 ||
      (loop.csvJson?.length ?? 0) > 1 ||
      loop.isConditionalLoop;
    if (repeats) enqueue(loop.entryItemId);
    advance(owner(id), deferred ?? loop.nextItemId);
  };
  while (queue.length) {
    const id = queue.pop();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const trial = trials.get(id),
      loop = loops.get(id);
    if (!trial && !loop) continue;
    included.add(id);
    includeAncestors(id);
    if (loop) {
      enqueue(loop.entryItemId);
      continue;
    }
    advance(owner(id), trial.defaultNextTrialId);
    // Routes remain possible authoring destinations, but never become unconditional IFs.
    for (const rule of trial.branchConditions ?? []) {
      const target = idKey(rule.nextTrialId);
      if (!target) advance(owner(id), null);
      else enqueue(target);
    }
  }
  document.trials = document.trials.filter((t) => included.has(idKey(t.id)));
  document.loops = document.loops
    .filter((l) => included.has(idKey(l.id)))
    .map((l) => ({
      ...l,
      trials: l.trials.filter((id) => included.has(idKey(id))),
      entryItemId: included.has(idKey(l.entryItemId)) ? l.entryItemId : null,
      nextItemId: included.has(idKey(l.nextItemId)) ? l.nextItemId : null,
    }));
  document.timeline = document.timeline.filter((i) =>
    included.has(idKey(i.id)),
  );
  return document;
}

export function projectExecutionGraph(graph, document = graph.workspace) {
  if (document?.workspaceSchemaVersion !== 2) return graph;
  const projected = projectExecutable(document),
    ids = new Set(
      [...projected.trials, ...projected.loops].map((i) => idKey(i.id)),
    );
  const loopById = new Map(projected.loops.map((l) => [idKey(l.id), l]));
  const scope = (s) => ({
    ...s,
    entryItemId: ids.has(idKey(s.entryItemId)) ? s.entryItemId : null,
    items: s.items
      .filter((i) => ids.has(idKey(i.id)))
      .map((i) =>
        i.type === "loop"
          ? {
              ...i,
              nextItemId: loopById.get(idKey(i.id)).nextItemId,
              trials: loopById.get(idKey(i.id)).trials,
            }
          : i,
      ),
  });
  return {
    ...graph,
    workspace: projected,
    root: scope(graph.root),
    scopes: Object.fromEntries(
      Object.entries(graph.scopes)
        .filter(([id]) => ids.has(id))
        .map(([id, s]) => [id, scope(s)]),
    ),
    edges: graph.edges.filter(
      (e) => ids.has(idKey(e.sourceId)) && ids.has(idKey(e.targetId)),
    ),
  };
}
