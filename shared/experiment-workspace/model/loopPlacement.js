export function install(api, services) {
  const loopBranchLevels = (s, sourceId, scopeTrialId = sourceId) =>
    services.loopBranchLevels(s, sourceId, scopeTrialId);
  const loopConnectionContext = (s, sourceId, targetId, previous = null) => {
    const source = api.realTrial(s, sourceId),
      target = api.realTrial(s, targetId);
    if (
      !source ||
      !target ||
      api
        .connections(s)
        .some((e) => e.source === sourceId && e.target === targetId)
    )
      return null;
    const groups = api.components(s),
      from = groups.find((c) => c.ids.has(sourceId)),
      to = groups.find((c) => c.ids.has(targetId));
    if (from.key === to.key) return null;
    let scopeTrial, looseTrial, component;
    if (target.parentLoopId && !from.locked && to.locked) {
      scopeTrial = target;
      looseTrial = source;
      component = from;
    } else if (source.parentLoopId && !to.locked) {
      scopeTrial = source;
      looseTrial = target;
      component = to;
    } else if (target.parentLoopId && !from.locked) {
      scopeTrial = target;
      looseTrial = source;
      component = from;
    }
    if (!scopeTrial) return null;
    const levels = api
      .loopBranchLevels(s, sourceId, scopeTrial.id)
      .map((level) => ({ ...level }));
    if (
      previous?.source === sourceId &&
      api
        .connections(s)
        .some(
          (e) => e.source === previous.source && e.target === previous.target,
        )
    ) {
      const level = levels.find(
        (l) => l.scopeId === api.realTrial(s, previous.target)?.parentLoopId,
      );
      if (level) level.branchCount = Math.max(0, level.branchCount - 1);
    }
    return {
      sourceId,
      targetId,
      scopeTrialId: scopeTrial.id,
      looseTrialId: looseTrial.id,
      looseIds: [...component.ids],
      canPlaceDestination: looseTrial.id === targetId,
      levels,
    };
  };
  const loopBranchSelection = (s, request, scopeId) => {
    const context = request.targetId
      ? api.loopConnectionContext(
          s,
          request.sourceId,
          request.targetId,
          request.previous,
        )
      : null;
    if (request.targetId && !context) return null;
    const selection = services.selectLoopBranchLevel(
      { levels: context?.levels ?? api.loopBranchLevels(s, request.sourceId) },
      scopeId,
    );
    // An incoming link retains its destination's active structure; only a movable
    // destination can be inserted before the source's existing routes.
    return selection
      ? {
          ...selection,
          requiresPlacement:
            selection.requiresPlacement &&
            (!context || context.canPlaceDestination),
        }
      : null;
  };
  const connectAtLoopLevel = (
    s,
    sourceId,
    targetId,
    scopeId,
    previous = null,
    mode = "parallel",
  ) => {
    if (!["parallel", "sequential"].includes(mode))
      throw Error("Invalid placement mode");
    const context = api.loopConnectionContext(s, sourceId, targetId, previous);
    if (!context || !context.levels.some((l) => l.scopeId === scopeId))
      throw Error("Elige un nivel válido del loop para esta conexión.");
    const endpoints = context.canPlaceDestination
      ? services.insertionEndpoints(s, targetId, targetId)
      : null;
    const roots = context.looseIds
        .map((id) => api.item(s, id))
        .filter((i) => i.parentLoopId === null),
      moving = new Set(roots.map((i) => i.id));
    const rootOrder = [
        ...new Set([
          ...(s.scopeOrder?.root ?? []),
          ...api.members(s, null).map((i) => i.id),
        ]),
      ],
      orderedRoots = rootOrder.filter((id) => moving.has(id));
    if (scopeId !== null) {
      const loop = api.item(s, scopeId),
        graph = api.loopScopeGraph(s, loop),
        entry = graph.unit(api.resolve(s, loop.entryId));
      const own = new Set(api.members(s, scopeId).map((i) => i.id)),
        scopeOrder = [
          ...new Set([...(s.scopeOrder?.[scopeId] ?? []), ...own]),
        ].filter((id) => own.has(id));
      s.scopeOrder ??= {};
      s.scopeOrder.root = rootOrder;
      for (const key of Object.keys(s.scopeOrder))
        s.scopeOrder[key] = s.scopeOrder[key].filter((id) => !moving.has(id));
      const position =
        context.looseTrialId === sourceId ? scopeOrder.indexOf(entry) : -1;
      s.scopeOrder[scopeId] = [...scopeOrder];
      s.scopeOrder[scopeId].splice(
        position < 0 ? scopeOrder.length : position,
        0,
        ...orderedRoots,
      );
      roots.forEach((i) => {
        i.parentLoopId = scopeId;
      });
    }
    if (context.canPlaceDestination) {
      const movedRules = [];
      if (previous) {
        if (
          !(
            (previous.source === sourceId && previous.target !== targetId) ||
            (previous.target === targetId && previous.source !== sourceId)
          )
        )
          throw Error("Solo se puede mover un extremo de la conexión.");
        const old = api
          .connections(s)
          .find(
            (e) => e.source === previous.source && e.target === previous.target,
          );
        if (!old) throw Error("Conexión no encontrada");
        movedRules.push(
          ...api
            .realTrial(s, previous.source)
            .thenGoTo.filter((r) => r.targetId === previous.target),
        );
        api.removeConnection(s, previous.source, previous.target);
      }
      const plan = services.planLoopBranch(s, sourceId, scopeId, mode),
        used = new Set(plan.source.branchConditions.map((r) => r.id));
      for (const { targetId: oldTarget, ...rule } of movedRules) {
        let id = rule.id;
        while (used.has(id)) id = api.uniqueId(s, "condition");
        used.add(id);
        plan.source.branchConditions.push({
          ...rule,
          id,
          nextTrialId: targetId,
        });
      }
      api.applyLoopBranchPlan(s, plan, {
        targetId,
        exitId: endpoints.exitId,
        roots: orderedRoots,
      });
    } else if (!previous)
      api.addDestination(s, api.realTrial(s, sourceId), targetId);
    else if (previous.source === sourceId && previous.target !== targetId)
      api.reconnectTarget(s, previous.source, previous.target, targetId, false);
    else if (previous.target === targetId && previous.source !== sourceId)
      api.reconnectSource(s, previous.source, previous.target, sourceId, false);
    else throw Error("Solo se puede mover un extremo de la conexión.");
    if (scopeId !== null) {
      const loop = api.item(s, scopeId),
        graph = api.loopScopeGraph(s, loop),
        entry = graph.unit(api.resolve(s, loop.entryId)),
        upstream = new Set(),
        pending = entry ? [entry] : [];
      while (pending.length) {
        const id = pending.pop();
        if (upstream.has(id)) continue;
        upstream.add(id);
        pending.push(...(graph.reverse.get(id) ?? []));
      }
      const heads = api.sourceHeads(
        [
          ...new Set([entry, ...api.entryOrder(s, upstream, graph.unit)]),
        ].filter(Boolean),
        graph.reverse,
      );
      loop.entryId = heads[0] ?? loop.entryId;
      if (
        !api
          .scopeReachable(graph, graph.unit(api.resolve(s, loop.entryId)))
          .has(graph.unit(context.looseTrialId))
      )
        throw Error(
          "El trial no sería alcanzable desde la entrada del loop. Conéctalo desde un trial del loop o elige Main timeline.",
        );
    }
    return JSON.stringify([sourceId, targetId]);
  };
  const applyLoopBranchPlan = (
    s,
    plan,
    { targetId = null, exitId = null, roots = [] } = {},
  ) => {
    const created = plan.trial,
      placeholder = String(created.id),
      existing = targetId !== null;
    if (!existing) {
      const child = api.trial(
        placeholder,
        created.name,
        created.parentLoopId ?? null,
      );
      s.trials.push(child);
      targetId = child.id;
    }
    const map = (id) =>
      existing && String(id) === placeholder ? targetId : String(id);
    const apply = (target, value) => {
      target.defaultNextTrialId =
        value.defaultNextTrialId == null ? null : map(value.defaultNextTrialId);
      target.thenGoTo = value.branchConditions.map(
        ({ nextTrialId, ...rule }) => ({
          ...rule,
          targetId: nextTrialId == null ? null : map(nextTrialId),
        }),
      );
      target.destinationOrder = value.branches.map(map);
      // Legacy branches from the domain command become explicit Default/Then references.
      const represented = new Set([
        target.defaultNextTrialId,
        ...target.thenGoTo.map((r) => r.targetId),
      ]);
      const used = new Set(
        s.trials.flatMap((t) => t.thenGoTo.map((r) => r.id)),
      );
      for (const next of target.destinationOrder)
        if (!represented.has(next)) {
          let id;
          do {
            id = api.uniqueId(s, "condition");
          } while (used.has(id));
          used.add(id);
          target.thenGoTo.push({ id, targetId: next });
          represented.add(next);
        }
    };
    apply(api.realTrial(s, String(plan.source.id)), plan.source);
    if (!existing) apply(api.realTrial(s, targetId), created);
    else if (created.branches.length) {
      const exit = api.realTrial(s, exitId);
      if (
        !api.connections(s).some((e) => e.source === exitId) &&
        created.defaultNextTrialId != null
      )
        exit.defaultNextTrialId = String(created.defaultNextTrialId);
      for (const next of created.branches)
        api.addDestination(s, exit, String(next));
    }
    const moving = new Set(roots),
      scopeOrder = (items) => {
        const result = [];
        for (const item of items) {
          const id = String(item?.id ?? item);
          if (existing && id === placeholder) result.push(...roots);
          else if (!existing || !moving.has(id)) result.push(id);
        }
        return [...new Set(result)];
      };
    s.scopeOrder ??= {};
    s.scopeOrder.root = scopeOrder(plan.document.timeline);
    for (const l of plan.document.loops)
      s.scopeOrder[String(l.id)] = scopeOrder(l.trials);
    return targetId;
  };
  const addLoopBranch = (s, sourceId, scopeId, mode = "parallel") =>
    api.applyLoopBranchPlan(
      s,
      services.planLoopBranch(s, sourceId, scopeId, mode),
    );
  Object.assign(api, {
    loopBranchLevels,
    loopConnectionContext,
    loopBranchSelection,
    connectAtLoopLevel,
    applyLoopBranchPlan,
    addLoopBranch,
  });
}
