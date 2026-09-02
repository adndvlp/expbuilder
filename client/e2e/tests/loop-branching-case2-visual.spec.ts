import { expect, test } from "../fixtures/test.fixture";
import {
  branchEdge,
  edgeId,
  fulfillGraph,
  graph,
} from "../helpers/loopBranchGraph";
import type { TimelineItem } from "../../src/pages/ExperimentBuilder/modules/experiment-graph/types";
import { getLoopLayoutScopeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import { ROOT_CANVAS_SCOPE_ID } from "../../src/pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";
import { getScopedNodeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/scopedNodeId";

test("[TL-04] [TL-05] [TL-06] [TL-07] [TL-08] [TL-09] preserves Case 2 routes, identity, and color through collapse cycles", async ({
  page,
}) => {
  const experimentId = "exp-loop-branch-case-2";
  const root: TimelineItem[] = [
    {
      id: "split",
      type: "trial",
      name: "New Trial",
      branches: ["left", "right"],
    },
    { id: "left", type: "trial", name: "New Trial 1", branches: ["outer"] },
    { id: "right", type: "trial", name: "New Trial 2", branches: [] },
    {
      id: "outer",
      type: "loop",
      name: "Loop 1",
      trials: ["inner", "outer-target"],
      branches: [],
    },
    { id: "root-a", type: "trial", name: "Root Branch A", branches: [] },
    { id: "root-b", type: "trial", name: "Root Branch B", branches: [] },
  ];
  const outer: TimelineItem[] = [
    {
      id: "inner",
      type: "loop",
      name: "Nested Loop 1",
      parentLoopId: "outer",
      trials: ["source", "local"],
      branches: [],
    },
    {
      id: "outer-target",
      type: "trial",
      name: "Outer Branch",
      parentLoopId: "outer",
      branches: [],
    },
  ];
  const inner: TimelineItem[] = [
    {
      id: "source",
      type: "trial",
      name: "Nested Source",
      parentLoopId: "inner",
      branches: ["local", "outer-target", "root-a", "root-b"],
    },
    {
      id: "local",
      type: "trial",
      name: "Nested Branch",
      parentLoopId: "inner",
      branches: [],
    },
  ];
  const snapshot = graph(
    root,
    {
      outer: { scopeId: "outer", parentScopeId: null, items: outer },
      inner: { scopeId: "inner", parentScopeId: "outer", items: inner },
    },
    [
      branchEdge("split", "left", null, null),
      branchEdge("split", "right", null, null),
      branchEdge("left", "outer", null, null),
      branchEdge("source", "local", "inner", "inner"),
      branchEdge("source", "outer-target", "inner", "outer", ["inner"]),
      branchEdge("source", "root-a", "inner", null, ["inner", "outer"]),
      branchEdge("source", "root-b", "inner", null, ["inner", "outer"]),
    ],
  );
  await page.route(`**/api/experiment-graph/${experimentId}`, (route) =>
    route.fulfill(fulfillGraph(snapshot)),
  );
  await page.setViewportSize({ width: 1900, height: 1200 });
  await page.goto(`/#/home/experiment/${experimentId}/builder`);

  const canvas = page.locator(".canvas-container");
  const outerScope = getLoopLayoutScopeId("outer");
  const innerScope = getLoopLayoutScopeId("inner");
  const source = getScopedNodeId(innerScope, "trial", "source");
  const innerMarker = getScopedNodeId(outerScope, "loop", "inner");
  const outerMarker = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "outer");
  const outerTarget = getScopedNodeId(
    outerScope,
    "trial",
    "outer-target",
  );
  const rootA = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "root-a");
  const rootB = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "root-b");
  const edge = (from: string, to: string) =>
    canvas.locator(`[data-testid="rf__edge-${edgeId(from, to)}"]`);
  const edgeStroke = (from: string, to: string) =>
    edge(from, to)
      .locator(".react-flow__edge-path")
      .evaluate((element) => getComputedStyle(element).stroke);
  const exitEdgeIds = (from: string) =>
    Promise.all(
      [outerTarget, rootA, rootB].map(async (target) => {
        const candidate = edge(from, target);
        return (await candidate.count()) === 1
          ? candidate.getAttribute("data-testid")
          : null;
      }),
    );
  const visibleExitCount = async (from: string) =>
    (await exitEdgeIds(from)).filter(Boolean).length;
  const visibleFlowIds = () =>
    canvas
      .locator('[data-testid^="rf__edge-edge::flow::"]')
      .evaluateAll((elements) =>
        elements
          .map((element) => element.getAttribute("data-testid"))
          .filter((id): id is string => id !== null)
          .sort(),
      );
  const expandOuter = () =>
    canvas
      .locator(".loop-node", { hasText: "Loop 1" })
      .getByTitle("Expand loop")
      .click();
  const expandInner = () =>
    canvas
      .locator(".loop-node", { hasText: "Nested Loop 1" })
      .getByTitle("Expand loop")
      .click();
  const collapse = (id: string) =>
    canvas
      .locator(`.react-flow__node[data-id="${id}"]`)
      .getByTitle("Collapse loop")
      .click();

  await expandOuter();
  await expandInner();

  await expect(edge(source, outerTarget)).toHaveCount(1);
  await expect(edge(source, rootA)).toHaveCount(1);
  await expect(edge(source, rootB)).toHaveCount(1);
  await expect.poll(() => visibleExitCount(source)).toBe(3);
  const expandedIds = await visibleFlowIds();
  const stableColors = {
    rootA: await edgeStroke(source, rootA),
    rootB: await edgeStroke(source, rootB),
  };
  expect(stableColors.rootA).not.toBe(stableColors.rootB);
  await canvas.screenshot({
    path: "test-results/loop-branching-case2-expanded.png",
  });

  await collapse(innerMarker);
  await expect(edge(innerMarker, outerTarget)).toHaveCount(1);
  await expect(edge(innerMarker, rootA)).toHaveCount(1);
  await expect(edge(innerMarker, rootB)).toHaveCount(1);
  await expect.poll(() => visibleExitCount(innerMarker)).toBe(3);
  expect(await edgeStroke(innerMarker, rootA)).toBe(stableColors.rootA);
  expect(await edgeStroke(innerMarker, rootB)).toBe(stableColors.rootB);
  await canvas.screenshot({
    path: "test-results/loop-branching-case2-nested-collapsed.png",
  });

  await collapse(outerMarker);
  await expect(edge(outerMarker, rootA)).toHaveCount(1);
  await expect(edge(outerMarker, rootB)).toHaveCount(1);
  await expect.poll(() => visibleExitCount(outerMarker)).toBe(2);
  expect(await edgeStroke(outerMarker, rootA)).toBe(stableColors.rootA);
  expect(await edgeStroke(outerMarker, rootB)).toBe(stableColors.rootB);
  await canvas.screenshot({
    path: "test-results/loop-branching-case2-outer-collapsed.png",
  });

  for (let cycle = 0; cycle < 10; cycle += 1) {
    await expandOuter();
    await expect.poll(() => visibleExitCount(innerMarker)).toBe(3);
    await expandInner();
    await expect.poll(() => visibleExitCount(source)).toBe(3);
    expect(await visibleFlowIds()).toEqual(expandedIds);
    expect(await edgeStroke(source, rootA)).toBe(stableColors.rootA);
    expect(await edgeStroke(source, rootB)).toBe(stableColors.rootB);
    await collapse(innerMarker);
    await expect.poll(() => visibleExitCount(innerMarker)).toBe(3);
    await collapse(outerMarker);
    await expect.poll(() => visibleExitCount(outerMarker)).toBe(2);
  }
});
