import type { ExpandedCanvasNode } from "./expandedLayoutTypes";
import type { LoopCircuitHorizontalBounds } from "./loopScopeGeometry";

const NODE_WIDTH = 180;

type LoopAwareBranchBoundsInput = {
  nodes: ExpandedCanvasNode[];
  nodeIds: ReadonlySet<string>;
  circuitBounds: ReadonlyMap<string, LoopCircuitHorizontalBounds>;
};

export function getLoopAwareBranchBounds({
  nodes,
  nodeIds,
  circuitBounds,
}: LoopAwareBranchBoundsInput) {
  const ownedCircuits = [...circuitBounds.entries()]
    .filter(([markerId]) => nodeIds.has(markerId))
    .map(([, bounds]) => bounds);
  return {
    minX: Math.min(
      ...nodes.map((node) => node.position.x),
      ...ownedCircuits.map((bounds) => bounds.left),
    ),
    maxX: Math.max(
      ...nodes.map((node) => node.position.x + NODE_WIDTH),
      ...ownedCircuits.map((bounds) => bounds.right),
    ),
  };
}
