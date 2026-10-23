import { vi } from "vitest";
import type {
  TimelineItem,
  GraphBranchEdge,
} from "../../../pages/ExperimentBuilder/modules/experiment-graph/types";
import {
  buildUnifiedFlowLayout,
  getLoopLayoutScopeId,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import type { ExpandedLoopEntry } from "../../../pages/ExperimentBuilder/components/Canvas/hooks/useExpandedLoopPath";

export const trial = (id: string, branches: string[] = []): TimelineItem => ({
  id,
  name: id,
  type: "trial",
  branches,
  defaultNextTrialId: branches[0] ?? null,
});
export const loop = (
  id: string,
  nextItemId: string | null = null,
): TimelineItem => ({
  id,
  name: id,
  type: "loop",
  nextItemId,
});

export function scene(
  root: TimelineItem[],
  expandedPath: ExpandedLoopEntry[] = [],
  entry = "A",
) {
  const scopes = [
    { owner: null as string | null, items: root },
    ...expandedPath.map((value) => ({
      owner: String(value.loop.id),
      items: value.items,
    })),
  ];
  const ownerById = new Map(
    scopes.flatMap((scope) =>
      scope.items.map((item) => [String(item.id), scope.owner] as const),
    ),
  );
  const branchEdges: GraphBranchEdge[] = scopes.flatMap((scope) =>
    scope.items.flatMap((item) =>
      (item.branches ?? []).map((targetId) => ({
        sourceId: item.id,
        targetId,
        sourceOwnerId: scope.owner,
        targetOwnerId: ownerById.get(String(targetId)) ?? null,
        exitedLoopIds: [] as string[],
      })),
    ),
  );
  const scopeParents = Object.fromEntries(
    expandedPath.map((value) => [
      String(value.loop.id),
      value.loop.parentLoopId ?? null,
    ]),
  );
  for (const edge of branchEdges) {
    const ancestors = new Set<string | null>([null]);
    let parent = edge.targetOwnerId;
    while (parent != null && !ancestors.has(parent)) {
      ancestors.add(parent);
      parent = scopeParents[parent] ?? null;
    }
    parent = edge.sourceOwnerId;
    while (parent != null && !ancestors.has(parent)) {
      edge.exitedLoopIds.push(parent);
      parent = scopeParents[parent] ?? null;
    }
  }
  return {
    timeline: root,
    expandedPath,
    branchEdges,
    scopeParents,
    entryItemIds: Object.fromEntries([
      ["root", entry],
      ...expandedPath.map((value) => [
        getLoopLayoutScopeId(value.loop.id),
        value.items[0]?.id ?? null,
      ]),
    ]),
    selectedItemId: null,
    selectedScopeId: null,
    onSelectTrial: vi.fn(),
    onSelectLoop: vi.fn(),
    onToggleLoop: vi.fn(),
    onAddBranch: vi.fn(),
  };
}

export const render = (items: TimelineItem[], entry = "A") =>
  buildUnifiedFlowLayout(scene(items, [], entry));
export const node = (
  result: ReturnType<typeof buildUnifiedFlowLayout>,
  id: string,
) => {
  const found = result.nodes.find((value) => value.data.itemId === id);
  if (!found) throw new Error(`Missing node ${id}`);
  return found;
};
export const center = (
  result: ReturnType<typeof buildUnifiedFlowLayout>,
  id: string,
) => {
  const value = node(result, id);
  return value.position.x + value.measured.width / 2;
};
export const diamond = (shared = true) => [
  trial("A", ["B", "C"]),
  trial("B", ["D"]),
  trial("C", shared ? ["D"] : []),
  trial("D"),
];

export function nestedScene(depth = 3) {
  const expandedPath: ExpandedLoopEntry[] = Array.from(
    { length: depth },
    (_, i) => ({
      loop: {
        id: `L${i}`,
        name: `Loop ${i}`,
        parentLoopId: i ? `L${i - 1}` : null,
      },
      items:
        i === depth - 1
          ? [trial(`P${i}`, ["P0", "T"])]
          : [trial(`P${i}`, [`P${i + 1}`]), loop(`L${i + 1}`)],
    }),
  );
  return scene([trial("A", ["P0"]), loop("L0", "T"), trial("T")], expandedPath);
}
