import type { GraphBranchEdge } from "../../../modules/experiment-graph/types";
import { addExpandedFlowEdges } from "./expandedEdgeFactory";
import { ROOT_CANVAS_SCOPE_ID } from "./expandedLayoutTypes";
import type {
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
  ExpandedLoopScope,
} from "./expandedLayoutTypes";

const idKey = (id: string | number) => String(id);
const ownerKey = (id: string | null) =>
  id === null ? "root" : `loop:${idKey(id)}`;

export const getCanonicalBranchEdgeId = (edge: GraphBranchEdge) =>
  JSON.stringify([
    ownerKey(edge.sourceOwnerId),
    idKey(edge.sourceId),
    ownerKey(edge.targetOwnerId),
    idKey(edge.targetId),
  ]);

type RenderedEndpointBlock = {
  entryId: string;
  exitIds: readonly string[];
};

const edgeKey = (edge: {
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  data: { kind: string };
}) =>
  [
    edge.data.kind,
    edge.source,
    edge.target,
    edge.sourceHandle,
    edge.targetHandle,
  ].join("\u0000");

export function getCanonicalBranchTargets(
  edges: readonly GraphBranchEdge[],
  scopes: readonly ExpandedLoopScope[],
) {
  const layoutScopeByOwner = new Map<string | null, string>([
    [null, ROOT_CANVAS_SCOPE_ID],
  ]);
  scopes.forEach((scope) =>
    layoutScopeByOwner.set(idKey(scope.loopId), scope.id),
  );
  const targets = new Map<string, Set<string>>();
  edges.forEach((edge) => {
    const scopeId = layoutScopeByOwner.get(
      edge.targetOwnerId === null ? null : idKey(edge.targetOwnerId),
    );
    if (!scopeId) return;
    const scopeTargets = targets.get(scopeId) ?? new Set<string>();
    scopeTargets.add(idKey(edge.targetId));
    targets.set(scopeId, scopeTargets);
  });
  return targets;
}

function findItemNode(
  nodes: readonly ExpandedCanvasNode[],
  itemId: string | number,
) {
  return nodes.find((node) => idKey(node.data.itemId) === idKey(itemId));
}

function resolveVisibleNodes(
  nodes: readonly ExpandedCanvasNode[],
  itemId: string | number,
  ownerId: string | null,
  scopeParents: Readonly<Record<string, string | null>>,
  renderedBlocks: ReadonlyMap<string, RenderedEndpointBlock>,
  endpoint: "source" | "target",
) {
  const directNode = findItemNode(nodes, itemId);
  if (directNode) {
    const block = directNode.data.expanded
      ? renderedBlocks.get(directNode.id)
      : undefined;
    const nodeIds = block
      ? endpoint === "source"
        ? block.exitIds
        : [block.entryId]
      : [directNode.id];
    return nodeIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is ExpandedCanvasNode => Boolean(node));
  }

  const visited = new Set<string>();
  let scopeId = ownerId;
  while (scopeId !== null && !visited.has(scopeId)) {
    visited.add(scopeId);
    const container = findItemNode(nodes, scopeId);
    if (container) return [container];
    scopeId = scopeParents[scopeId] ?? null;
  }
  return [];
}

export function addCanonicalBranchEdges(
  layout: ExpandedCanvasLayout,
  edges: readonly GraphBranchEdge[],
  scopeParents: Readonly<Record<string, string | null>>,
  renderedBlocks: ReadonlyMap<string, RenderedEndpointBlock>,
) {
  const collector = {
    edges: layout.edges,
    edgeKeys: new Set(layout.edges.map(edgeKey)),
  };
  edges.forEach((edge) => {
    const sources = resolveVisibleNodes(
      layout.nodes,
      edge.sourceId,
      edge.sourceOwnerId,
      scopeParents,
      renderedBlocks,
      "source",
    );
    const targets = resolveVisibleNodes(
      layout.nodes,
      edge.targetId,
      edge.targetOwnerId,
      scopeParents,
      renderedBlocks,
      "target",
    );
    targets.forEach((target) => {
      const visibleSources = sources.filter(
        (source) => source.id !== target.id,
      );
      if (visibleSources.length === 0) return;
      addExpandedFlowEdges(
        collector,
        visibleSources.map((source) => source.id),
        target.id,
        visibleSources[0]!.data.scopeId,
        edge.exitedLoopIds.length > 0 ? "scope-exit" : undefined,
        getCanonicalBranchEdgeId(edge),
      );
    });
  });
}
