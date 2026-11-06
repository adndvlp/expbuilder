import { connectionKey, reduceLayoutGraph } from "./layoutGraphReduction";

export type DirectedBlock = {
  id: string;
  left: number;
  right: number;
  height: number;
};
export type DirectedConnection = {
  id: string;
  source: string;
  target: string;
  order: number;
  offset?: number;
  isReturn?: boolean;
  isShortcut?: boolean;
};

// Feedback edges remain in the drawing; only the positioning constraints omit them.
export function orderDirectedGraph(
  ids: string[],
  edges: DirectedConnection[],
  entryId?: string,
  additionalEntries: string[] = [],
) {
  const outgoing = new Map(ids.map((id) => [id, [] as DirectedConnection[]]));
  const incoming = new Set(edges.map((edge) => edge.target));
  edges.forEach((edge) => {
    if (!edge.isReturn) outgoing.get(edge.source)?.push(edge);
  });
  outgoing.forEach((values) =>
    values.sort(
      (a, b) =>
        a.order - b.order ||
        a.target.localeCompare(b.target) ||
        a.id.localeCompare(b.id),
    ),
  );
  const state = new Map<string, number>();
  const returns = new Set(
    edges.filter((edge) => edge.isReturn).map((edge) => edge.id),
  );
  const sorted: string[] = [];
  const seeds = [...ids].sort(
    (a, b) =>
      Number(incoming.has(a)) - Number(incoming.has(b)) || a.localeCompare(b),
  );
  seeds.unshift(
    ...[entryId, ...additionalEntries].filter(
      (id): id is string => id !== undefined && outgoing.has(id),
    ),
  );
  for (const seed of seeds) {
    if (state.has(seed)) continue;
    const stack = [{ id: seed, index: 0 }];
    state.set(seed, 1);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const edge = outgoing.get(frame.id)![frame.index++];
      if (!edge) {
        state.set(frame.id, 2);
        sorted.push(frame.id);
        stack.pop();
      } else if (state.get(edge.target) === 1) returns.add(edge.id);
      else if (!state.has(edge.target)) {
        state.set(edge.target, 1);
        stack.push({ id: edge.target, index: 0 });
      }
    }
  }
  const forward = edges.filter((edge) => !returns.has(edge.id));
  const parents = new Map(ids.map((id) => [id, [] as string[]]));
  const children = new Map(ids.map((id) => [id, [] as string[]]));
  forward
    .sort((a, b) => a.order - b.order || a.target.localeCompare(b.target))
    .forEach((edge) => {
      if (!children.get(edge.source)!.includes(edge.target))
        children.get(edge.source)!.push(edge.target);
      if (!parents.get(edge.target)!.includes(edge.source))
        parents.get(edge.target)!.push(edge.source);
    });
  return { order: sorted.reverse(), parents, children, returns };
}

export function placeDirectedBlocks(
  blocks: DirectedBlock[],
  edges: DirectedConnection[],
  entryId?: string,
) {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const graph = orderDirectedGraph([...byId.keys()], edges, entryId);
  const ranks = new Map<string, number>();
  graph.order.forEach((id) =>
    ranks.set(
      id,
      Math.max(
        0,
        ...graph.parents.get(id)!.map((parent) => ranks.get(parent)! + 1),
      ),
    ),
  );
  // A projected pair may represent both an essential continuation and a bypass.
  const essentialPairs = new Set(
    edges
      .filter((edge) => !edge.isShortcut && !graph.returns.has(edge.id))
      .map((edge) => connectionKey(edge.source, edge.target)),
  );
  const placement = reduceLayoutGraph(
    graph,
    new Set(
      edges
        .filter(
          (edge) =>
            edge.isShortcut &&
            !essentialPairs.has(connectionKey(edge.source, edge.target)),
        )
        .map((edge) => connectionKey(edge.source, edge.target)),
    ),
  );
  const envelopes = new Map<string, { left: number; right: number }>();
  const offsets = new Map<string, Map<string, number>>();
  for (const id of [...graph.order].reverse()) {
    const block = byId.get(id)!;
    const children = [...placement.children.get(id)!];
    const shifts = new Map<string, number>();
    let cursor = 0;
    children.forEach((child, index) => {
      const size = envelopes.get(child)!;
      if (index)
        cursor += envelopes.get(children[index - 1])!.right + size.left + 80;
      shifts.set(child, cursor);
    });
    const center =
      children.length % 2
        ? shifts.get(children[Math.floor(children.length / 2)])!
        : cursor / 2;
    shifts.forEach((value, child) => shifts.set(child, value - center));
    offsets.set(id, shifts);
    const owned = children.filter(
      (child) => placement.parents.get(child)!.length === 1,
    );
    envelopes.set(id, {
      left: Math.max(
        block.left,
        ...owned.map(
          (child) => envelopes.get(child)!.left - shifts.get(child)!,
        ),
      ),
      right: Math.max(
        block.right,
        ...owned.map(
          (child) => envelopes.get(child)!.right + shifts.get(child)!,
        ),
      ),
    });
  }
  const xs = new Map<string, number>();
  const overrides = new Map<string, { sum: number; count: number }>();
  edges.forEach((edge) => {
    if (
      edge.offset === undefined ||
      edge.isShortcut ||
      graph.returns.has(edge.id)
    )
      return;
    const key = JSON.stringify([edge.source, edge.target]);
    const value = overrides.get(key) ?? { sum: 0, count: 0 };
    value.sum += edge.offset;
    value.count++;
    overrides.set(key, value);
  });
  const preferredOffset = (source: string, target: string, split: boolean) => {
    const value = overrides.get(JSON.stringify([source, target]));
    return value
      ? value.sum / value.count
      : split
        ? offsets.get(source)!.get(target)!
        : 0;
  };
  let componentRight = 0;
  graph.order.forEach((id) => {
    const parents = placement.parents.get(id)!;
    if (parents.length) {
      xs.set(
        id,
        parents.reduce(
          (sum, parent) =>
            sum +
            xs.get(parent)! +
            preferredOffset(parent, id, parents.length === 1),
          0,
        ) / parents.length,
      );
    } else {
      const bounds = envelopes.get(id)!;
      xs.set(id, componentRight + bounds.left);
      componentRight += bounds.left + bounds.right + 160;
    }
  });
  const levels = new Map<number, string[]>();
  graph.order.forEach((id) => {
    const rank = ranks.get(id)!;
    const level = levels.get(rank) ?? [];
    level.push(id);
    levels.set(rank, level);
  });
  const positions = new Map<string, { x: number; y: number }>();
  let y = 0;
  for (const [, ids] of [...levels].sort(([a], [b]) => a - b)) {
    ids.sort((a, b) => xs.get(a)! - xs.get(b)! || a.localeCompare(b));
    // Preserve the center of a rank while separating boxes, including loop envelopes.
    const originalCenter = (xs.get(ids[0])! + xs.get(ids[ids.length - 1])!) / 2;
    ids.forEach((id, index) => {
      const parents = placement.parents.get(id)!;
      if (parents.length)
        xs.set(
          id,
          parents.reduce(
            (sum, parent) =>
              sum +
              positions.get(parent)!.x +
              preferredOffset(parent, id, parents.length === 1),
            0,
          ) / parents.length,
        );
      if (index) {
        const previous = ids[index - 1];
        xs.set(
          id,
          Math.max(
            xs.get(id)!,
            xs.get(previous)! +
              byId.get(previous)!.right +
              byId.get(id)!.left +
              80,
          ),
        );
      }
    });
    const drift =
      (xs.get(ids[0])! + xs.get(ids[ids.length - 1])!) / 2 - originalCenter;
    ids.forEach((id) => positions.set(id, { x: xs.get(id)! - drift, y }));
    y += Math.max(...ids.map((id) => byId.get(id)!.height)) + 70;
  }
  return { positions, returns: graph.returns };
}
