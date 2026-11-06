import { required, hasId } from "../valueUtils.js";
import { isModelLoop } from "../types.js";
import type { ModelInternals } from "../modelContracts.js";
export function create(api: () => ModelInternals) {
  const deleteTrial: ModelInternals["deleteTrial"] = (s, id) => {
    if (!api().realTrial(s, id)) return;
    s.trials = s.trials.filter((t) => t.id !== id);
    for (const t of s.trials) {
      if (t.defaultNextTrialId === id) t.defaultNextTrialId = null;
      t.thenGoTo = t.thenGoTo.filter((r) => r.targetId !== id);
      if (t.destinationOrder)
        t.destinationOrder = t.destinationOrder.filter(
          (target) => target !== id,
        );
    }
    for (const l of s.loops) {
      if (l.entryId === id) l.entryId = null;
      if (l.nextId === id) l.nextId = null;
    }
    if (s.entryId === id) s.entryId = null;
    if (s.scopeOrder)
      Object.keys(s.scopeOrder).forEach(
        (key) =>
          (s.scopeOrder[key] = s.scopeOrder[key].filter(
            (target) => target !== id,
          )),
      );
    delete s.anchors[id];
  };
  const deleteLoop: ModelInternals["deleteLoop"] = (s, id) => {
    const loop = s.loops.find((l) => l.id === id);
    if (!loop) return;
    // Match the app's ungroupLoop: remove the scope, keep its contents and decisions.
    const children = api().members(s, id),
      order = s.scopeOrder?.[id] ?? children.map((i) => i.id);
    const childIds = [
      ...new Set([...order, ...children.map((i) => i.id)]),
    ].filter((childId) => children.some((i) => i.id === childId));
    const replacement = loop.entryId ?? loop.nextId ?? null,
      parentId = loop.parentLoopId;
    s.loops = s.loops.filter((l) => l.id !== id);
    children.forEach((i) => (i.parentLoopId = parentId));
    for (const l of s.loops) {
      if (l.entryId === id) l.entryId = replacement;
      if (l.nextId === id) l.nextId = replacement;
    }
    if (s.entryId === id) s.entryId = replacement;
    if (s.scopeOrder) {
      const key = parentId ?? "root",
        parentOrder = s.scopeOrder[key] ?? [],
        position = parentOrder.indexOf(id);
      s.scopeOrder[key] = parentOrder.filter(
        (childId) => childId !== id && !childIds.includes(childId),
      );
      s.scopeOrder[key].splice(
        position < 0 ? s.scopeOrder[key].length : position,
        0,
        ...childIds,
      );
      delete s.scopeOrder[id];
    }
    delete s.anchors[id];
  };
  const deleteItems: ModelInternals["deleteItems"] = (s, ids) => {
    for (const id of new Set(ids))
      if (api().realTrial(s, id)) api().deleteTrial(s, id);
    for (const id of new Set(ids))
      if (s.loops.some((l) => l.id === id)) api().deleteLoop(s, id);
  };
  const addTrial: ModelInternals["addTrial"] = (
    s,
    position = { x: 800, y: 100 },
  ) => {
    const id = api().uniqueId(s, "trial");
    s.trials.push(api().trial(id, `New Trial ${s.sequence - 1}`));
    s.anchors[id] = { ...position };
    return id;
  };
  const addChild: ModelInternals["addChild"] = (
    s,
    parentId,
    mode = "parallel",
  ) => {
    const parent = api().realTrial(s, parentId);
    if (!parent) throw Error("Parent must be a trial");
    const id = api().addTrial(s),
      child = required(api().realTrial(s, id));
    child.parentLoopId = parent.parentLoopId;
    if (mode === "sequential") {
      child.defaultNextTrialId = parent.defaultNextTrialId;
      child.thenGoTo = api().copy(parent.thenGoTo);
      parent.defaultNextTrialId = null;
      parent.thenGoTo = [];
    }
    api().connect(s, parentId, id);
    return id;
  };
  const groupLoop: ModelInternals["groupLoop"] = (s, ids, name = "Loop") => {
    if (!ids.length) throw Error("Select at least one item");
    const marked = new Set(ids);
    if ([...marked].some((id) => !api().item(s, id)))
      throw Error("Unknown item");
    // A selected loop already carries its descendants; never flatten it.
    const selected = [...marked]
      .map((id) => required(api().item(s, id)))
      .filter(
        (i) =>
          !api()
            .ancestors(s, i)
            .some((l) => marked.has(l.id)),
      );
    const owner = selected[0].parentLoopId;
    if (selected.some((i) => i.parentLoopId !== owner))
      throw Error("Choose items in the same scope");
    const c = required(api().componentFor(s, selected[0].id));
    if (selected.some((i) => !c.ids.has(i.id)))
      throw Error("Selecciona una sola estructura conectada.");
    const chosen = new Set(selected.map((i) => i.id)),
      reverse = new Map<string, Set<string>>();
    const unit = (id: string | null | undefined) => {
      const value = api().item(s, id);
      return value?.parentLoopId === owner
        ? id
        : (api()
            .ancestors(s, value)
            .find((l) => l.parentLoopId === owner)?.id ?? null);
    };
    const join = (source: string, target: string | null) => {
      const from = unit(source),
        to = unit(target);
      if (!hasId(chosen, from) || !hasId(chosen, to) || from === to) return;
      if (!reverse.has(to)) reverse.set(to, new Set<string>());
      required(reverse.get(to)).add(from);
    };
    api()
      .connections(s)
      .forEach((e) => join(e.source, e.target));
    selected
      .filter(isModelLoop)
      .forEach((l) => join(l.id, api().resolve(s, l.nextId)));
    const scopeEntry = unit(
      api().resolve(
        s,
        owner
          ? required(s.loops.find((l) => l.id === owner)).entryId
          : s.entryId,
      ),
    );
    const order = api().entryOrder(s, chosen, unit);
    if (hasId(chosen, scopeEntry)) {
      order.splice(order.indexOf(scopeEntry), 1);
      order.unshift(scopeEntry);
    }
    const heads = api().sourceHeads(order, reverse);
    if (heads.length !== 1)
      throw Error(
        "Selecciona una estructura con una sola entrada, sin saltar trials intermedios.",
      );
    const key = owner ?? "root",
      direct = new Set(
        api()
          .members(s, owner)
          .map((i) => i.id),
      );
    const parentOrder = [
      ...new Set([...(s.scopeOrder?.[key] ?? []), ...direct]),
    ].filter((id) => direct.has(id));
    const position = parentOrder.findIndex((id) => chosen.has(id)),
      id = api().uniqueId(s, "loop");
    s.loops.push({
      id,
      name,
      parentLoopId: owner,
      entryId: heads[0],
      nextId: null,
      repetitions: 1,
      expanded: true,
    });
    if (owner && hasId(chosen, scopeEntry))
      required(s.loops.find((l) => l.id === owner)).entryId = id;
    s.scopeOrder ??= {};
    s.scopeOrder[key] = parentOrder.filter((child) => !chosen.has(child));
    s.scopeOrder[key].splice(position, 0, id);
    s.scopeOrder[id] = [
      heads[0],
      ...parentOrder.filter((child) => chosen.has(child) && child !== heads[0]),
    ];
    selected.forEach((i) => (i.parentLoopId = id));
    return id;
  };
  return {
    deleteTrial,
    deleteLoop,
    deleteItems,
    addTrial,
    addChild,
    groupLoop,
  };
}
