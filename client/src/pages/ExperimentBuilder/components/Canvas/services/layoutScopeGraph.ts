import type {
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
  ExpandedLoopScope,
  LayoutItemId,
  LayoutTimelineItem,
} from "./expandedLayoutTypes";
import { reduceLayoutGraph } from "./layoutGraphReduction";
import {
  orderDirectedGraph,
  placeDirectedBlocks,
  type DirectedConnection,
} from "./directedLayout";
import {
  getLoopScopeLanes,
  layoutExpandedLoopMarkers,
} from "./loopScopeGeometry";

type Bounds = { left: number; right: number; top: number; bottom: number };
type Block = {
  id: string;
  nodes: ExpandedCanvasNode[];
  bounds: Bounds;
  anchor: number;
  entryId: string;
  exits: Map<string, number>;
};

export function layoutScopeGraph(
  layout: ExpandedCanvasLayout,
  scopes: readonly ExpandedLoopScope[],
  markerOffset: number,
  entryItemIds: Readonly<Record<string, LayoutItemId | null>> = {},
  rootTimeline: readonly LayoutTimelineItem[] = [],
  semanticOrders: ReadonlyMap<string, number> = new Map(),
) {
  const scopeById = new Map(scopes.map((scope) => [scope.id, scope]));
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const markerByScope = new Map(
    scopes.flatMap((scope) => {
      const marker = layout.nodes.find(
        (node) =>
          node.data.expanded &&
          node.data.scopeId === scope.parentScopeId &&
          String(node.data.itemId) === String(scope.loopId),
      );
      return marker ? [[scope.id, marker] as const] : [];
    }),
  );
  const childByMarker = new Map(
    [...markerByScope].map(([id, marker]) => [marker.id, id]),
  );
  const priority = new Map<string, Map<string, number>>();
  [{ id: "root", timeline: rootTimeline }, ...scopes].forEach((scope) =>
    scope.timeline.forEach((item) =>
      priority.set(
        `${scope.id}:${item.id}`,
        new Map((item.branches ?? []).map((id, index) => [String(id), index])),
      ),
    ),
  );
  const flow = layout.edges.filter((edge) => edge.data.kind === "flow");
  const edgeOrder = (edge: ExpandedCanvasLayout["edges"][number]) => {
    const authored = (edge.data.semanticEdgeIds ?? [])
      .map((id) => semanticOrders.get(id))
      .filter((order): order is number => order !== undefined);
    if (authored.length) return Math.min(...authored);
    const source = nodeById.get(edge.source)!;
    return (
      priority
        .get(`${source.data.scopeId}:${source.data.itemId}`)
        ?.get(String(nodeById.get(edge.target)!.data.itemId)) ??
      Number.MAX_SAFE_INTEGER
    );
  };
  function entryNode(
    scopeId: string,
    seen = new Set<string>(),
  ): ExpandedCanvasNode | undefined {
    if (seen.has(scopeId)) return;
    seen.add(scopeId);
    const node = layout.nodes.find(
      (value) =>
        value.data.scopeId === scopeId &&
        String(value.data.itemId) === String(entryItemIds[scopeId]),
    );
    const child = node && childByMarker.get(node.id);
    return child ? entryNode(child, seen) : node;
  }
  const entries = ["root", ...scopes.map((scope) => scope.id).sort()]
    .map((scopeId) => entryNode(scopeId)?.id)
    .filter((id): id is string => id !== undefined);
  const graph = orderDirectedGraph(
    layout.nodes.map((node) => node.id),
    flow.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      order: edgeOrder(edge),
    })),
    entries[0],
    entries.slice(1),
  );
  const reduced = reduceLayoutGraph(graph);
  flow.forEach((edge) => {
    if (graph.returns.has(edge.id)) edge.data.isReturn = true;
    else if (!reduced.children.get(edge.source)!.includes(edge.target))
      edge.data.isShortcut = true;
  });
  const visited = new Set<string>();

  function project(
    node: ExpandedCanvasNode,
    scopeId: string,
  ): string | undefined {
    if (node.data.scopeId === scopeId) return node.id;
    let current = node.data.scopeId;
    const seen = new Set<string>();
    while (!seen.has(current)) {
      seen.add(current);
      const scope = scopeById.get(current);
      if (!scope) return;
      if (scope.parentScopeId === scopeId)
        return markerByScope.get(current)?.id;
      current = scope.parentScopeId;
    }
  }

  function arrange(scopeId: string): Block | undefined {
    if (visited.has(scopeId)) return;
    visited.add(scopeId);
    const own = layout.nodes.filter((node) => node.data.scopeId === scopeId);
    const blocks: Block[] = own.map((node) => {
      const childScope = childByMarker.get(node.id);
      if (childScope) {
        const child = arrange(childScope);
        if (child) return { ...child, id: node.id };
      }
      node.position = { x: 0, y: 0 };
      return {
        id: node.id,
        nodes: [node],
        bounds: {
          left: 0,
          right: node.measured.width,
          top: 0,
          bottom: node.measured.height,
        },
        anchor: node.measured.width / 2,
        entryId: node.id,
        exits: new Map(),
      };
    });
    if (!blocks.length) return;
    const byId = new Map(blocks.map((block) => [block.id, block]));
    const edges: DirectedConnection[] = [];
    const external = new Map<string, string>();
    for (const edge of flow) {
      const source = nodeById.get(edge.source),
        target = nodeById.get(edge.target);
      if (!source || !target) continue;
      const from = project(source, scopeId),
        to = project(target, scopeId);
      if (!from || !byId.has(from)) continue;
      if (!to && !edge.data.isReturn && !edge.data.isShortcut) {
        if (!byId.has(target.id))
          byId.set(target.id, {
            id: target.id,
            nodes: [],
            bounds: {
              left: 0,
              top: 0,
              right: target.measured.width,
              bottom: target.measured.height,
            },
            anchor: target.measured.width / 2,
            entryId: target.id,
            exits: new Map(),
          });
        external.set(edge.id, target.id);
      }
      const targetBlock = to ?? external.get(edge.id);
      if (!targetBlock || !byId.has(targetBlock)) continue;
      if (from === to && edge.source !== edge.target) continue;
      edges.push({
        id: edge.id,
        source: from,
        target: targetBlock,
        order: edgeOrder(edge),
        offset: byId.get(from)!.exits.get(edge.id),
        isReturn: edge.data.isReturn,
        isShortcut: edge.data.isShortcut,
      });
    }
    const declared = own.find(
      (node) => String(node.data.itemId) === String(entryItemIds[scopeId]),
    );
    const result = placeDirectedBlocks(
      [...byId.values()].map((block) => ({
        id: block.id,
        left: block.anchor - block.bounds.left,
        right: block.bounds.right - block.anchor,
        height: block.bounds.bottom - block.bounds.top,
      })),
      edges,
      declared?.id,
    );
    for (const edge of flow)
      if (result.returns.has(edge.id)) edge.data.isReturn = true;
    blocks.forEach((block) => {
      const position = result.positions.get(block.id)!;
      const dx = position.x - block.anchor,
        dy = position.y - block.bounds.top;
      block.nodes.forEach((node) => {
        node.position = { x: node.position.x + dx, y: node.position.y + dy };
      });
    });
    const nodes = blocks.flatMap((block) => block.nodes);
    const entry = declared
      ? byId.get(declared.id)!
      : (blocks.find(
          (block) =>
            !edges.some(
              (edge) =>
                edge.target === block.id && !result.returns.has(edge.id),
            ),
        ) ?? blocks.slice().sort((a, b) => a.id.localeCompare(b.id))[0]);
    const entryNode = nodeById.get(entry.entryId)!;
    if (scopeId === "root") {
      const dx = 590 - (entryNode.position.x + entryNode.measured.width / 2);
      const dy = 80 - Math.min(...nodes.map((node) => node.position.y));
      nodes.forEach((node) => {
        node.position = { x: node.position.x + dx, y: node.position.y + dy };
      });
      layout.entryId = entry.entryId;
    }
    const marker = markerByScope.get(scopeId);
    if (marker) {
      layoutExpandedLoopMarkers(
        [...nodes, marker],
        scopes.filter(
          (scope) =>
            scope.id === scopeId ||
            nodes.includes(markerByScope.get(scope.id)!),
        ),
        markerOffset,
      );
      nodes.push(marker);
    }
    const lanes = getLoopScopeLanes(nodes, scopes).get(scopeId);
    return {
      id: scopeId,
      nodes,
      entryId: entry.entryId,
      anchor: entryNode.position.x + entryNode.measured.width / 2,
      exits: new Map(
        [...external].map(([edgeId, targetId]) => [
          edgeId,
          result.positions.get(targetId)!.x -
            (entryNode.position.x + entryNode.measured.width / 2),
        ]),
      ),
      bounds: {
        left: Math.min(...nodes.map((node) => node.position.x)),
        right: Math.max(
          lanes?.rightX ?? -Infinity,
          ...nodes.map(
            (node) =>
              node.position.x +
              node.measured.width +
              (node.type === "loop" ? 12 : 0),
          ),
        ),
        top: Math.min(
          lanes?.topY ?? Infinity,
          ...nodes.map(
            (node) => node.position.y - (node.type === "loop" ? 12 : 0),
          ),
        ),
        bottom: Math.max(
          lanes?.bottomY ?? -Infinity,
          ...nodes.map((node) => node.position.y + node.measured.height + 40),
        ),
      },
    };
  }
  arrange("root");
  layout.edges.sort((a, b) => {
    if (a.data.kind !== "flow" || b.data.kind !== "flow")
      return Number(a.data.kind !== "flow") - Number(b.data.kind !== "flow");
    const left = nodeById.get(a.source)!.position,
      right = nodeById.get(b.source)!.position;
    return left.y - right.y || left.x - right.x || a.id.localeCompare(b.id);
  });
  return layout;
}
