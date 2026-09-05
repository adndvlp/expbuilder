import { expect, test } from "../fixtures/test.fixture";
import type { Locator } from "@playwright/test";
import { graph, graphScope, routeGraph } from "../helpers/loopBranchGraph";
import type { TimelineItem } from "../../src/pages/ExperimentBuilder/modules/experiment-graph/types";
import { getScopedNodeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import { getLoopLayoutScopeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import { ROOT_CANVAS_SCOPE_ID } from "../../src/pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

const rootTimeline: TimelineItem[] = [
  { id: "welcome", type: "trial", name: "Welcome" },
  {
    id: "instructions",
    type: "trial",
    name: "Instructions",
    branches: ["final-left", "loop-1", "final-right"],
  },
  { id: "final-left", type: "trial", name: "Final1" },
  { id: "loop-1", type: "loop", name: "Loop1", trials: ["question"] },
  { id: "final-right", type: "trial", name: "Final1" },
];

const outerTimeline: TimelineItem[] = [
  {
    id: "question",
    type: "trial",
    name: "Question",
    branches: ["nested-loop", "task-2"],
  },
  {
    id: "nested-loop",
    type: "loop",
    name: "Nested Loop",
    branches: ["final"],
    trials: ["nested-task", "loca"],
  },
  {
    id: "task-2",
    type: "trial",
    name: "Task 2",
    branches: ["right-task"],
  },
  {
    id: "right-task",
    type: "trial",
    name: "Task",
    branches: ["end"],
  },
  {
    id: "end",
    type: "trial",
    name: "End",
    branches: ["end-left", "end-middle", "end-right"],
  },
  {
    id: "end-left",
    type: "trial",
    name: "Trial",
    branches: ["final"],
  },
  {
    id: "end-middle",
    type: "trial",
    name: "End2",
    branches: ["final"],
  },
  {
    id: "end-right",
    type: "trial",
    name: "Trial",
    branches: ["final"],
  },
  { id: "final", type: "trial", name: "Trial" },
];

const nestedTimeline: TimelineItem[] = [
  { id: "nested-task", type: "trial", name: "Task" },
  { id: "loca", type: "trial", name: "Loca" },
];

async function pathCrossesNode(path: Locator, node: Locator) {
  const box = await node.boundingBox();
  if (!box) return false;

  return path.evaluate((element, bounds) => {
    const svgPath = element as SVGPathElement;
    const matrix = svgPath.getScreenCTM();
    if (!matrix) return false;

    const length = svgPath.getTotalLength();
    for (let sample = 0; sample <= 100; sample += 1) {
      const point = svgPath.getPointAtLength((length * sample) / 100);
      const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(
        matrix,
      );
      if (
        screenPoint.x > bounds.x &&
        screenPoint.x < bounds.x + bounds.width &&
        screenPoint.y > bounds.y &&
        screenPoint.y < bounds.y + bounds.height
      ) {
        return true;
      }
    }
    return false;
  }, box);
}

test("renders the complete branching loop topology in one canvas", async ({
  page,
}) => {
  await routeGraph(
    page,
    "exp-complex",
    graph(
      rootTimeline,
      {
        "loop-1": graphScope("loop-1", null, outerTimeline),
        "nested-loop": graphScope("nested-loop", "loop-1", nestedTimeline),
      },
      [],
    ),
  );
  await page.route("**/api/trials-metadata/exp-complex", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ timeline: rootTimeline }),
    }),
  );
  await page.route("**/api/loop-trials-metadata/exp-complex/*", (route) => {
    const isNested = route.request().url().endsWith("/nested-loop");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        trialsMetadata: isNested ? nestedTimeline : outerTimeline,
      }),
    });
  });

  await page.setViewportSize({ width: 2200, height: 1400 });
  await page.goto("/#/home/experiment/exp-complex/builder");
  const canvas = page.locator(".canvas-container");
  await expect(canvas.locator(".react-flow")).toHaveCount(1);

  await canvas
    .locator(".loop-node", { hasText: "Loop1" })
    .getByTitle("Expand loop")
    .click();
  await canvas
    .locator(".loop-node", { hasText: "Nested Loop" })
    .getByTitle("Expand loop")
    .click();
  await expect(canvas.getByText("Loca", { exact: true })).toBeVisible();
  await expect(canvas.locator(".react-flow__node")).toHaveCount(16);
  await expect(canvas.locator(".react-flow__edge")).toHaveCount(18);
  await page.waitForTimeout(500);

  const outerScope = getLoopLayoutScopeId("loop-1");
  const nestedScope = getLoopLayoutScopeId("nested-loop");
  const node = (id: string) =>
    canvas.locator(`.react-flow__node[data-id="${id}"]`);
  const outerMarker = node(
    getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "loop-1"),
  );
  const nestedMarker = node(getScopedNodeId(outerScope, "loop", "nested-loop"));
  const nestedTask = node(getScopedNodeId(nestedScope, "trial", "nested-task"));
  const final = node(getScopedNodeId(outerScope, "trial", "final"));
  const mergeParents = [
    node(getScopedNodeId(nestedScope, "trial", "loca")),
    node(getScopedNodeId(outerScope, "trial", "end-left")),
    node(getScopedNodeId(outerScope, "trial", "end-middle")),
    node(getScopedNodeId(outerScope, "trial", "end-right")),
  ];
  const [outerBox, nestedBox, taskBox, finalBox, ...parentBoxes] =
    await Promise.all([
      outerMarker.boundingBox(),
      nestedMarker.boundingBox(),
      nestedTask.boundingBox(),
      final.boundingBox(),
      ...mergeParents.map((parent) => parent.boundingBox()),
    ]);

  expect(outerBox!.x).toBeLessThan(nestedBox!.x);
  expect(nestedBox!.x).toBeLessThan(taskBox!.x);
  expect(finalBox!.y).toBeGreaterThan(
    Math.max(...parentBoxes.map((box) => box!.y)),
  );

  const strokes = await canvas
    .locator(".react-flow__edge-path")
    .evaluateAll((paths) => paths.map((path) => getComputedStyle(path).stroke));
  expect(
    strokes.filter((stroke) => stroke === "rgb(47, 128, 237)"),
  ).toHaveLength(2);
  const flowStrokes = strokes.filter(
    (stroke) => stroke !== "rgb(47, 128, 237)",
  );
  expect(flowStrokes).toHaveLength(16);
  expect(new Set(flowStrokes).size).toBeGreaterThan(3);
  expect(flowStrokes).toContain("rgb(102, 112, 133)");
  await expect(canvas.locator(".react-flow__edge.animated")).toHaveCount(2);

  const questionId = getScopedNodeId(outerScope, "trial", "question");
  const leftFinal = node(
    getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "final-left"),
  );
  const branchBoxes = await Promise.all([
    node(
      getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "instructions"),
    ).boundingBox(),
    node(questionId).boundingBox(),
    leftFinal.boundingBox(),
    node(
      getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", "final-right"),
    ).boundingBox(),
    node(getScopedNodeId(outerScope, "trial", "end-right")).boundingBox(),
  ]);
  const [instructionsBox, questionBox, leftBox, rightBox, rightTerminalBox] =
    branchBoxes.map((box) => box!);
  expect(Math.abs(instructionsBox.x - questionBox.x)).toBeLessThan(2);
  expect(leftBox.x + leftBox.width).toBeLessThan(outerBox!.x);
  expect(rightBox.x).toBeGreaterThan(
    rightTerminalBox.x + rightTerminalBox.width,
  );
  const outerMarkerId = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "loop-1");
  const outerCircuitEdgeId = [
    "edge",
    encodeURIComponent("loop-return"),
    encodeURIComponent(outerMarkerId),
    encodeURIComponent(outerMarkerId),
  ].join("::");
  const outerCircuit = canvas.locator(
    `[data-testid="rf__edge-${outerCircuitEdgeId}"] .react-flow__edge-path`,
  );
  await expect(outerCircuit).toHaveCount(1);
  expect(await pathCrossesNode(outerCircuit, leftFinal)).toBe(false);

  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);
  await canvas.screenshot({
    path: "test-results/unified-canvas-complex.png",
  });
});
