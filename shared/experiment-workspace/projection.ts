import type { WorkspaceDocument, ItemId } from "./types.js";
import type {
  ExperimentGraphSnapshot,
  GraphScopeView,
} from "./executionGraph.js";
import { hasId, required } from "./valueUtils.js";
import { FINISH, idKey } from "./navigation.js";

/** Potential execution paths, including loop completion, without evaluating participant data. */
export function projectExecutable<T extends WorkspaceDocument>(source: T): T {
  if (source.workspaceSchemaVersion !== 2) return structuredClone(source);
  const document = structuredClone(source),
    trials = new Map(document.trials.map((t) => [idKey(t.id), t])),
    loops = new Map(document.loops.map((l) => [idKey(l.id), l]));
  const included = new Set<string>(),
    queue = [idKey(document.entryItemId)],
    visited = new Set<string>(),
    completed = new Set<string>();
  const owner = (id: string | null | undefined): string | null =>
    id == null ? null : idKey((trials.get(id) || loops.get(id))?.parentLoopId);
  const contains = (loopId: string, target: string): boolean => {
    const seen = new Set<string>();
    let current: string | null = target;
    while (current && !seen.has(current)) {
      if (current === loopId) return true;
      seen.add(current);
      current = owner(current);
    }
    return false;
  };
  const enqueue = (id: ItemId | null | undefined) => {
    if (id && id !== FINISH) queue.push(idKey(id));
  };
  const includeAncestors = (id: string) => {
    const seen = new Set<string>();
    let current = owner(id);
    while (current && !seen.has(current)) {
      seen.add(current);
      included.add(current);
      current = owner(current);
    }
  };
  const advance = (scope: string | null, target: ItemId | null | undefined) => {
    target = idKey(target);
    if (target === FINISH) return;
    if (scope && (!target || !contains(scope, target))) complete(scope, target);
    else enqueue(target);
  };
  const complete = (id: string, deferred: ItemId | null | undefined) => {
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
    if (!trial) continue;
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
      entryItemId: hasId(included, idKey(l.entryItemId)) ? l.entryItemId : null,
      nextItemId: hasId(included, idKey(l.nextItemId)) ? l.nextItemId : null,
    }));
  document.timeline = document.timeline.filter((i) =>
    included.has(idKey(i.id)),
  );
  return document;
}

export function projectExecutionGraph(
  graph: ExperimentGraphSnapshot,
  document = graph.workspace,
): ExperimentGraphSnapshot {
  if (document?.workspaceSchemaVersion !== 2) return graph;
  const projected = projectExecutable(document),
    ids = new Set(
      [...projected.trials, ...projected.loops].map((i) => idKey(i.id)),
    );
  const loopById = new Map(projected.loops.map((l) => [idKey(l.id), l]));
  const scope = (s: GraphScopeView): GraphScopeView => ({
    ...s,
    entryItemId: hasId(ids, idKey(s.entryItemId)) ? s.entryItemId : null,
    items: s.items
      .filter((i) => ids.has(idKey(i.id)))
      .map((i) =>
        i.type === "loop"
          ? {
              ...i,
              nextItemId: required(loopById.get(idKey(i.id))).nextItemId,
              trials: required(loopById.get(idKey(i.id))).trials,
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
