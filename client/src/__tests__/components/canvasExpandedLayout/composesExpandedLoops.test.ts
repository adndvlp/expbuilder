import { describe, expect, it } from "vitest";
import {
  composeExpandedLoopLayout,
  getScopedNodeId,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import { ROOT_CANVAS_SCOPE_ID } from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";
import type {
  ExpandedLoopScope,
  LayoutTimelineItem,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

const trial = (
  id: string | number,
  branches?: Array<string | number>,
): LayoutTimelineItem => ({ id, type: "trial", name: `Trial ${id}`, branches });

const loop = (id: string, trials: Array<string | number> = []): LayoutTimelineItem => ({
  id,
  type: "loop",
  name: `Loop ${id}`,
  trials,
});

const scope = (
  id: string,
  parentScopeId: string,
  loopId: string,
  timeline: LayoutTimelineItem[],
): ExpandedLoopScope => ({ id, parentScopeId, loopId, timeline });

const pairs = (
  result: ReturnType<typeof composeExpandedLoopLayout>,
  kind: "flow" | "loop-control" | "loop-return",
) =>
  result.edges
    .filter((edge) => edge.data.kind === kind)
    .map((edge) => [edge.source, edge.target]);

describe("composeExpandedLoopLayout", () => {
  it("namespaces a collapsed root timeline and keeps its normal sequence", () => {
    const input = {
      rootTimeline: [trial(1), loop("practice"), trial(2)],
      expandedScopes: [],
    };

    const first = composeExpandedLoopLayout(input);
    const second = composeExpandedLoopLayout(input);
    const start = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", 1);
    const marker = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "practice");
    const end = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", 2);

    expect(first).toEqual(second);
    expect(first.nodes.map((node) => node.id)).toEqual([start, marker, end]);
    expect(pairs(first, "flow")).toEqual([
      [start, marker],
      [marker, end],
    ]);
    expect(
      first.edges.filter((edge) => edge.data.kind === "flow"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "default" }),
      ]),
    );
    expect(first.nodes.find((node) => node.id === marker)?.data.role).toBe(
      "item",
    );
  });

  it("replaces an expanded loop entry while preserving its lateral marker", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [trial("start"), loop("practice"), trial("end")],
      expandedScopes: [
        scope("practice-scope", ROOT_CANVAS_SCOPE_ID, "practice", [
          trial("first"),
          trial("last"),
        ]),
      ],
    });
    const start = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "start");
    const marker = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "practice");
    const end = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "end");
    const first = getScopedNodeId("practice-scope", "trial", "first");
    const last = getScopedNodeId("practice-scope", "trial", "last");

    expect(pairs(result, "flow")).toEqual([
      [start, first],
      [first, last],
      [last, end],
    ]);
    expect(pairs(result, "loop-control")).toEqual([
      [first, marker],
      [marker, last],
    ]);
    expect(pairs(result, "loop-return")).toEqual([[last, first]]);

    const nodes = new Map(result.nodes.map((node) => [node.id, node]));
    expect(nodes.get(marker)?.data).toMatchObject({
      expanded: true,
      role: "loop-marker",
    });
    expect(nodes.get(marker)!.position.x).toBeLessThan(
      nodes.get(first)!.position.x,
    );
    expect(nodes.get(marker)!.position.y).toBe(
      (nodes.get(first)!.position.y + nodes.get(last)!.position.y) / 2,
    );
    expect(nodes.get(end)!.position.y).toBeGreaterThan(
      nodes.get(last)!.position.y,
    );
  });

  it("routes a one-item expanded loop without crossing its control edges", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [trial("before"), loop("single"), trial("after")],
      expandedScopes: [
        scope("single-scope", ROOT_CANVAS_SCOPE_ID, "single", [
          trial("only"),
        ]),
      ],
    });
    const marker = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "single");
    const only = getScopedNodeId("single-scope", "trial", "only");
    const entryControl = result.edges.find(
      (edge) => edge.source === only && edge.target === marker,
    );
    const exitControl = result.edges.find(
      (edge) => edge.source === marker && edge.target === only,
    );
    const loopReturn = result.edges.find(
      (edge) =>
        edge.source === only &&
        edge.target === only &&
        edge.data.kind === "loop-return",
    );

    expect(entryControl).toMatchObject({
      type: "smoothstep",
      sourceHandle: "loop-entry-source",
      targetHandle: "loop-return-target",
    });
    expect(exitControl).toMatchObject({
      type: "smoothstep",
      sourceHandle: "loop-return-source",
      targetHandle: "loop-exit-target",
    });
    expect(loopReturn).toMatchObject({
      type: "smoothstep",
      sourceHandle: "loop-return-source",
      targetHandle: "loop-return-target",
    });
  });

  it("keeps internal branches and merges before continuing in the parent", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [trial("before"), loop("branching"), trial("after")],
      expandedScopes: [
        scope("branch-scope", ROOT_CANVAS_SCOPE_ID, "branching", [
          trial("question", ["left", "right"]),
          trial("left", ["merge"]),
          trial("right", ["merge"]),
          trial("merge"),
          trial("terminal"),
        ]),
      ],
    });
    const id = (itemId: string) =>
      getScopedNodeId("branch-scope", "trial", itemId);
    const after = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "after");

    expect(pairs(result, "flow")).toEqual(
      expect.arrayContaining([
        [id("question"), id("left")],
        [id("question"), id("right")],
        [id("left"), id("merge")],
        [id("right"), id("merge")],
        [id("merge"), id("terminal")],
        [id("terminal"), after],
      ]),
    );
    expect(pairs(result, "loop-return")).toEqual([
      [id("terminal"), id("question")],
    ]);
    expect(
      result.edges
        .filter((edge) => edge.data.kind === "flow")
        .every((edge) => edge.type === "default"),
    ).toBe(true);
  });

  it("recursively composes a nested expanded loop in the same graph", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [trial("root-before"), loop("parent"), trial("root-after")],
      expandedScopes: [
        scope("parent-scope", ROOT_CANVAS_SCOPE_ID, "parent", [
          trial("parent-first"),
          loop("nested"),
          trial("parent-last"),
        ]),
        scope("nested-scope", "parent-scope", "nested", [
          trial("nested-first"),
          trial("nested-last"),
        ]),
      ],
    });
    const rootBefore = getScopedNodeId(
      ROOT_CANVAS_SCOPE_ID,
      "trial",
      "root-before",
    );
    const rootAfter = getScopedNodeId(
      ROOT_CANVAS_SCOPE_ID,
      "trial",
      "root-after",
    );
    const parentFirst = getScopedNodeId(
      "parent-scope",
      "trial",
      "parent-first",
    );
    const parentLast = getScopedNodeId(
      "parent-scope",
      "trial",
      "parent-last",
    );
    const nestedFirst = getScopedNodeId(
      "nested-scope",
      "trial",
      "nested-first",
    );
    const nestedLast = getScopedNodeId(
      "nested-scope",
      "trial",
      "nested-last",
    );
    const parentMarker = getScopedNodeId(
      ROOT_CANVAS_SCOPE_ID,
      "loop",
      "parent",
    );
    const nestedMarker = getScopedNodeId(
      "parent-scope",
      "loop",
      "nested",
    );

    expect(pairs(result, "flow")).toEqual(
      expect.arrayContaining([
        [rootBefore, parentFirst],
        [parentFirst, nestedFirst],
        [nestedFirst, nestedLast],
        [nestedLast, parentLast],
        [parentLast, rootAfter],
      ]),
    );
    expect(pairs(result, "loop-return")).toEqual(
      expect.arrayContaining([
        [nestedLast, nestedFirst],
        [parentLast, parentFirst],
      ]),
    );
    expect(new Set(result.nodes.map((node) => node.id)).size).toBe(
      result.nodes.length,
    );
    expect(new Set(result.edges.map((edge) => edge.id)).size).toBe(
      result.edges.length,
    );
    const positions = new Map(
      result.nodes.map((node) => [node.id, node.position]),
    );
    expect(positions.get(parentMarker)!.x).toBeLessThan(
      positions.get(nestedMarker)!.x,
    );
    expect(positions.get(nestedMarker)!.x).toBeLessThan(
      positions.get(nestedFirst)!.x,
    );
  });
});
