import { findItemById } from "./trialUtils";
import {
  findGraphItem,
  getIncomingParentMap,
  itemIdKey,
} from "../../../utils/branchGraphUtils";
import type { BranchGraphItem } from "../../../utils/branchGraphUtils";

export const LAYOUT_CONSTANTS = {
  xTrial: 250,
  yStep: 100,
  branchHorizontalSpacing: 200,
  branchVerticalOffset: 100,
};

export interface LayoutNode {
  id: string;
  type: string;
  data: any;
  position: { x: number; y: number };
  draggable: boolean;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

export function calculateBranchWidth(
  branchId: number | string,
  trials: any[],
  branchHorizontalSpacing: number,
): number {
  const item = findItemById(trials, branchId);
  if (!item) return branchHorizontalSpacing;

  // Check if it has branches (both trials and loops)
  const itemBranches = item.branches || [];

  if (itemBranches.length === 0) {
    return branchHorizontalSpacing;
  }

  // Calculate the total width of all sub-branches
  const subBranchesWidth = itemBranches.reduce(
    (total: number, subBranchId: number | string) => {
      return (
        total +
        calculateBranchWidth(subBranchId, trials, branchHorizontalSpacing)
      );
    },
    0,
  );

  return Math.max(branchHorizontalSpacing, subBranchesWidth);
}

export function createTrialNode(
  id: string,
  name: string,
  x: number,
  y: number,
  isSelected: boolean,
  onClick: () => void,
  onAddBranch?: () => void,
): LayoutNode {
  return {
    id,
    type: "trial",
    data: {
      name,
      selected: isSelected,
      onAddBranch: isSelected ? onAddBranch : undefined,
      onClick,
    },
    position: { x, y },
    draggable: false,
  };
}

export function createLoopNode(
  id: string,
  name: string,
  x: number,
  y: number,
  isSelected: boolean,
  onClick: () => void,
  onAddBranch?: () => void,
  onOpenLoop?: () => void,
): LayoutNode {
  return {
    id,
    type: "loop",
    data: {
      name,
      selected: isSelected,
      onAddBranch: isSelected ? onAddBranch : undefined,
      onOpenLoop,
      onClick,
    },
    position: { x, y },
    draggable: false,
  };
}

export function createEdge(
  source: string,
  target: string,
  edgeType: string = "default",
): LayoutEdge {
  return {
    id: `e${source}-${target}`,
    source,
    target,
    type: edgeType,
  };
}

export function alignMergePointNodes<T extends BranchGraphItem>({
  nodes,
  items,
  mergePointIds,
  branchVerticalOffset,
  getNodeId,
}: {
  nodes: LayoutNode[];
  items: T[];
  mergePointIds: Set<string>;
  branchVerticalOffset: number;
  getNodeId: (item: T) => string;
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentMap = getIncomingParentMap(items);

  const moveBranchSubtree = (
    item: T,
    dx: number,
    dy: number,
    visited: Set<string>,
  ) => {
    (item.branches || []).forEach((branchId) => {
      const branchKey = itemIdKey(branchId);
      if (visited.has(branchKey)) return;

      // Shared children get their own centering pass.
      if (parentMap.get(branchKey)!.length > 1) return;

      const branchItem = findGraphItem(items, branchId);
      if (!branchItem) return;

      const branchNode = nodeById.get(getNodeId(branchItem));
      if (branchNode) {
        branchNode.position = {
          x: branchNode.position.x + dx,
          y: branchNode.position.y + dy,
        };
      }

      visited.add(branchKey);
      moveBranchSubtree(branchItem, dx, dy, visited);
    });
  };

  const mergeItems = Array.from(mergePointIds)
    .map((mergeId) => findGraphItem(items, mergeId))
    .filter((item): item is T => Boolean(item))
    .sort((a, b) => {
      const aNode = nodeById.get(getNodeId(a));
      const bNode = nodeById.get(getNodeId(b));
      return (aNode?.position.y || 0) - (bNode?.position.y || 0);
    });

  mergeItems.forEach((item) => {
    const mergeNode = nodeById.get(getNodeId(item));
    if (!mergeNode) return;

    const parentNodes = (parentMap.get(itemIdKey(item.id)) || [])
      .map((parentId) => findGraphItem(items, parentId))
      .filter((parent): parent is T => Boolean(parent))
      .map((parent) => nodeById.get(getNodeId(parent)))
      .filter((node): node is LayoutNode => Boolean(node));

    if (parentNodes.length < 2) return;

    const centeredX =
      parentNodes.reduce((sum, node) => sum + node.position.x, 0) /
      parentNodes.length;
    const centeredY =
      Math.max(...parentNodes.map((node) => node.position.y)) +
      branchVerticalOffset;
    const dx = centeredX - mergeNode.position.x;
    const dy = centeredY - mergeNode.position.y;

    if (dx === 0 && dy === 0) return;

    mergeNode.position = { x: centeredX, y: centeredY };
    moveBranchSubtree(item, dx, dy, new Set([itemIdKey(item.id)]));
  });
}
