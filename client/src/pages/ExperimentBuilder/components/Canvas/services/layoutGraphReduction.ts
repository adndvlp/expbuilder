type Adjacency = {
  order: string[];
  children: Map<string, string[]>;
};

export const connectionKey = (source: string, target: string) =>
  JSON.stringify([source, target]);

// Only horizontal placement uses this reduction; every semantic edge is retained.
export function reduceLayoutGraph(
  graph: Adjacency,
  ignored = new Set<string>(),
) {
  const rank = new Map(graph.order.map((id, index) => [id, index]));
  const reachable = new Map<string, Set<string>>();
  const children = new Map<string, string[]>();
  const parents = new Map(graph.order.map((id) => [id, [] as string[]]));
  for (const id of [...graph.order].reverse()) {
    const covered = new Set<string>();
    const direct = new Set<string>();
    const candidates = [...graph.children.get(id)!].sort(
      (a, b) => rank.get(a)! - rank.get(b)!,
    );
    for (const child of candidates) {
      if (ignored.has(connectionKey(id, child))) continue;
      if (!covered.has(child)) direct.add(child);
      covered.add(child);
      reachable.get(child)?.forEach((target) => covered.add(target));
    }
    reachable.set(id, covered);
    const retained = graph.children
      .get(id)!
      .filter((child) => direct.has(child));
    children.set(id, retained);
    retained.forEach((child) => parents.get(child)!.push(id));
  }
  return { children, parents };
}
