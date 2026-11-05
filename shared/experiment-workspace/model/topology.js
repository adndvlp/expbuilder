export function install(api, services) {
  const connections = (s) => {
    const result = new Map();
    for (const t of s.trials) {
      const refs = [
        { kind: "default", id: "default", targetId: t.defaultNextTrialId },
        ...t.thenGoTo.map((r) => ({ ...r, kind: "then" })),
      ];
      const rank = (target) =>
        target === t.defaultNextTrialId
          ? -1
          : (t.destinationOrder ?? []).indexOf(target) < 0
            ? Infinity
            : t.destinationOrder.indexOf(target);
      refs.sort((a, b) => rank(a.targetId) - rank(b.targetId));
      for (const ref of refs) {
        if (!api.realTrial(s, ref.targetId)) continue;
        const key = JSON.stringify([t.id, ref.targetId]);
        if (!result.has(key))
          result.set(key, {
            id: key,
            source: t.id,
            target: ref.targetId,
            refs: [],
          });
        result.get(key).refs.push({ kind: ref.kind, id: ref.id });
      }
    }
    return [...result.values()];
  };
  const reachable = (s) => {
    const trials = new Set(),
      loops = new Set(),
      pending = [api.resolve(s, s.entryId)];
    const edges = api.connections(s);
    while (pending.length) {
      const id = pending.pop();
      if (!id || trials.has(id)) continue;
      const t = api.realTrial(s, id);
      if (!t) continue;
      trials.add(id);
      pending.push(
        ...edges.filter((e) => e.source === id).map((e) => e.target),
      );
      for (const l of api.ancestors(s, t)) {
        if (loops.has(l.id)) continue;
        loops.add(l.id);
        pending.push(api.resolve(s, l.nextId));
        if (l.repetitions > 1) pending.push(api.resolve(s, l.entryId));
      }
    }
    return { trials, loops };
  };
  const components = (s) => {
    const all = [...s.trials, ...s.loops],
      adjacency = new Map(all.map((i) => [i.id, new Set()]));
    const live = api.reachable(s),
      isLive = (id) => live.trials.has(id) || live.loops.has(id);
    const join = (a, b) => {
      if (!adjacency.has(a) || !adjacency.has(b) || isLive(a) !== isLive(b))
        return;
      adjacency.get(a).add(b);
      adjacency.get(b).add(a);
    };
    api.connections(s).forEach((e) => join(e.source, e.target));
    all.forEach((i) => {
      if (i.parentLoopId) join(i.id, i.parentLoopId);
    });
    s.loops.forEach((l) => {
      if (l.nextId) join(l.id, api.resolve(s, l.nextId));
    });
    const visited = new Set(),
      result = [];
    for (const i of all) {
      if (visited.has(i.id)) continue;
      const ids = new Set(),
        pending = [i.id];
      while (pending.length) {
        const id = pending.pop();
        if (visited.has(id)) continue;
        visited.add(id);
        ids.add(id);
        pending.push(...adjacency.get(id));
      }
      const key = [...ids].sort().join("|");
      const locked = isLive(i.id);
      const attached =
        !locked &&
        (api
          .connections(s)
          .some((e) => ids.has(e.source) && isLive(e.target)) ||
          s.loops.some(
            (l) => ids.has(l.id) && isLive(api.resolve(s, l.nextId)),
          ));
      result.push({
        key,
        ids,
        trials: new Set(s.trials.filter((t) => ids.has(t.id)).map((t) => t.id)),
        locked,
        attached,
      });
    }
    return result;
  };
  const componentFor = (s, id) => api.components(s).find((c) => c.ids.has(id));
  const leafTrials = (s, id) =>
    s.trials.filter(
      (t) => t.id === id || api.ancestors(s, t).some((l) => l.id === id),
    );
  const loopScopeGraph = (s, loop) => {
    const direct = api.members(s, loop.id),
      unit = (id) =>
        direct.find(
          (i) =>
            i.id === id || api.leafTrials(s, i.id).some((t) => t.id === id),
        )?.id;
    const forward = new Map(direct.map((i) => [i.id, new Set()])),
      reverse = new Map();
    const join = (source, target) => {
      const from = unit(source),
        to = unit(target);
      if (!from || !to || from === to) return;
      forward.get(from).add(to);
      if (!reverse.has(to)) reverse.set(to, new Set());
      reverse.get(to).add(from);
    };
    api.connections(s).forEach((e) => join(e.source, e.target));
    direct
      .filter((i) => s.loops.includes(i))
      .forEach((l) => join(l.id, api.resolve(s, l.nextId)));
    return { direct, unit, forward, reverse };
  };
  const scopeReachable = (graph, entry) => {
    const seen = new Set(),
      pending = entry ? [entry] : [];
    while (pending.length) {
      const id = pending.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      pending.push(...(graph.forward.get(id) ?? []));
    }
    return seen;
  };
  const reconcileLoops = (s) => {
    // Resolve inner scopes first: removing an empty entry can repair its parent's entry.
    // Ownership is retained only for the directed structure reachable from that entry.
    for (const loop of [...s.loops].sort(
      (a, b) => api.ancestors(s, b).length - api.ancestors(s, a).length,
    )) {
      if (!api.leafTrials(s, loop.id).length) {
        api.deleteLoop(s, loop.id);
        continue;
      }
      const graph = api.loopScopeGraph(s, loop),
        seen = api.scopeReachable(
          graph,
          graph.unit(api.resolve(s, loop.entryId)),
        );
      graph.direct
        .filter((i) => !seen.has(i.id))
        .forEach((i) => {
          i.parentLoopId = null;
        });
      if (!api.leafTrials(s, loop.id).length) api.deleteLoop(s, loop.id);
    }
  };
  Object.assign(api, {
    connections,
    reachable,
    components,
    componentFor,
    leafTrials,
    loopScopeGraph,
    scopeReachable,
    reconcileLoops,
  });
}
