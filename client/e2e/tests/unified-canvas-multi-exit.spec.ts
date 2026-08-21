import { expect, test } from "../fixtures/test.fixture";
import { expectPathAvoidsNodes } from "../helpers/layoutAssertions";
import { getLoopLayoutScopeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import { getScopedNodeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import { ROOT_CANVAS_SCOPE_ID } from "../../src/pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

const rootTimeline = [
  { id: "before", type: "trial", name: "Before" },
  {
    id: "loop-1",
    type: "loop",
    name: "Loop 1",
    trials: ["split"],
  },
  { id: "after", type: "trial", name: "After" },
];

const loopTimeline = [
  {
    id: "split",
    type: "trial",
    name: "New Trial 3",
    branches: ["left", "nested-loop"],
  },
  { id: "left", type: "trial", name: "New Trial 4" },
  {
    id: "nested-loop",
    type: "loop",
    name: "Nested Loop 1",
    trials: ["nested-item"],
  },
];

const graphSnapshot = {
  revision: "multi-exit-layout-regression",
  root: { scopeId: null, parentScopeId: null, items: rootTimeline },
  scopes: {
    "loop-1": {
      scopeId: "loop-1",
      parentScopeId: null,
      items: loopTimeline,
    },
  },
  edges: [
    {
      sourceId: "split",
      targetId: "left",
      sourceOwnerId: "loop-1",
      targetOwnerId: "loop-1",
      exitedLoopIds: [],
    },
    {
      sourceId: "split",
      targetId: "nested-loop",
      sourceOwnerId: "loop-1",
      targetOwnerId: "loop-1",
      exitedLoopIds: [],
    },
  ],
  diagnostics: [],
};

const edgeId = (kind: string, source: string, target: string) =>
  ["edge", kind, source, target].map(encodeURIComponent).join("::");

test("routes the parent circuit through a terminal trial and nested loop branch", async ({
  page,
}) => {
  await page.route("**/api/experiment-graph/exp-multi-exit", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ graph: graphSnapshot }),
    }),
  );
  await page.route("**/api/trials-metadata/exp-multi-exit", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ timeline: rootTimeline }),
    }),
  );
  await page.route(
    "**/api/loop-trials-metadata/exp-multi-exit/loop-1",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ trialsMetadata: loopTimeline }),
      }),
  );

  await page.setViewportSize({ width: 1900, height: 1100 });
  await page.goto("/#/home/experiment/exp-multi-exit/builder");
  const canvas = page.locator(".canvas-container");
  await canvas
    .locator(".loop-node", { hasText: "Loop 1" })
    .getByTitle("Expand loop")
    .click();
  await expect(
    canvas.getByText("Nested Loop 1", { exact: true }),
  ).toBeVisible();

  const scope = getLoopLayoutScopeId("loop-1");
  const markerId = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "loop-1");
  const splitId = getScopedNodeId(scope, "trial", "split");
  const leftId = getScopedNodeId(scope, "trial", "left");
  const rightId = getScopedNodeId(scope, "loop", "nested-loop");
  const node = (id: string) =>
    canvas.locator(`.react-flow__node[data-id="${id}"]`);
  const path = (kind: string, source: string, target: string) =>
    canvas.locator(
      `[data-testid="rf__edge-${edgeId(kind, source, target)}"] .react-flow__edge-path`,
    );

  const circuit = path("loop-return", markerId, markerId);
  await expect(circuit).toHaveCount(1);
  await expect(path("loop-control", markerId, leftId)).toHaveCount(0);
  await expect(path("loop-return", leftId, splitId)).toHaveCount(0);
  await expect(path("loop-control", markerId, rightId)).toHaveCount(0);
  await expectPathAvoidsNodes(circuit, [node(leftId), node(rightId)]);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);
  await canvas.screenshot({
    path: "test-results/unified-canvas-nested-loop-branch.png",
  });
});
