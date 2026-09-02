import { describe, expect, it } from "vitest";
import {
  composeExpandedLoopLayout,
  getScopedNodeId,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import type {
  ExpandedLoopScope,
  LayoutItemId,
  LayoutTimelineItem,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";
import type { GraphBranchEdge } from "../../../pages/ExperimentBuilder/modules/experiment-graph/types";

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

const scope = (
  id: string,
  parentScopeId: string,
  loopId: string,
  timeline: LayoutTimelineItem[],
): ExpandedLoopScope => ({ id, parentScopeId, loopId, timeline });

const flowPairs = (result: ReturnType<typeof composeExpandedLoopLayout>) =>
  result.edges
    .filter((edge) => edge.data.kind === "flow")
    .map((edge) => [edge.source, edge.target]);

const edges: GraphBranchEdge[] = [
  {
    sourceId: "source",
    targetId: "middle-target",
    sourceOwnerId: "inner",
    targetOwnerId: "middle",
    exitedLoopIds: ["inner"],
  },
  {
    sourceId: "source",
    targetId: "outer-target",
    sourceOwnerId: "inner",
    targetOwnerId: "outer",
    exitedLoopIds: ["inner", "middle"],
  },
  {
    sourceId: "source",
    targetId: "root-target",
    sourceOwnerId: "inner",
    targetOwnerId: null,
    exitedLoopIds: ["inner", "middle", "outer"],
  },
];

const scopeParents = { inner: "middle", middle: "outer", outer: null };

describe("loop branch projection", () => {
  it("replaces every expanded loop marker with its visible entry", () => {
    const rootTimeline = [trial("parent", ["outer"]), loop("outer")];
    const outerScope = scope("outer-scope", "root", "outer", [loop("inner")]);
    const innerScope = scope("inner-scope", "outer-scope", "inner", [
      trial("entry"),
    ]);
    const entryEdge: GraphBranchEdge = {
      sourceId: "parent",
      targetId: "outer",
      sourceOwnerId: null,
      targetOwnerId: null,
      exitedLoopIds: [],
    };
    const render = (expandedScopes: ExpandedLoopScope[]) =>
      composeExpandedLoopLayout({
        rootTimeline,
        expandedScopes,
        branchEdges: [entryEdge],
        scopeParents: { inner: "outer", outer: null },
      });
    const parent = getScopedNodeId("root", "trial", "parent");
    const outerMarker = getScopedNodeId("root", "loop", "outer");
    const innerMarker = getScopedNodeId("outer-scope", "loop", "inner");
    const entry = getScopedNodeId("inner-scope", "trial", "entry");

    expect(flowPairs(render([outerScope, innerScope]))).toEqual([
      [parent, entry],
    ]);
    expect(flowPairs(render([outerScope]))).toEqual([[parent, innerMarker]]);
    expect(flowPairs(render([]))).toEqual([[parent, outerMarker]]);
  });

  it("[TD-12] keeps the semantic source trial while every loop is expanded", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [loop("outer"), trial("root-target")],
      expandedScopes: [
        scope("outer-scope", "root", "outer", [
          loop("middle"),
          trial("outer-target"),
        ]),
        scope("middle-scope", "outer-scope", "middle", [
          loop("inner"),
          trial("middle-target"),
        ]),
        scope("inner-scope", "middle-scope", "inner", [
          trial("source", ["middle-target", "outer-target", "root-target"]),
        ]),
      ],
      branchEdges: edges,
      scopeParents,
    });
    const source = getScopedNodeId("inner-scope", "trial", "source");
    const targets = [
      getScopedNodeId("middle-scope", "trial", "middle-target"),
      getScopedNodeId("outer-scope", "trial", "outer-target"),
      getScopedNodeId("root", "trial", "root-target"),
    ];
    const pairs = flowPairs(result);

    targets.forEach((target) => {
      expect(pairs).toContainEqual([source, target]);
      expect(pairs.filter((pair) => pair[1] === target)).toEqual([
        [source, target],
      ]);
    });
  });

  it("[TD-12] projects the source to the nearest collapsed loop", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [loop("outer"), trial("root-target")],
      expandedScopes: [
        scope("outer-scope", "root", "outer", [
          loop("middle"),
          trial("outer-target"),
        ]),
        scope("middle-scope", "outer-scope", "middle", [
          loop("inner"),
          trial("middle-target"),
        ]),
      ],
      branchEdges: edges,
      scopeParents,
    });
    const collapsedInner = getScopedNodeId(
      "middle-scope",
      "loop",
      "inner",
    );
    const middleTarget = getScopedNodeId(
      "middle-scope",
      "trial",
      "middle-target",
    );
    const outerTarget = getScopedNodeId(
      "outer-scope",
      "trial",
      "outer-target",
    );
    const rootTarget = getScopedNodeId("root", "trial", "root-target");

    expect(flowPairs(result)).toContainEqual([collapsedInner, middleTarget]);
    expect(flowPairs(result)).toContainEqual([collapsedInner, outerTarget]);
    expect(flowPairs(result)).toContainEqual([collapsedInner, rootTarget]);
  });

  it("[TD-12] keeps the outermost projection when all loops are collapsed", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [loop("outer"), trial("root-target")],
      expandedScopes: [],
      branchEdges: edges,
      scopeParents,
    });

    expect(flowPairs(result)).toContainEqual([
      getScopedNodeId("root", "loop", "outer"),
      getScopedNodeId("root", "trial", "root-target"),
    ]);
  });

  it("keeps a loop exit separate from an unrelated sibling branch", () => {
    const rootTimeline = [
      trial(1, [2, 3]),
      trial(2, ["loop_4"]),
      trial(3),
      loop("loop_4"),
      trial(5),
    ];
    const exitEdge: GraphBranchEdge = {
      sourceId: 6,
      targetId: 5,
      sourceOwnerId: "loop_4",
      targetOwnerId: null,
      exitedLoopIds: ["loop_4"],
    };
    const expanded = composeExpandedLoopLayout({
      rootTimeline,
      expandedScopes: [
        scope("outer-scope", "root", "loop_4", [
          trial(6, [7, 8, 5]),
          trial(7),
          trial(8),
        ]),
      ],
      branchEdges: [exitEdge],
      scopeParents: { loop_4: null },
    });
    const collapsed = composeExpandedLoopLayout({
      rootTimeline,
      expandedScopes: [],
      branchEdges: [exitEdge],
      scopeParents: { loop_4: null },
    });
    const exit = getScopedNodeId("root", "trial", 5);
    const siblingConvergence = [
      getScopedNodeId("root", "trial", 3),
      exit,
    ];

    expect(flowPairs(expanded)).not.toContainEqual(siblingConvergence);
    expect(flowPairs(collapsed)).not.toContainEqual(siblingConvergence);
    expect(flowPairs(expanded)).toContainEqual([
      getScopedNodeId("outer-scope", "trial", 6),
      exit,
    ]);
    expect(flowPairs(collapsed)).toContainEqual([
      getScopedNodeId("root", "loop", "loop_4"),
      exit,
    ]);
  });
});
