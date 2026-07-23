import { expect, test } from "../fixtures/test.fixture";
import type { Locator } from "@playwright/test";
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
    branches: ["left", "right"],
  },
  { id: "left", type: "trial", name: "New Trial 4" },
  { id: "right", type: "trial", name: "New Trial 5" },
];

async function pathCrossesNode(path: Locator, node: Locator) {
  const bounds = await node.boundingBox();
  if (!bounds) return false;
  return path.evaluate((element, box) => {
    const svgPath = element as SVGPathElement;
    const matrix = svgPath.getScreenCTM();
    if (!matrix) return false;
    const length = svgPath.getTotalLength();
    for (let sample = 1; sample < 100; sample += 1) {
      const point = svgPath.getPointAtLength((length * sample) / 100);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      if (
        screen.x > box.x &&
        screen.x < box.x + box.width &&
        screen.y > box.y &&
        screen.y < box.y + box.height
      ) {
        return true;
      }
    }
    return false;
  }, bounds);
}

const edgeId = (kind: string, source: string, target: string) =>
  ["edge", kind, source, target].map(encodeURIComponent).join("::");

test("renders one shared loop circuit across sibling terminal trials", async ({
  page,
}) => {
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
  await expect(canvas.getByText("New Trial 5", { exact: true })).toBeVisible();

  const scope = getLoopLayoutScopeId("loop-1");
  const markerId = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "loop-1");
  const splitId = getScopedNodeId(scope, "trial", "split");
  const leftId = getScopedNodeId(scope, "trial", "left");
  const rightId = getScopedNodeId(scope, "trial", "right");
  const node = (id: string) =>
    canvas.locator(`.react-flow__node[data-id="${id}"]`);
  const path = (kind: string, source: string, target: string) =>
    canvas.locator(
      `[data-testid="rf__edge-${edgeId(kind, source, target)}"] .react-flow__edge-path`,
    );

  const sharedExit = path("loop-control", markerId, rightId);
  const sharedReturn = path("loop-return", rightId, splitId);
  await expect(sharedExit).toHaveCount(1);
  await expect(sharedReturn).toHaveCount(1);
  await expect(path("loop-control", markerId, leftId)).toHaveCount(0);
  await expect(path("loop-return", leftId, splitId)).toHaveCount(0);
  expect(await pathCrossesNode(sharedExit, node(leftId))).toBe(true);
  const dashPatterns = await Promise.all(
    [sharedExit, sharedReturn].map((edge) =>
      edge.evaluate((element) => getComputedStyle(element).strokeDasharray),
    ),
  );
  expect(new Set(dashPatterns).size).toBe(1);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);
  await canvas.screenshot({
    path: "test-results/unified-canvas-multi-exit.png",
  });
});
