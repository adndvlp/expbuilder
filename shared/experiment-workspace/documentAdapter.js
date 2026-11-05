import { FINISH, idKey, normalizeNavigation } from "./navigation.js";

export function toModel(document) {
  return {
    schema: "branching-workspace-model/2",
    name: document.name ?? "",
    entryId: idKey(document.entryItemId),
    sequence: 1,
    notes: [],
    anchors: structuredClone(document.editorLayout?.positionsByItemId ?? {}),
    scopeOrder: Object.fromEntries([
      ["root", document.timeline.map((i) => idKey(i.id))],
      ...document.loops.map((l) => [idKey(l.id), l.trials.map(idKey)]),
    ]),
    trials: document.trials.map((t) => ({
      ...structuredClone(t),
      id: idKey(t.id),
      parentLoopId: idKey(t.parentLoopId),
      defaultNextTrialId: idKey(t.defaultNextTrialId),
      destinationOrder: (t.destinationOrder ?? t.branches).map(idKey),
      thenGoTo: t.branchConditions.map(({ nextTrialId, ...r }) => ({
        ...structuredClone(r),
        targetId: idKey(nextTrialId),
      })),
    })),
    loops: document.loops.map((l) => ({
      ...structuredClone(l),
      id: idKey(l.id),
      parentLoopId: idKey(l.parentLoopId),
      entryId: idKey(l.entryItemId),
      nextId: idKey(l.nextItemId),
      expanded: false,
    })),
  };
}

export function modelDocument(s) {
  const all = [...s.trials, ...s.loops];
  const own = (owner) => {
    const ids = all.filter((i) => i.parentLoopId === owner).map((i) => i.id);
    return [
      ...new Set([...(s.scopeOrder[owner ?? "root"] ?? []), ...ids]),
    ].filter((id) => ids.includes(id));
  };
  return {
    experimentID: "workspace",
    entryItemId: s.entryId,
    timeline: own(null).map((id) => ({
      id,
      type: s.loops.some((l) => l.id === id) ? "loop" : "trial",
    })),
    trials: s.trials.map((t) => ({
      ...t,
      branches: [
        ...new Set(
          [t.defaultNextTrialId, ...t.thenGoTo.map((r) => r.targetId)].filter(
            (id) => s.trials.some((t) => t.id === id),
          ),
        ),
      ],
      branchConditions: t.thenGoTo.map(({ targetId, ...r }) => ({
        ...r,
        rules: r.rules ?? [],
        nextTrialId: targetId,
      })),
    })),
    loops: s.loops.map((l) => ({
      ...l,
      entryItemId: l.entryId,
      nextItemId: l.nextId,
      trials: own(l.id),
    })),
  };
}

export function fromModel(state, original, { allocateId } = {}) {
  const document = structuredClone(original),
    model = modelDocument(state),
    idMap = new Map(
      [...document.trials, ...document.loops].map((i) => [idKey(i.id), i.id]),
    );
  let nextTrial = Math.max(
    document.nextWorkspaceTrialId ?? 1,
    ...document.trials
      .map((t) => Number(t.id))
      .filter(Number.isSafeInteger)
      .map((id) => id + 1),
  );
  let nextLoop = Math.max(
    document.nextWorkspaceLoopId ?? 1,
    ...document.loops
      .map((l) => Number(String(l.id).match(/^loop_(\d+)$/)?.[1]) + 1)
      .filter(Number.isSafeInteger),
  );
  for (const [kind, items] of [
    ["trial", model.trials],
    ["loop", model.loops],
  ])
    for (const value of items)
      if (!idMap.has(value.id)) {
        let id = allocateId?.(kind, document);
        if (id === undefined) {
          if (kind === "trial") id = nextTrial++;
          else {
            do {
              id = `loop_workspace_${nextLoop++}`;
            } while ([...idMap.values()].includes(id));
          }
        }
        if (kind === "trial") nextTrial = Math.max(nextTrial, Number(id) + 1);
        else {
          const seed = String(id).match(/^loop_(\d+)$/)?.[1];
          if (seed) nextLoop = Math.max(nextLoop, Number(seed) + 1);
        }
        idMap.set(value.id, id);
        (kind === "trial" ? document.trials : document.loops).push({
          ...value,
          id,
        });
      }
  const target = (id) =>
    id == null || id === FINISH ? id : idMap.get(idKey(id));
  document.trials = model.trials.map((t) => {
    const value = {
      type: "Trial",
      plugin: "plugin-dynamic",
      parameters: {},
      trialCode: "",
      ...t,
      id: target(t.id),
      parentLoopId: target(t.parentLoopId),
      defaultNextTrialId: target(t.defaultNextTrialId),
      destinationOrder: t.destinationOrder?.map(target),
      branchConditions: [],
    };
    const used = new Set(
      t.branchConditions
        .filter((c) => typeof c.id === "number")
        .map((c) => c.id),
    );
    let next = 1;
    value.branchConditions = t.branchConditions.map((c) => {
      let id = c.id;
      if (typeof id !== "number") {
        while (used.has(next)) next++;
        id = next++;
        used.add(id);
      }
      return {
        ...c,
        id,
        kind: c.kind ?? "route",
        rules: c.rules ?? [],
        nextTrialId: target(c.nextTrialId),
      };
    });
    delete value.thenGoTo;
    return normalizeNavigation(value);
  });
  document.loops = model.loops.map((l) => {
    const value = {
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      orderColumns: [],
      categories: false,
      categoryColumn: "",
      categoryData: [],
      code: "",
      ...l,
      id: target(l.id),
      parentLoopId: target(l.parentLoopId),
      entryItemId: target(l.entryItemId),
      nextItemId: target(l.nextItemId),
      trials: l.trials.map(target),
    };
    delete value.entryId;
    delete value.nextId;
    delete value.expanded;
    return value;
  });
  const entry = [...state.trials, ...state.loops].find(
    (i) => i.id === state.entryId,
  );
  let root = entry;
  while (root?.parentLoopId)
    root = state.loops.find((l) => l.id === root.parentLoopId);
  document.entryItemId = target(root?.id ?? null);
  document.timeline = model.timeline.map((i) => {
    const item = [...document.trials, ...document.loops].find(
      (t) => idKey(t.id) === idKey(target(i.id)),
    );
    return { id: item.id, type: i.type, name: item.name };
  });
  document.editorLayout = {
    positionsByItemId: Object.fromEntries(
      Object.entries(state.anchors)
        .filter(
          ([id]) =>
            idMap.has(id) &&
            [...state.trials, ...state.loops].some((i) => i.id === id),
        )
        .map(([id, p]) => [idKey(target(id)), p]),
    ),
  };
  document.nextWorkspaceTrialId = nextTrial;
  document.nextWorkspaceLoopId = nextLoop;
  return { document, idMap: Object.fromEntries(idMap) };
}
