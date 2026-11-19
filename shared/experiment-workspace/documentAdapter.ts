import type {
  WorkspaceSourceDocument,
  ModelState,
  GraphDocument,
  ItemId,
  ModelItem,
  ModelRule,
} from "./types.js";
import type { Trial, Loop } from "./records.js";
import type { CommandOptions } from "./commandTypes.js";
import { required } from "./valueUtils.js";
import { FINISH, idKey, normalizeNavigation } from "./navigation.js";

export function toModel(document: WorkspaceSourceDocument): ModelState {
  return {
    schema: "branching-workspace-model/2",
    name: document.name ?? "",
    entryId: idKey(document.entryItemId),
    sequence: 1,
    notes: [],
    anchors: structuredClone(document.editorLayout?.positionsByItemId ?? {}),
    scopeOrder: Object.fromEntries([
      ["root", document.timeline.map((i) => idKey(i.id))],
      ...document.loops.map((l) => [
        idKey(l.id),
        l.trials.map((id) => idKey(id)),
      ]),
    ]),
    trials: document.trials.map((t) => ({
      ...structuredClone(t),
      id: idKey(t.id),
      parentLoopId: idKey(t.parentLoopId),
      defaultNextTrialId: idKey(t.defaultNextTrialId),
      destinationOrder: (t.destinationOrder ?? t.branches ?? []).map((id) =>
        idKey(id),
      ),
      thenGoTo: (t.branchConditions ?? []).map(({ nextTrialId, ...r }) => ({
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
      repetitions: l.repetitions ?? 1,
    })),
  };
}

export function modelDocument(
  s: ModelState,
): GraphDocument & WorkspaceSourceDocument {
  const all = [...s.trials, ...s.loops];
  const own = (owner: string | null) => {
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
            (id): id is string =>
              id != null && s.trials.some((t) => t.id === id),
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

export function fromModel(
  state: ModelState,
  original: WorkspaceSourceDocument,
  { allocateId }: CommandOptions = {},
) {
  const document = structuredClone(original),
    model = modelDocument(state),
    idMap = new Map<string, ItemId>(
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
  const allocationDocument: GraphDocument & WorkspaceSourceDocument = {
    ...document,
    trials: document.trials.map((t) => ({
      ...t,
      branches: t.branches ?? [],
      branchConditions: t.branchConditions ?? [],
    })),
  };
  for (const [kind, items] of [
    ["trial", model.trials],
    ["loop", model.loops],
  ] as const)
    for (const value of items)
      if (!idMap.has(String(value.id))) {
        let id = allocateId?.(kind, allocationDocument);
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
        idMap.set(String(value.id), id);
        if (kind === "trial" && "defaultNextTrialId" in value)
          allocationDocument.trials.push({ ...value, id });
        else if ("trials" in value)
          allocationDocument.loops.push({ ...value, id });
      }
  function target(id: ItemId): ItemId;
  function target(id: ItemId | null | undefined): ItemId | null;
  function target(id: ItemId | null | undefined): ItemId | null {
    return id == null || id === FINISH
      ? (id ?? null)
      : required(idMap.get(idKey(id)));
  }

  const loopId = (id: ItemId | null | undefined): string | null => {
    const value = target(id);
    if (value != null && typeof value !== "string")
      throw Error("Invalid loop ID");
    return value;
  };
  document.trials = model.trials.map((t) => {
    const value: Trial & { thenGoTo?: ModelRule[] } = {
      type: "Trial",
      plugin: "plugin-dynamic",
      parameters: {},
      trialCode: "",
      ...t,
      id: target(t.id),
      parentLoopId: loopId(t.parentLoopId),
      defaultNextTrialId: target(t.defaultNextTrialId),
      destinationOrder: t.destinationOrder?.map((id) => target(id)),
      branchConditions: [],
    };
    const used = new Set(
      t.branchConditions
        .filter((c) => typeof c.id === "number")
        .map((c) => c.id),
    );
    let next = 1;
    value.branchConditions = (t.branchConditions ?? []).map((c) => {
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
    const value: Loop & {
      entryId?: string | null;
      nextId?: string | null;
      expanded?: boolean;
    } = {
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
      id: required(loopId(l.id)),
      parentLoopId: loopId(l.parentLoopId),
      entryItemId: target(l.entryItemId),
      nextItemId: target(l.nextItemId),
      trials: l.trials.map((id) => target(id)),
    };
    delete value.entryId;
    delete value.nextId;
    delete value.expanded;
    return value;
  });
  const entry = [...state.trials, ...state.loops].find(
    (i) => i.id === state.entryId,
  );
  let root: ModelItem | undefined = entry;
  while (root?.parentLoopId) {
    const ownerId = root.parentLoopId;
    root = state.loops.find((l) => l.id === ownerId);
  }
  document.entryItemId = target(root?.id ?? null);
  document.timeline = model.timeline.map((i) => {
    const item = required(
      [...document.trials, ...document.loops].find(
        (t) => idKey(t.id) === idKey(target(i.id)),
      ),
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
  return {
    document: { ...document, trials: document.trials, loops: document.loops },
    idMap: Object.fromEntries(idMap),
  };
}
