import { expect, test } from "../fixtures/test.fixture";
import {
  expectBalancedFan,
  expectBelowAndCentered,
  expectPathAvoidsNodes,
} from "../helpers/layoutAssertions";
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

test("renders exact exit sources through expanded and collapsed loop levels", async ({
  page,
}) => {
  const experimentId = "exp-loop-branch-visual";
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
      name: "Outer Loop",
      trials: ["inner", "outer-target"],
      branches: [],
    },
    {
      id: "root-target",
      type: "trial",
      name: "Main Timeline Branch",
      branches: [],
    },
  ];
  const outer: TimelineItem[] = [
    {
      id: "inner",
      type: "loop",
      name: "Nested Loop",
      parentLoopId: "outer",
      trials: ["source", "later"],
      branches: [],
    },
    {
      id: "outer-target",
      type: "trial",
      name: "Outer Loop Branch",
      parentLoopId: "outer",
      branches: [],
    },
  ];
  const inner: TimelineItem[] = [
    {
      id: "source",
      type: "trial",
      name: "Nested Earlier Trial",
      parentLoopId: "inner",
      branches: ["outer-target", "root-target"],
    },
    {
      id: "later",
      type: "trial",
      name: "Later Nested Trial",
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
      branchEdge("source", "outer-target", "inner", "outer", ["inner"]),
      branchEdge("source", "root-target", "inner", null, ["inner", "outer"]),
    ],
  );
  await page.route(`**/api/experiment-graph/${experimentId}`, (route) =>
    route.fulfill(fulfillGraph(snapshot)),
  );
  await page.route(
    `**/api/loop-branch-levels/${experimentId}/source`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          levels: [
            { scopeId: "inner", name: "Nested Loop", branchCount: 0 },
            { scopeId: "outer", name: "Outer Loop", branchCount: 1 },
            { scopeId: null, name: "Main timeline", branchCount: 1 },
          ],
        }),
      }),
  );
  await page.route(`**/api/trial/${experimentId}/source`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ trial: inner[0] }),
    }),
  );

  await page.setViewportSize({ width: 1800, height: 1100 });
  await page.goto(`/#/home/experiment/${experimentId}/builder`);
  const canvas = page.locator(".canvas-container");
  await canvas
    .locator(".loop-node", { hasText: "Outer Loop" })
    .getByTitle("Expand loop")
    .click();
  await canvas
    .locator(".loop-node", { hasText: "Nested Loop" })
    .getByTitle("Expand loop")
    .click();

  const outerScope = getLoopLayoutScopeId("outer");
  const innerScope = getLoopLayoutScopeId("inner");
  const source = getScopedNodeId(innerScope, "trial", "source");
  const later = getScopedNodeId(innerScope, "trial", "later");
  const left = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "left");
  const innerMarker = getScopedNodeId(outerScope, "loop", "inner");
  const outerMarker = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "outer");
  const outerTarget = getScopedNodeId(outerScope, "trial", "outer-target");
  const rootTarget = getScopedNodeId(
    ROOT_CANVAS_SCOPE_ID,
    "trial",
    "root-target",
  );
  const sibling = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "right");
  const edge = (from: string, to: string) =>
    canvas.locator(`[data-testid="rf__edge-${edgeId(from, to)}"]`);
  const node = (id: string) =>
    canvas.locator(`.react-flow__node[data-id="${id}"]`);
  const path = (from: string, to: string) =>
    edge(from, to).locator(".react-flow__edge-path");

  await expect(edge(source, outerTarget)).toHaveCount(1);
  await expect(edge(source, rootTarget)).toHaveCount(1);
  await expect(edge(source, later)).toHaveCount(1);
  await expect(edge(left, source)).toHaveCount(1);
  await expect(edge(left, innerMarker)).toHaveCount(0);
  await expect(edge(left, outerMarker)).toHaveCount(0);
  await expect(edge(sibling, rootTarget)).toHaveCount(0);
  await expectBalancedFan(
    canvas,
    source,
    [later, outerTarget, rootTarget],
    [outerTarget, rootTarget],
  );
  await expectPathAvoidsNodes(path(source, outerTarget), [
    node(later),
    node(rootTarget),
  ]);
  await expectPathAvoidsNodes(path(source, rootTarget), [
    node(later),
    node(outerTarget),
  ]);
  await expectPathAvoidsNodes(path(source, later), [
    node(outerTarget),
    node(rootTarget),
  ]);
  await canvas.screenshot({ path: "test-results/loop-branching-expanded.png" });

  const sourceNode = canvas.locator(`.react-flow__node[data-id="${source}"]`);
  await sourceNode.click();
  await sourceNode.getByTitle("Add branch").click();
  await expect(
    page.getByText("Select branch level", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(3);
  await page.getByRole("checkbox", { name: "Outer Loop" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Add New Trial", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "As Parent (Sequential)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await canvas
    .locator(`.react-flow__node[data-id="${innerMarker}"]`)
    .getByTitle("Collapse loop")
    .click();
  await expect(edge(left, innerMarker)).toHaveCount(1);
  await expect(edge(left, outerMarker)).toHaveCount(0);
  await expect(edge(innerMarker, outerTarget)).toHaveCount(1);
  await expect(edge(innerMarker, rootTarget)).toHaveCount(1);
  await expectBalancedFan(
    canvas,
    innerMarker,
    [outerTarget, rootTarget],
    [outerTarget, rootTarget],
  );
  await canvas.screenshot({
    path: "test-results/loop-branching-nested-collapsed.png",
  });

  await canvas
    .locator(`.react-flow__node[data-id="${outerMarker}"]`)
    .getByTitle("Collapse loop")
    .click();
  await expect(edge(left, outerMarker)).toHaveCount(1);
  await expect(edge(outerMarker, rootTarget)).toHaveCount(1);
  await expect(edge(sibling, rootTarget)).toHaveCount(0);
  await expectBelowAndCentered(canvas, outerMarker, rootTarget);
  await canvas.screenshot({
    path: "test-results/loop-branching-all-collapsed.png",
  });
});
