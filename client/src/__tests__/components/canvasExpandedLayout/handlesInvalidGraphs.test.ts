import { describe, expect, it } from "vitest";
import {
  composeExpandedLoopLayout,
  getScopedNodeId,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import { ROOT_CANVAS_SCOPE_ID } from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";
import type { LayoutTimelineItem } from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

const trial = (
  id: string,
  branches?: string[],
): LayoutTimelineItem => ({ id, type: "trial", name: id, branches });

const loop = (id: string): LayoutTimelineItem => ({
  id,
  type: "loop",
  name: id,
  trials: [],
});

describe("composeExpandedLoopLayout resilience", () => {
  it("drops missing branch targets and breaks branch cycles deterministically", () => {
    const input = {
      rootTimeline: [trial("start"), loop("safe"), trial("end")],
      expandedScopes: [
        {
          id: "safe-scope",
          parentScopeId: ROOT_CANVAS_SCOPE_ID,
          loopId: "safe",
          timeline: [
            trial("a", ["missing", "b"]),
            trial("b", ["a"]),
            trial("c"),
          ],
        },
      ],
    };

    const result = composeExpandedLoopLayout(input);
    const repeated = composeExpandedLoopLayout(input);
    const a = getScopedNodeId("safe-scope", "trial", "a");
    const b = getScopedNodeId("safe-scope", "trial", "b");
    const c = getScopedNodeId("safe-scope", "trial", "c");

    expect(result).toEqual(repeated);
    expect(result.nodes.some((node) => node.id.includes("missing"))).toBe(false);
    expect(
      result.edges.some((edge) =>
        edge.source.includes(encodeURIComponent("missing")),
      ),
    ).toBe(false);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: a, target: b }),
        expect.objectContaining({ source: b, target: c }),
      ]),
    );
    expect(result.edges).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ source: b, target: a })]),
    );
  });

  it("ignores unreachable and cyclic scope references without recursing", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [trial("start"), loop("visible"), trial("end")],
      expandedScopes: [
        {
          id: "visible-scope",
          parentScopeId: ROOT_CANVAS_SCOPE_ID,
          loopId: "visible",
          timeline: [loop("visible")],
        },
        {
          id: "visible-scope",
          parentScopeId: "visible-scope",
          loopId: "visible",
          timeline: [trial("should-not-render")],
        },
        {
          id: "orphan-a",
          parentScopeId: "orphan-b",
          loopId: "orphan-loop-a",
          timeline: [trial("orphan-a-item")],
        },
        {
          id: "orphan-b",
          parentScopeId: "orphan-a",
          loopId: "orphan-loop-b",
          timeline: [trial("orphan-b-item")],
        },
      ],
    });

    expect(result.nodes.some((node) => node.data.itemId === "start")).toBe(true);
    expect(
      result.nodes.some((node) => node.data.itemId === "should-not-render"),
    ).toBe(false);
    expect(result.nodes.some((node) => node.data.itemId === "orphan-a-item")).toBe(
      false,
    );
  });

  it("keeps a loop collapsed when its expanded scope is empty", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [trial("before"), loop("empty"), trial("after")],
      expandedScopes: [
        {
          id: "empty-scope",
          parentScopeId: ROOT_CANVAS_SCOPE_ID,
          loopId: "empty",
          timeline: [],
        },
      ],
    });
    const marker = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "empty");
    const node = result.nodes.find((candidate) => candidate.id === marker);

    expect(node?.data).toMatchObject({ role: "item", expanded: false });
    expect(result.edges.every((edge) => edge.data.kind === "flow")).toBe(true);
  });

  it("keeps identical item ids unique across scopes", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [trial("same"), loop("outer")],
      expandedScopes: [
        {
          id: "outer-scope",
          parentScopeId: ROOT_CANVAS_SCOPE_ID,
          loopId: "outer",
          timeline: [trial("same")],
        },
      ],
    });

    expect(result.nodes.filter((node) => node.data.itemId === "same")).toHaveLength(
      2,
    );
    expect(new Set(result.nodes.map((node) => node.id)).size).toBe(
      result.nodes.length,
    );
  });
});
