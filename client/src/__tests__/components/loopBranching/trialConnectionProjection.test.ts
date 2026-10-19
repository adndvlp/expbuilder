import { describe, expect, it, vi } from "vitest";
import {
  composeExpandedLoopLayout,
  getScopedNodeId,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import { getCanonicalBranchEdgeId } from "../../../pages/ExperimentBuilder/components/Canvas/services/canonicalBranchProjection";
import { buildUnifiedFlowLayout } from "../../../pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import type {
  ExpandedLoopScope,
  LayoutTimelineItem,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";
import type { GraphBranchEdge } from "../../../pages/ExperimentBuilder/modules/experiment-graph/types";

const trial = (id: string, branches: string[] = []): LayoutTimelineItem => ({
  id,
  name: id,
  type: "trial",
  branches,
});
const loop = (id: string): LayoutTimelineItem => ({
  id,
  name: id,
  type: "loop",
});
const edge = (
  sourceId: string,
  targetId: string,
  sourceOwnerId: string | null,
  targetOwnerId: string | null,
): GraphBranchEdge => ({
  sourceId,
  targetId,
  sourceOwnerId,
  targetOwnerId,
  exitedLoopIds:
    sourceOwnerId && sourceOwnerId !== targetOwnerId ? [sourceOwnerId] : [],
});
const id = (scope: string, type: "trial" | "loop", item: string) =>
  getScopedNodeId(scope, type, item);
const flow = (layout: ReturnType<typeof composeExpandedLoopLayout>) =>
  layout.edges.filter((e) => e.data.kind === "flow");

describe("trial connections projected onto loop containers", () => {
  const rootTimeline = [
    trial("a", ["b", "c"]),
    loop("outer"),
    trial("x"),
    trial("y"),
  ];
  const outer: ExpandedLoopScope = {
    id: "outer-scope",
    parentScopeId: "root",
    loopId: "outer",
    timeline: [trial("first"), trial("b", ["x"]), loop("inner")],
  };
  const inner: ExpandedLoopScope = {
    id: "inner-scope",
    parentScopeId: "outer-scope",
    loopId: "inner",
    timeline: [trial("inner-first"), trial("c", ["x", "y"])],
  };
  const branchEdges = [
    edge("a", "b", null, "outer"),
    edge("a", "c", null, "inner"),
    edge("b", "x", "outer", null),
    edge("c", "x", "inner", null),
    edge("c", "y", "inner", null),
  ];
  const scopeParents = { outer: null, inner: "outer" };

  it.each([
    { name: "collapsed", expandedScopes: [] },
    { name: "outer expanded", expandedScopes: [outer] },
    { name: "fully expanded", expandedScopes: [outer, inner] },
  ])(
    "preserves each real connection and input when $name",
    ({ expandedScopes }) => {
      const before = JSON.stringify({
        rootTimeline,
        expandedScopes,
        branchEdges,
        scopeParents,
      });
      const result = composeExpandedLoopLayout({
        rootTimeline,
        expandedScopes,
        branchEdges,
        scopeParents,
      });
      const connections = flow(result);
      const source = id("root", "trial", "a");
      const b = expandedScopes.length
        ? id("outer-scope", "trial", "b")
        : id("root", "loop", "outer");
      const c =
        expandedScopes.length === 2
          ? id("inner-scope", "trial", "c")
          : expandedScopes.length
            ? id("outer-scope", "loop", "inner")
            : id("root", "loop", "outer");
      const expected = [
        [source, b],
        [source, c],
        [b, id("root", "trial", "x")],
        [c, id("root", "trial", "x")],
        [c, id("root", "trial", "y")],
      ];
      branchEdges.forEach((canonical, index) => {
        const projection = connections.find((e) =>
          e.data.semanticEdgeIds?.includes(getCanonicalBranchEdgeId(canonical)),
        );
        expect(projection && [projection.source, projection.target]).toEqual(
          expected[index],
        );
      });
      expect(
        connections
          .filter((e) => e.source === source)
          .every((e) => e.data.semanticEdgeIds?.length),
      ).toBe(true);
      expect(connections).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source,
            target: id("outer-scope", "trial", "first"),
          }),
        ]),
      );
      expect(
        JSON.stringify({
          rootTimeline,
          expandedScopes,
          branchEdges,
          scopeParents,
        }),
      ).toBe(before);
    },
  );

  it("keeps an incoming trial in its container sequence", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline,
      expandedScopes: [outer, inner],
      branchEdges,
      scopeParents,
    });
    expect(flow(result).map((e) => [e.source, e.target])).toContainEqual([
      id("outer-scope", "trial", "first"),
      id("outer-scope", "trial", "b"),
    ]);
    expect(flow(result).map((e) => [e.source, e.target])).toContainEqual([
      id("inner-scope", "trial", "inner-first"),
      id("inner-scope", "trial", "c"),
    ]);
  });

  it.each(["collapsed", "expanded"])(
    "projects a connection between sibling loops when %s",
    (state) => {
      const canonical = edge("source", "target", "left", "right");
      const expandedScopes =
        state === "expanded"
          ? [
              {
                id: "left-scope",
                parentScopeId: "root",
                loopId: "left",
                timeline: [trial("source", ["target"])],
              },
              {
                id: "right-scope",
                parentScopeId: "root",
                loopId: "right",
                timeline: [
                  trial("right-first"),
                  trial("target"),
                  trial("right-last"),
                ],
              },
            ]
          : [];
      const result = composeExpandedLoopLayout({
        rootTimeline: [loop("left"), loop("right")],
        expandedScopes,
        branchEdges: [canonical],
        scopeParents: { left: null, right: null },
      });
      const projection = flow(result).find((e) =>
        e.data.semanticEdgeIds?.includes(getCanonicalBranchEdgeId(canonical)),
      );
      expect(projection).toMatchObject(
        state === "expanded"
          ? {
              source: id("left-scope", "trial", "source"),
              target: id("right-scope", "trial", "target"),
            }
          : {
              source: id("root", "loop", "left"),
              target: id("root", "loop", "right"),
            },
      );
      if (state === "expanded")
        expect(flow(result)).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              source: id("left-scope", "trial", "source"),
              target: id("right-scope", "trial", "right-first"),
            }),
          ]),
        );
    },
  );

  it("ignores loop branch metadata and real loop endpoints", () => {
    const root = [
      trial("a"),
      {
        ...loop("l"),
        branches: ["z"],
        branchConditions: [{ nextTrialId: "z" }],
      },
      trial("next"),
      trial("z"),
    ];
    const result = composeExpandedLoopLayout({
      rootTimeline: root,
      expandedScopes: [],
      branchEdges: [edge("a", "l", null, null), edge("l", "z", null, null)],
    });
    expect(flow(result).every((e) => !e.data.semanticEdgeIds?.length)).toBe(
      true,
    );
    expect(flow(result).map((e) => [e.source, e.target])).toEqual([
      [id("root", "trial", "a"), id("root", "loop", "l")],
      [id("root", "loop", "l"), id("root", "trial", "next")],
      [id("root", "trial", "next"), id("root", "trial", "z")],
    ]);
  });

  it("does not expose an add-branch callback on a selected loop", () => {
    const result = buildUnifiedFlowLayout({
      timeline: [loop("l")],
      expandedPath: [],
      selectedItemId: "l",
      selectedScopeId: null,
      onSelectTrial: vi.fn(),
      onSelectLoop: vi.fn(),
      onToggleLoop: vi.fn(),
      onAddBranch: vi.fn(),
    });
    expect(result.nodes[0]?.data.onAddBranch).toBeUndefined();
  });
});
