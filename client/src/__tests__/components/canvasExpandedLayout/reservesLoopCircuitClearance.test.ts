import { describe, expect, it } from "vitest";
import {
  composeExpandedLoopLayout,
  getScopedNodeId,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import {
  ROOT_CANVAS_SCOPE_ID,
  type ExpandedLoopScope,
  type LayoutTimelineItem,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";
import { getLoopScopeLanes } from "../../../pages/ExperimentBuilder/components/Canvas/services/loopScopeGeometry";

const trial = (
  id: string,
  branches?: string[],
): LayoutTimelineItem => ({
  id,
  type: "trial",
  name: id,
  branches,
});

const loop = (id: string): LayoutTimelineItem => ({
  id,
  type: "loop",
  name: id,
  trials: [],
});

describe("expanded loop circuit clearance", () => {
  it("reserves space between a parent circuit and the following node", () => {
    const scopes: ExpandedLoopScope[] = [
      {
        id: "outer-scope",
        parentScopeId: ROOT_CANVAS_SCOPE_ID,
        loopId: "outer",
        timeline: [
          trial("split", ["left", "nested", "right"]),
          trial("left"),
          loop("nested"),
          trial("right"),
        ],
      },
      {
        id: "nested-scope",
        parentScopeId: "outer-scope",
        loopId: "nested",
        timeline: [],
      },
    ];
    const layout = composeExpandedLoopLayout({
      rootTimeline: [loop("outer"), trial("after")],
      expandedScopes: scopes,
    });
    const routes = getLoopScopeLanes(layout.nodes, scopes);
    const outerRoute = routes.get("outer-scope")!;
    const after = layout.nodes.find(
      (node) =>
        node.id ===
        getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "after"),
    )!;

    expect(after.position.y - outerRoute.bottomY).toBeGreaterThanOrEqual(20);
  });
});
