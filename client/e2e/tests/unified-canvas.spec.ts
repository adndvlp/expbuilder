import { expect, test } from "../fixtures/test.fixture";
import { getLoopLayoutScopeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import { getScopedNodeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import { ROOT_CANVAS_SCOPE_ID } from "../../src/pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

const rootTimeline = [
  { id: "welcome", type: "trial", name: "Welcome" },
  { id: "instructions", type: "trial", name: "Instructions" },
  { id: "parent", type: "loop", name: "Parent loop" },
  { id: "final", type: "trial", name: "Final" },
];

const parentTimeline = [
  { id: "parent-first", type: "trial", name: "Parent first" },
  { id: "nested", type: "loop", name: "Nested loop" },
  { id: "parent-last", type: "trial", name: "Parent last" },
];

const nestedTimeline = [
  { id: "nested-first", type: "trial", name: "Nested first" },
  { id: "nested-last", type: "trial", name: "Nested last" },
];

test("expands parent and nested loops inside one ReactFlow", async ({ page }) => {
  await page.route("**/api/trials-metadata/exp-canvas", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ timeline: rootTimeline }),
    }),
  );
  await page.route(
    "**/api/loop-trials-metadata/exp-canvas/*",
    (route) => {
      const nested = route.request().url().endsWith("/nested");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          trialsMetadata: nested ? nestedTimeline : parentTimeline,
        }),
      });
    },
  );

  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/#/home/experiment/exp-canvas/builder");
  const canvas = page.locator(".canvas-container");
  await expect(canvas.locator(".react-flow")).toHaveCount(1);

  await canvas
    .locator(".loop-node", { hasText: "Parent loop" })
    .getByTitle("Expand loop")
    .click();
  await expect(canvas.getByText("Parent first", { exact: true })).toBeVisible();

  await canvas
    .locator(".loop-node", { hasText: "Nested loop" })
    .getByTitle("Expand loop")
    .click();
  await expect(canvas.getByText("Nested first", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Parent last", { exact: true })).toBeVisible();
  await expect(canvas.locator(".react-flow")).toHaveCount(1);
  const [expandedLoopBox, trialBox] = await Promise.all([
    canvas.locator(".loop-node", { hasText: "Parent loop" }).boundingBox(),
    canvas.locator(".trial-node", { hasText: "Parent first" }).boundingBox(),
  ]);
  expect(expandedLoopBox).not.toBeNull();
  expect(trialBox).not.toBeNull();
  expect(expandedLoopBox!.width).toBeLessThan(trialBox!.width);
  await page.waitForTimeout(400);
  await expect(canvas.getByText("Welcome", { exact: true })).toBeInViewport({
    ratio: 0.9,
  });
  await expect(canvas.getByText("Final", { exact: true })).toBeInViewport({
    ratio: 0.9,
  });
  await page.mouse.move(10, 10);
  await canvas.screenshot({
    path: "test-results/unified-canvas-expanded.png",
  });

  await canvas
    .locator(".loop-node", { hasText: "Parent loop" })
    .getByTitle("Collapse loop")
    .click();
  await expect(canvas.getByText("Nested first", { exact: true })).toHaveCount(0);
  await expect(canvas.getByText("Parent first", { exact: true })).toHaveCount(0);
});

test("routes a one-item loop as one exterior circuit", async ({
  page,
}) => {
  const branchingTimeline = [
    { id: "welcome", type: "trial", name: "Welcome", branches: ["consent"] },
    {
      id: "consent",
      type: "trial",
      name: "Consent",
      branches: ["instructions", "final-1"],
    },
    {
      id: "instructions",
      type: "trial",
      name: "Instructions",
      branches: ["loop-1"],
    },
    { id: "final-1", type: "trial", name: "Final1", branches: [] },
    {
      id: "loop-1",
      type: "loop",
      name: "Loop 1",
      branches: ["final-2"],
      trials: ["task"],
    },
    { id: "final-2", type: "trial", name: "Final2", branches: [] },
  ];

  await page.route("**/api/trials-metadata/exp-branching", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ timeline: branchingTimeline }),
    }),
  );
  await page.route(
    "**/api/loop-trials-metadata/exp-branching/loop-1",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          trialsMetadata: [{ id: "task", type: "trial", name: "Task" }],
        }),
      }),
  );

  await page.setViewportSize({ width: 2000, height: 1200 });
  await page.goto("/#/home/experiment/exp-branching/builder");
  const canvas = page.locator(".canvas-container");
  await canvas
    .locator(".loop-node", { hasText: "Loop 1" })
    .getByTitle("Expand loop")
    .click();

  await expect(canvas.getByText("Task", { exact: true })).toBeVisible();
  await expect(canvas.locator(".react-flow")).toHaveCount(1);
  await expect(canvas.locator(".canvas-breadcrumb")).toHaveCount(0);
  const markerId = getScopedNodeId(
    ROOT_CANVAS_SCOPE_ID,
    "loop",
    "loop-1",
  );
  const taskId = getScopedNodeId(
    getLoopLayoutScopeId("loop-1"),
    "trial",
    "task",
  );
  const edgeId = (kind: string, source: string, target: string) =>
    ["edge", kind, source, target].map(encodeURIComponent).join("::");
  const path = (kind: string, source: string, target: string) =>
    canvas.locator(
      `[data-testid="rf__edge-${edgeId(kind, source, target)}"] .react-flow__edge-path`,
    );
  const circuit = path("loop-return", markerId, markerId);

  await expect(path("loop-control", taskId, markerId)).toHaveCount(0);
  await expect(path("loop-control", markerId, taskId)).toHaveCount(0);
  await expect(path("loop-return", taskId, taskId)).toHaveCount(0);
  await expect(circuit).toHaveCount(1);

  const markerBox = await canvas
    .locator(`.react-flow__node[data-id="${markerId}"]`)
    .boundingBox();
  const taskBox = await canvas
    .locator(`.react-flow__node[data-id="${taskId}"]`)
    .boundingBox();
  const geometry = await circuit.evaluate((element) => {
    const svgPath = element as SVGPathElement;
    const matrix = svgPath.getScreenCTM()!;
    const length = svgPath.getTotalLength();
    const points = Array.from({ length: 101 }, (_, index) =>
      svgPath
        .getPointAtLength((length * index) / 100)
        .matrixTransform(matrix),
    );
    return {
      minY: Math.min(...points.map((point) => point.y)),
      maxX: Math.max(...points.map((point) => point.x)),
      maxY: Math.max(...points.map((point) => point.y)),
    };
  });
  expect(markerBox).not.toBeNull();
  expect(taskBox).not.toBeNull();
  expect(geometry.minY).toBeLessThan(
    Math.min(markerBox!.y, taskBox!.y) - 20,
  );
  expect(geometry.maxX).toBeGreaterThan(taskBox!.x + taskBox!.width + 20);
  expect(geometry.maxY).toBeGreaterThan(
    Math.max(
      markerBox!.y + markerBox!.height,
      taskBox!.y + taskBox!.height,
    ) + 20,
  );
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);
  await canvas.screenshot({
    path: "test-results/unified-canvas-single-loop.png",
  });
});

test("balances two branch roots when one subtree is wider", async ({
  page,
}) => {
  const timeline = [
    {
      id: "parent",
      type: "trial",
      name: "New Trial",
      branches: ["continuation", "side"],
    },
    {
      id: "continuation",
      type: "trial",
      name: "New Trial 1",
      branches: ["left-child", "right-child"],
    },
    { id: "left-child", type: "trial", name: "New Trial 4" },
    { id: "right-child", type: "trial", name: "New Trial 5" },
    { id: "side", type: "trial", name: "New Trial 2" },
  ];
  await page.route("**/api/trials-metadata/exp-balanced-branches", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ timeline }),
    }),
  );
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/#/home/experiment/exp-balanced-branches/builder");
  const canvas = page.locator(".canvas-container");
  const node = (id: string) =>
    canvas.locator(
      `.react-flow__node[data-id="${getScopedNodeId(
        ROOT_CANVAS_SCOPE_ID,
        "trial",
        id,
      )}"]`,
    );
  const parentBox = await node("parent").boundingBox();
  const continuationBox = await node("continuation").boundingBox();
  const sideBox = await node("side").boundingBox();

  expect(parentBox).not.toBeNull();
  expect(continuationBox).not.toBeNull();
  expect(sideBox).not.toBeNull();
  const center = (box: NonNullable<typeof parentBox>) =>
    box.x + box.width / 2;
  expect(center(continuationBox!)).toBeLessThan(center(parentBox!));
  expect(center(sideBox!)).toBeGreaterThan(center(parentBox!));
  expect(
    (center(continuationBox!) + center(sideBox!)) / 2,
  ).toBeCloseTo(center(parentBox!), 1);
  await canvas.screenshot({
    path: "test-results/unified-canvas-balanced-branches.png",
  });
});
