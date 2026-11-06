import { required, hasId, last } from "../valueUtils.js";
import type { ModelInternals } from "../modelContracts.js";
export function create(api: () => ModelInternals) {
  const normalizeConnection: ModelInternals["normalizeConnection"] = (
    s,
    a,
    ha,
    b,
    hb,
  ) => {
    if (!api().realTrial(s, a) || !api().realTrial(s, b) || ha === hb)
      return null;
    if (ha === "bottom" && hb === "top") return { source: a, target: b };
    if (ha === "top" && hb === "bottom") return { source: b, target: a };
    return null;
  };
  const entryOrder: ModelInternals["entryOrder"] = (
    s,
    ids,
    unit = (id) => id,
  ) =>
    [
      ...new Set(
        [
          ...(s.scopeOrder?.root ?? []),
          ...s.trials.map((t) => t.id),
          ...s.loops.map((l) => l.id),
          ...ids,
        ].map(unit),
      ),
    ].filter((id): id is string => hasId(ids, id));
  const sourceHeads: ModelInternals["sourceHeads"] = (order, reverse) => {
    // One representative per source component, including cycles. Saved order breaks ties.
    const allowed = new Set(order),
      forward = new Map<string, string[]>(order.map((id) => [id, []]));
    for (const target of order)
      for (const source of reverse.get(target) ?? [])
        if (allowed.has(source))
          required(forward.get(source) ?? []).push(target);
    const seen = new Set<string>(),
      finished: string[] = [];
    const visit = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const next of forward.get(id) ?? []) visit(next);
      finished.push(id);
    };
    order.forEach(visit);
    const groups = new Map<string, number>();
    let count = 0;
    const assign = (id: string, group: number) => {
      if (groups.has(id)) return;
      groups.set(id, group);
      for (const parent of reverse.get(id) ?? [])
        if (allowed.has(parent)) assign(parent, group);
    };
    for (const id of finished.reverse())
      if (!groups.has(id)) assign(id, count++);
    const incoming = new Set<number>();
    for (const source of order)
      for (const target of forward.get(source) ?? [])
        if (groups.get(source) !== groups.get(target))
          incoming.add(required(groups.get(target)));
    const chosen = new Set<number>();
    return order.filter((id) => {
      const group = required(groups.get(id));
      if (incoming.has(group) || chosen.has(group)) return false;
      chosen.add(group);
      return true;
    });
  };
  const remainingStart: ModelInternals["remainingStart"] = (s) => {
    const unit = (id: string | null | undefined) => {
      const value = api().item(s, id);
      return value ? (last(api().ancestors(s, value))?.id ?? id) : null;
    };
    const units = new Set(
        s.trials
          .map((t) => unit(t.id))
          .filter((id): id is string => id != null && !!api().resolve(s, id)),
      ),
      reverse = new Map<string, Set<string>>();
    const join = (source: string, target: string | null) => {
      const from = unit(source),
        to = unit(target);
      if (!hasId(units, from) || !hasId(units, to) || from === to) return;
      if (!reverse.has(to)) reverse.set(to, new Set<string>());
      required(reverse.get(to)).add(from);
    };
    api()
      .connections(s)
      .forEach((e) => join(e.source, e.target));
    s.loops.forEach((l) => join(l.id, api().resolve(s, l.nextId)));
    return api().resolve(
      s,
      api().sourceHeads(api().entryOrder(s, units, unit), reverse)[0],
    );
  };
  const survivingContinuation: ModelInternals["survivingContinuation"] = (
    s,
    before,
  ) => {
    // Walk the original decisions before deletion: Default first, then Then go to.
    const outgoing = new Map<string, string[]>();
    for (const edge of api().connections(before)) {
      if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
      required(outgoing.get(edge.source)).push(edge.target);
    }
    const seen = new Set<string>(),
      pending = [api().resolve(before, before.entryId)];
    while (pending.length) {
      const id = pending.pop();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (api().realTrial(s, id)) return id;
      const next = [
        ...(outgoing.get(id) ?? []),
        ...api()
          .ancestors(before, api().realTrial(before, id))
          .map((l) => api().resolve(before, l.nextId)),
      ];
      pending.push(...next.filter(Boolean).reverse());
    }
    return null;
  };
  const prefixHeads: ModelInternals["prefixHeads"] = (s, entry) => {
    const live = api().reachable(s),
      pending = new Set(
        s.trials.filter((t) => !live.trials.has(t.id)).map((t) => t.id),
      );
    // Collapse inactive loop scopes into their existing entry units. Loop
    // repetitions do not create extra possible starts.
    const unit = (id: string | null | undefined) => {
      const value = api().item(s, id);
      if (!value) return null;
      return (
        last(
          api()
            .ancestors(s, value)
            .filter((l) => !live.loops.has(l.id)),
        )?.id ?? id
      );
    };
    const reverse = new Map(),
      terminals = new Set<string>();
    const predecessor = (source: string, target: string) => {
      const from = unit(source);
      if (!from) return;
      if (target === entry) {
        terminals.add(from);
        return;
      }
      if (!pending.has(target)) return;
      const to = unit(target);
      if (!to || from === to) return;
      if (!reverse.has(to)) reverse.set(to, new Set<string>());
      required(reverse.get(to)).add(from);
    };
    for (const edge of api().connections(s))
      if (pending.has(edge.source)) predecessor(edge.source, edge.target);
    for (const l of s.loops)
      if (!live.loops.has(l.id)) {
        const next = api().resolve(s, l.nextId);
        if (next) predecessor(l.id, next);
      }
    if (!terminals.size) return [];
    const upstream = new Set<string>(),
      queue = [...terminals];
    while (queue.length) {
      const id = queue.pop();
      if (id == null || upstream.has(id)) continue;
      upstream.add(id);
      queue.push(...(reverse.get(id) ?? []));
    }
    return api().sourceHeads(api().entryOrder(s, upstream, unit), reverse);
  };
  const reconcileGraph: ModelInternals["reconcileGraph"] = (s, before = s) => {
    // Every connected trial has a fallback among its existing destinations.
    // Keep its Default, or use the first surviving destination, without changing conditions.
    const firstDestination = new Map<string, string>();
    for (const edge of api().connections(s))
      if (!firstDestination.has(edge.source))
        firstDestination.set(edge.source, edge.target);
    for (const t of s.trials)
      if (firstDestination.has(t.id) && t.defaultPolicy !== "preserve-terminal")
        t.defaultNextTrialId = required(firstDestination.get(t.id));
    api().reconcileLoops(s);
    // A nonempty workspace always has one executable start. Repair it once per transaction.
    if (!api().resolve(s, s.entryId))
      s.entryId =
        api().survivingContinuation(s, before) ?? api().remainingStart(s);
    const entry = api().resolve(s, s.entryId);
    if (!entry) return s;
    const heads = prefixHeads(s, entry);
    if (!heads.length) return s;
    if (
      before !== s &&
      api().resolve(before, before.entryId) === entry &&
      JSON.stringify(prefixHeads(before, entry)) === JSON.stringify(heads)
    )
      return s;
    s.entryId = api().resolve(s, heads[0]);
    return s;
  };
  const editGraph: ModelInternals["editGraph"] = (s, command, ...args) => {
    const draft = api().copy(s),
      result = command(draft, ...args);
    api().reconcileGraph(draft, s);
    Object.assign(s, draft);
    return result;
  };
  return {
    normalizeConnection,
    entryOrder,
    sourceHeads,
    prefixHeads,
    remainingStart,
    survivingContinuation,
    reconcileGraph,
    editGraph,
  };
}
