import { describe, expect, it } from "vitest";
import { composeExpandedLoopLayout } from "../../../pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import type {
  ExpandedCanvasLayout,
  ExpandedLoopScope,
  LayoutItemId,
  LayoutTimelineItem,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";
import { getLoopScopeLanes } from "../../../pages/ExperimentBuilder/components/Canvas/services/loopScopeGeometry";
import type { GraphBranchEdge } from "../../../pages/ExperimentBuilder/modules/experiment-graph/types";

const SUBTREE_GAP = 80;

const trial = (
  id: LayoutItemId,
  branches: LayoutItemId[] = [],
): LayoutTimelineItem => ({ id, type: "trial", name: String(id), branches });

const loop = (
  id: LayoutItemId,
  branches: LayoutItemId[] = [],
): LayoutTimelineItem => ({
  id,
  type: "loop",
  name: String(id),
  branches,
});

const edge = (
  sourceId: LayoutItemId,
  targetId: LayoutItemId,
  sourceOwnerId: string | null,
  targetOwnerId: string | null,
  exitedLoopIds: string[] = [],
): GraphBranchEdge => ({
  sourceId,
  targetId,
  sourceOwnerId,
  targetOwnerId,
  exitedLoopIds,
});

const rootTimeline = [
  trial("start", ["left", "right"]),
  trial("left", ["outer"]),
  trial("right", ["right-a", "right-b"]),
  trial("right-a", ["right-tail"]),
  trial("right-tail"),
  trial("right-b"),
  loop("outer"),
  trial("outer-exit"),
  trial("nested-exit"),
];

const outerScope: ExpandedLoopScope = {
  id: "outer-scope",
  parentScopeId: "root",
  loopId: "outer",
  timeline: [
    trial("outer-source", [
      "outer-left",
      "outer-exit",
      "nested",
      "outer-right",
    ]),
    trial("outer-left"),
    loop("nested"),
    trial("outer-right"),
  ],
};

const nestedScope: ExpandedLoopScope = {
  id: "nested-scope",
  parentScopeId: "outer-scope",
  loopId: "nested",
  timeline: [
    trial("nested-source", ["nested-left", "nested-exit"]),
    trial("nested-left"),
  ],
};

const branchEdges = [
  edge("start", "left", null, null),
  edge("start", "right", null, null),
  edge("left", "outer", null, null),
  edge("right", "right-a", null, null),
  edge("right", "right-b", null, null),
  edge("right-a", "right-tail", null, null),
  edge("outer-source", "outer-left", "outer", "outer"),
  edge("outer-source", "outer-exit", "outer", null, ["outer"]),
  edge("outer-source", "nested", "outer", "outer"),
  edge("outer-source", "outer-right", "outer", "outer"),
  edge("nested-source", "nested-left", "nested", "nested"),
  edge("nested-source", "nested-exit", "nested", null, ["nested", "outer"]),
];

const horizontalBounds = (
  layout: ExpandedCanvasLayout,
  itemIds: ReadonlySet<string>,
) => {
  const nodes = layout.nodes.filter((node) =>
    itemIds.has(String(node.data.itemId)),
  );
  expect(nodes.length).toBeGreaterThan(0);
  return {
    minX: Math.min(...nodes.map((node) => node.position.x)),
    maxX: Math.max(
      ...nodes.map((node) => node.position.x + node.measured.width),
    ),
  };
};

describe("sibling branch envelopes around loops", () => {
  it.each([
    ["collapsed", []],
    ["expanded", [outerScope, nestedScope]],
  ] as const)(
    "keeps every descendant of a lateral branch outside the %s loop branch",
    (_state, expandedScopes) => {
      const layout = composeExpandedLoopLayout({
        rootTimeline,
        expandedScopes,
        branchEdges,
        scopeParents: { nested: "outer", outer: null },
      });
      const loopBranch = horizontalBounds(
        layout,
        new Set([
          "left",
          "outer",
          "outer-source",
          "outer-left",
          "outer-right",
          "nested",
          "nested-source",
          "nested-left",
          "outer-exit",
          "nested-exit",
        ]),
      );
      const lateralBranch = horizontalBounds(
        layout,
        new Set(["right", "right-a", "right-tail", "right-b"]),
      );
      const loopCircuitRight = getLoopScopeLanes(
        layout.nodes,
        expandedScopes,
      ).get("outer-scope")?.rightX;
      const loopEnvelopeRight = Math.max(
        loopBranch.maxX,
        loopCircuitRight ?? Number.NEGATIVE_INFINITY,
      );
      expect(lateralBranch.minX - loopEnvelopeRight).toBeGreaterThanOrEqual(
        SUBTREE_GAP,
      );
    },
  );
});
