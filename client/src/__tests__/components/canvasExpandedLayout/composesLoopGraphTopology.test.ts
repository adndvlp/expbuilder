import { describe, expect, it } from "vitest";
import {
  composeExpandedLoopLayout,
  getScopedNodeId,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import {
  ROOT_CANVAS_SCOPE_ID,
  type ExpandedCanvasEdgeKind,
  type ExpandedLoopScope,
  type LayoutTimelineItem,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

const trial = (
  id: string,
  branches?: string[],
): LayoutTimelineItem => ({ id, type: "trial", name: id, branches });

const loop = (id: string, branches?: string[]): LayoutTimelineItem => ({
  id,
  type: "loop",
  name: id,
  branches,
  trials: [],
});

const scope = (
  id: string,
  parentScopeId: string,
  loopId: string,
  timeline: LayoutTimelineItem[],
): ExpandedLoopScope => ({ id, parentScopeId, loopId, timeline });

const edgePairs = (
  result: ReturnType<typeof composeExpandedLoopLayout>,
  kind: ExpandedCanvasEdgeKind,
) =>
  new Set(
    result.edges
      .filter((edge) => edge.data.kind === kind)
      .map((edge) => `${edge.source}->${edge.target}`),
  );

describe("expanded loop graph topology", () => {
  it("balances two branch roots when one subtree is wider", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [
        trial("parent", ["continuation", "side"]),
        trial("continuation", ["left-child", "right-child"]),
        trial("left-child"),
        trial("right-child"),
        trial("side"),
      ],
      expandedScopes: [],
    });
    const rootId = (id: string) =>
      getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", id);
    const positions = new Map(
      result.nodes.map((node) => [node.id, node.position]),
    );
    const parent = positions.get(rootId("parent"))!;
    const continuation = positions.get(rootId("continuation"))!;
    const side = positions.get(rootId("side"))!;

    expect(continuation.x).toBeLessThan(parent.x);
    expect(side.x).toBeGreaterThan(parent.x);
    expect(continuation.x + side.x).toBe(parent.x * 2);
  });

  it("renders one shared loop circuit when a scope has multiple exits", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [loop("outer")],
      expandedScopes: [
        scope("outer-scope", ROOT_CANVAS_SCOPE_ID, "outer", [
          trial("question", ["left-exit", "right-exit"]),
          trial("left-exit"),
          trial("right-exit"),
        ]),
      ],
    });
    const marker = getScopedNodeId(
      ROOT_CANVAS_SCOPE_ID,
      "loop",
      "outer",
    );
    const inner = (id: string) =>
      getScopedNodeId("outer-scope", "trial", id);

    expect(edgePairs(result, "loop-control")).toEqual(
      new Set([
        `${inner("question")}->${marker}`,
        `${marker}->${inner("right-exit")}`,
      ]),
    );
    expect(edgePairs(result, "loop-return")).toEqual(
      new Set([`${inner("right-exit")}->${inner("question")}`]),
    );
  });

  it("preserves nested loops, branches, and a shared merge in one graph", () => {
    const result = composeExpandedLoopLayout({
      rootTimeline: [
        trial("welcome"),
        trial("instructions", ["left-final", "outer", "right-final"]),
        trial("left-final"),
        loop("outer"),
        trial("right-final"),
      ],
      expandedScopes: [
        scope("outer-scope", ROOT_CANVAS_SCOPE_ID, "outer", [
          trial("question", ["nested", "task-2"]),
          loop("nested", ["final"]),
          trial("task-2", ["right-task"]),
          trial("right-task", ["end"]),
          trial("end", ["end-left", "end-middle", "end-right"]),
          trial("end-left", ["final"]),
          trial("end-middle", ["final"]),
          trial("end-right", ["final"]),
          trial("final"),
        ]),
        scope("nested-scope", "outer-scope", "nested", [
          trial("nested-task"),
          trial("loca"),
        ]),
      ],
    });
    const rootId = (id: string) =>
      getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", id);
    const rootLoopId = (id: string) =>
      getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", id);
    const outerId = (id: string) =>
      getScopedNodeId("outer-scope", "trial", id);
    const outerLoopId = (id: string) =>
      getScopedNodeId("outer-scope", "loop", id);
    const nestedId = (id: string) =>
      getScopedNodeId("nested-scope", "trial", id);
    const flow = edgePairs(result, "flow");
    const loopControl = edgePairs(result, "loop-control");
    const loopReturn = edgePairs(result, "loop-return");

    expect(flow).toEqual(
      new Set([
        `${rootId("welcome")}->${rootId("instructions")}`,
        `${rootId("instructions")}->${rootId("left-final")}`,
        `${rootId("instructions")}->${outerId("question")}`,
        `${rootId("instructions")}->${rootId("right-final")}`,
        `${outerId("question")}->${nestedId("nested-task")}`,
        `${nestedId("nested-task")}->${nestedId("loca")}`,
        `${nestedId("loca")}->${outerId("final")}`,
        `${outerId("question")}->${outerId("task-2")}`,
        `${outerId("task-2")}->${outerId("right-task")}`,
        `${outerId("right-task")}->${outerId("end")}`,
        `${outerId("end")}->${outerId("end-left")}`,
        `${outerId("end")}->${outerId("end-middle")}`,
        `${outerId("end")}->${outerId("end-right")}`,
        `${outerId("end-left")}->${outerId("final")}`,
        `${outerId("end-middle")}->${outerId("final")}`,
        `${outerId("end-right")}->${outerId("final")}`,
      ]),
    );
    expect(loopControl).toEqual(
      new Set([
        `${outerId("question")}->${rootLoopId("outer")}`,
        `${rootLoopId("outer")}->${outerId("final")}`,
        `${nestedId("nested-task")}->${outerLoopId("nested")}`,
        `${outerLoopId("nested")}->${nestedId("loca")}`,
      ]),
    );
    expect(loopReturn).toEqual(
      new Set([
        `${outerId("final")}->${outerId("question")}`,
        `${nestedId("loca")}->${nestedId("nested-task")}`,
      ]),
    );

    const positions = new Map(
      result.nodes.map((node) => [node.id, node.position]),
    );
    const final = positions.get(outerId("final"))!;
    const mergeParents = ["loca", "end-left", "end-middle", "end-right"].map(
      (id) =>
        positions.get(
          id === "loca" ? nestedId(id) : outerId(id),
        )!,
    );
    expect(final.y).toBeGreaterThan(
      Math.max(...mergeParents.map((position) => position.y)),
    );
    expect(final.x).toBe(
      mergeParents.reduce((sum, position) => sum + position.x, 0) /
        mergeParents.length,
    );
    expect(positions.get(rootLoopId("outer"))!.x).toBeLessThan(
      positions.get(outerLoopId("nested"))!.x,
    );
    expect(positions.get(outerLoopId("nested"))!.x).toBeLessThan(
      positions.get(nestedId("nested-task"))!.x,
    );
    const outerSubtree = result.nodes.filter(
      (node) =>
        node.data.scopeId === "outer-scope" ||
        node.id === rootLoopId("outer"),
    );
    const subtreeLeft = Math.min(
      ...outerSubtree.map((node) => node.position.x),
    );
    const subtreeRight = Math.max(
      ...outerSubtree.map((node) => node.position.x + 180),
    );
    expect(positions.get(outerId("question"))!.x).toBe(
      positions.get(rootId("instructions"))!.x,
    );
    expect(positions.get(rootId("left-final"))!.x + 180).toBeLessThan(
      subtreeLeft,
    );
    expect(positions.get(rootId("right-final"))!.x).toBeGreaterThan(
      subtreeRight,
    );
  });
});
