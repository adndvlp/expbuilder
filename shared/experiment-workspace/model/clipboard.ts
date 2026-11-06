import { isWorkspaceState } from "../fragment.js";
import { required, hasId } from "../valueUtils.js";
import { isModelLoop } from "../types.js";
import type { Point } from "../types.js";
import type { ModelInternals, ModelServices } from "../modelContracts.js";
export function create(api: () => ModelInternals, services: ModelServices) {
  const layout: ModelInternals["layout"] = (s) => services.layout(s);
  const moveComponent: ModelInternals["moveComponent"] = (s, id, dx, dy) => {
    const c = api().componentFor(s, id);
    if (!c || c.locked) return;
    const before = api().layout(s);
    for (const key of c.ids)
      if (before.positions[key])
        s.anchors[key] = {
          x: before.positions[key].x + dx,
          y: before.positions[key].y + dy,
        };
  };
  const copyItems: ModelInternals["copyItems"] = (s, ids) => {
    const selected = new Set(ids);
    if (!selected.size) return null;
    if ([...selected].some((id) => !api().item(s, id)))
      throw Error("Unknown item");
    // Copy the induced graph. Only explicitly selected loop containers carry
    // descendants; selecting a trial never pulls in its unselected neighbours.
    const all = [...s.trials, ...s.loops],
      included = new Set(
        all
          .filter(
            (i) =>
              selected.has(i.id) ||
              api()
                .ancestors(s, i)
                .some((l) => selected.has(l.id)),
          )
          .map((i) => i.id),
      );
    const target = (id: string | null) =>
      hasId(included, id) ? id : id === api().FINISH ? api().FINISH : null;
    const trials = s.trials
      .filter((t) => included.has(t.id))
      .map((t) => ({
        ...api().copy(t),
        parentLoopId: hasId(included, t.parentLoopId) ? t.parentLoopId : null,
        defaultNextTrialId: target(t.defaultNextTrialId),
        thenGoTo: api().copy(
          t.thenGoTo.filter(
            (r) =>
              !r.targetId ||
              r.targetId === api().FINISH ||
              included.has(r.targetId),
          ),
        ),
        destinationOrder: (t.destinationOrder ?? []).filter((id) =>
          included.has(id),
        ),
      }));
    const loops = s.loops
      .filter((l) => included.has(l.id))
      .map((l) => ({
        ...api().copy(l),
        parentLoopId: hasId(included, l.parentLoopId) ? l.parentLoopId : null,
        entryId: target(l.entryId),
        nextId: target(l.nextId),
      }));
    const ordered = (owner: string | null) => {
      const direct = api()
        .members(s, owner)
        .map((i) => i.id);
      return [
        ...new Set([...(s.scopeOrder?.[owner ?? "root"] ?? []), ...direct]),
      ].filter((id) => direct.includes(id));
    };
    const forest: string[] = [],
      visit = (owner: string | null) => {
        for (const id of ordered(owner)) {
          forest.push(id);
          if (s.loops.some((l) => l.id === id)) visit(id);
        }
      };
    visit(null);
    const roots = new Set(
      [...trials, ...loops]
        .filter((i) => i.parentLoopId === null)
        .map((i) => i.id),
    );
    const scopeOrder: Record<string, string[]> = {
      root: forest.filter((id) => roots.has(id)),
    };
    for (const l of loops)
      scopeOrder[l.id] = ordered(l.id).filter((id) => included.has(id));
    const visible = api().layout(s).positions,
      missing = [...included].some((id) => !visible[id]);
    const expanded = missing ? api().copy(s) : null;
    if (expanded)
      expanded.loops.forEach((l) => {
        l.expanded = true;
      });
    const hidden = expanded ? api().layout(expanded).positions : {},
      positions: Record<string, Point> = {};
    for (const id of included)
      if (visible[id] ?? hidden[id])
        positions[id] = api().copy(visible[id] ?? hidden[id]);
    return {
      schema: "branching-workspace-fragment/1",
      trials,
      loops,
      scopeOrder,
      positions,
    };
  };
  const pasteItems: ModelInternals["pasteItems"] = (
    s,
    fragment,
    offset = { x: 48, y: 48 },
  ) => {
    if (
      fragment?.schema !== "branching-workspace-fragment/1" ||
      !Array.isArray(fragment.trials) ||
      !fragment.trials.length ||
      !Array.isArray(fragment.loops)
    )
      throw Error("No es una copia de trials válida.");
    const all = [...fragment.trials, ...fragment.loops],
      originalIds = new Set(all.map((i) => i.id));
    if (
      originalIds.size !== all.length ||
      all.some((i) => typeof i.id !== "string") ||
      fragment.trials.some((t) => !Array.isArray(t.thenGoTo)) ||
      !Number.isFinite(offset.x) ||
      !Number.isFinite(offset.y)
    )
      throw Error("No es una copia de trials válida.");
    const before = api().layout(s).positions,
      rootOrder = [
        ...new Set([
          ...(s.scopeOrder?.root ?? []),
          ...api()
            .members(s, null)
            .map((i) => i.id),
        ]),
      ];
    const idMap = Object.fromEntries(
      all.map((i) => [
        i.id,
        api().uniqueId(s, isModelLoop(i) ? "loop" : "trial"),
      ]),
    );
    const remap = (id: string | null): string | null =>
      hasId(originalIds, id)
        ? idMap[id]
        : id === api().FINISH
          ? api().FINISH
          : null;
    const names = new Set([...s.trials, ...s.loops].map((i) => i.name)),
      ruleIds = new Set(s.trials.flatMap((t) => t.thenGoTo.map((r) => r.id)));
    const nameFor = (name: string) => {
      const original = String(name || "Trial")
        .trim()
        .replace(/(?:\s+\(copia(?:\s+\d+)?\))+$/i, "")
        .trim();
      const match = original.match(/^(.*?)(?:\s+(\d+))?$/),
        base = match?.[1]?.trim() || original || "Trial";
      const next = Math.max(2, Number(match?.[2] ?? 1) + 1);
      const value = services.createUniqueItemName(
        { trials: [...names].map((name) => ({ name })) },
        `${base} ${next}`,
        "Trial",
      );
      names.add(value);
      return value;
    };
    const trials = fragment.trials.map((t) => ({
      ...api().copy(t),
      id: idMap[t.id],
      name: nameFor(t.name),
      parentLoopId: remap(t.parentLoopId),
      defaultNextTrialId: remap(t.defaultNextTrialId),
      thenGoTo: t.thenGoTo
        .filter(
          (r) =>
            !r.targetId ||
            r.targetId === api().FINISH ||
            originalIds.has(r.targetId),
        )
        .map((r) => {
          let id;
          do {
            id = api().uniqueId(s, "condition");
          } while (ruleIds.has(id));
          ruleIds.add(id);
          return { ...api().copy(r), id, targetId: remap(r.targetId) };
        }),
      destinationOrder: (t.destinationOrder ?? [])
        .filter((id) => hasId(originalIds, id))
        .map((id) => required(remap(id))),
    }));
    const loops = fragment.loops.map((l) => ({
      ...api().copy(l),
      id: idMap[l.id],
      name: nameFor(l.name),
      parentLoopId: remap(l.parentLoopId),
      entryId: remap(l.entryId),
      nextId: remap(l.nextId),
    }));
    const scopeOrder = Object.fromEntries(
      Object.entries(fragment.scopeOrder ?? {}).map(([scope, order]) => [
        scope === "root" ? "root" : remap(scope),
        order
          .filter((id) => hasId(originalIds, id))
          .map((id) => required(remap(id))),
      ]),
    );
    s.trials.push(...trials);
    s.loops.push(...loops);
    s.scopeOrder ??= {};
    s.scopeOrder.root = [...rootOrder, ...(scopeOrder.root ?? [])];
    for (const l of loops) s.scopeOrder[l.id] = scopeOrder[l.id] ?? [];
    // Measure with the production layout at origin. Anchor both the copies and
    // any previously auto-placed islands, so pasting cannot displace originals.
    const desired = { ...before };
    for (const i of all) {
      const from = fragment.positions?.[i.id];
      if (from) {
        if (!Number.isFinite(from.x) || !Number.isFinite(from.y))
          throw Error("La copia no contiene posiciones válidas.");
        desired[idMap[i.id]] = { x: from.x + offset.x, y: from.y + offset.y };
      }
    }
    for (const component of api()
      .components(s)
      .filter((c) => !c.locked)) {
      if (![...component.ids].some((id) => desired[id]))
        throw Error("La copia no contiene posiciones válidas.");
      for (const id of component.ids)
        if (desired[id]) s.anchors[id] = { ...desired[id] };
    }
    return { ids: all.map((i) => idMap[i.id]), idMap };
  };
  const compile: ModelInternals["compile"] = (s) => {
    const active = api().reachable(s);
    return {
      schema: "branching-execution-demo/1",
      name: s.name,
      entryId: api().resolve(s, s.entryId),
      trials: api().copy(s.trials.filter((t) => active.trials.has(t.id))),
      loops: api().copy(
        s.loops
          .filter((l) => active.loops.has(l.id))
          .map((loop) => {
            const value = { ...loop };
            Reflect.deleteProperty(value, "expanded");
            return value;
          }),
      ),
    };
  };
  const serialize: ModelInternals["serialize"] = (s) =>
    JSON.stringify(s, null, 2);
  const restore: ModelInternals["restore"] = (json) => {
    const s: unknown = JSON.parse(json);
    if (!isWorkspaceState(s)) throw Error("Not a saved workspace demo");
    return s;
  };
  return {
    layout,
    moveComponent,
    copyItems,
    pasteItems,
    compile,
    serialize,
    restore,
  };
}
