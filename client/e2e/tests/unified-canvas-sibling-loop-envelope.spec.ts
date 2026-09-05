import { expect, test } from "../fixtures/test.fixture";
import type { Locator } from "@playwright/test";
import { getLoopLayoutScopeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import { getScopedNodeId } from "../../src/pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";
import { ROOT_CANVAS_SCOPE_ID } from "../../src/pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

const trial = (id: string, name: string, branches: string[] = []) => ({
  id,
  type: "trial",
  name,
  branches,
});

const loop = (id: string, name: string, trials: string[]) => ({
  id,
  type: "loop",
  name,
  trials,
});

const rootTimeline = [
  trial("start", "New Trial", ["left", "right"]),
  trial("left", "New Trial 1", ["outer"]),
  trial("right", "New Trial 2", ["right-a", "right-b"]),
  trial("right-a", "New Trial 16", ["right-tail"]),
  trial("right-tail", "New Trial 15"),
  trial("right-b", "New Trial 17"),
  loop("outer", "Loop 1", [
    "outer-source",
    "outer-left",
    "nested",
    "outer-right",
  ]),
  trial("outer-exit", "New Trial 6"),
  trial("nested-exit", "New Trial 9"),
];

const outerTimeline = [
  trial("outer-source", "New Trial 3", [
    "outer-left",
    "outer-exit",
    "nested",
    "outer-right",
  ]),
  trial("outer-left", "New Trial 4"),
  loop("nested", "Nested Loop 1", ["nested-source", "nested-left"]),
  trial("outer-right", "New Trial 10"),
];

const nestedTimeline = [
  trial("nested-source", "New Trial 5", ["nested-left", "nested-exit"]),
  trial("nested-left", "New Trial 7"),
];

const edge = (
  sourceId: string,
  targetId: string,
  sourceOwnerId: string | null,
  targetOwnerId: string | null,
  exitedLoopIds: string[] = [],
) => ({
  sourceId,
  targetId,
  sourceOwnerId,
  targetOwnerId,
  exitedLoopIds,
});

const graphSnapshot = {
  revision: "sibling-loop-envelope-regression",
  root: { scopeId: null, parentScopeId: null, items: rootTimeline },
  scopes: {
    outer: {
      scopeId: "outer",
      parentScopeId: null,
      items: outerTimeline,
    },
    nested: {
      scopeId: "nested",
      parentScopeId: "outer",
      items: nestedTimeline,
    },
  },
  edges: [
    edge("start", "left", null, null),
    edge("start", "right", null, null),
    edge("left", "outer", null, null),
    edge("right", "right-a", null, null),
    edge("right", "right-b", null, null),
    edge("right-a", "right-tail", null, null),
    edge("outer-source", "outer-left", "outer", "outer"),
    edge("outer-source", "outer-exit", "outer", null, ["outer"]),
    edge("outer-source", "nested", "outer", "outer"),
    edge("outer-source", "outer-right", "outer", "outer"),
    edge("nested-source", "nested-left", "nested", "nested"),
    edge("nested-source", "nested-exit", "nested", null, ["nested", "outer"]),
  ],
  diagnostics: [],
};

const node = (canvas: Locator, id: string) =>
  canvas.locator(`.react-flow__node[data-id="${id}"]`);

async function horizontalBounds(canvas: Locator, nodeIds: string[]) {
  const boxes = await Promise.all(
    nodeIds.map((nodeId) => node(canvas, nodeId).boundingBox()),
  );
  boxes.forEach((box, index) =>
    expect(box, `missing visible node ${nodeIds[index]}`).not.toBeNull(),
  );
  return {
    left: Math.min(...boxes.map((box) => box!.x)),
    right: Math.max(...boxes.map((box) => box!.x + box!.width)),
  };
}

async function expectSeparated(
  canvas: Locator,
  leftNodeIds: string[],
  rightNodeIds: string[],
) {
  await expect
    .poll(async () => {
      const [leftBounds, rightBounds] = await Promise.all([
        horizontalBounds(canvas, leftNodeIds),
        horizontalBounds(canvas, rightNodeIds),
      ]);
      return rightBounds.left - leftBounds.right;
    })
    .toBeGreaterThan(0);
}

const edgeId = (kind: string, source: string, target: string) =>
  ["edge", kind, source, target].map(encodeURIComponent).join("::");

test("keeps a branched sibling outside the complete loop envelope", async ({
  page,
}) => {
  await page.route("**/api/experiment-graph/exp-sibling-envelope", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ graph: graphSnapshot }),
    }),
  );
  await page.route("**/api/trials-metadata/exp-sibling-envelope", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ timeline: rootTimeline }),
    }),
  );
  await page.route(
    "**/api/loop-trials-metadata/exp-sibling-envelope/*",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          trialsMetadata: route.request().url().endsWith("/nested")
            ? nestedTimeline
            : outerTimeline,
        }),
      }),
  );

  await page.setViewportSize({ width: 2200, height: 1400 });
  await page.goto("/#/home/experiment/exp-sibling-envelope/builder");
  const canvas = page.locator(".canvas-container");
  const rootNodeId = (type: "trial" | "loop", id: string) =>
    getScopedNodeId(ROOT_CANVAS_SCOPE_ID, type, id);
  const rightBranchIds = ["right", "right-a", "right-tail", "right-b"].map(
    (id) => rootNodeId("trial", id),
  );

  await expectSeparated(
    canvas,
    [
      rootNodeId("trial", "left"),
      rootNodeId("loop", "outer"),
      rootNodeId("trial", "outer-exit"),
      rootNodeId("trial", "nested-exit"),
    ],
    rightBranchIds,
  );
  await page.mouse.move(10, 10);
  await canvas.screenshot({
    path: "test-results/unified-canvas-sibling-loop-envelope-collapsed.png",
  });

  await canvas
    .locator(".loop-node", { hasText: "Loop 1" })
    .getByTitle("Expand loop")
    .click();
  await canvas
    .locator(".loop-node", { hasText: "Nested Loop 1" })
    .getByTitle("Expand loop")
    .click();
  await expect(canvas.getByText("New Trial 7", { exact: true })).toBeVisible();

  const outerScope = getLoopLayoutScopeId("outer");
  const nestedScope = getLoopLayoutScopeId("nested");
  await expectSeparated(
    canvas,
    [
      rootNodeId("trial", "left"),
      rootNodeId("loop", "outer"),
      getScopedNodeId(outerScope, "trial", "outer-source"),
      getScopedNodeId(outerScope, "trial", "outer-left"),
      getScopedNodeId(outerScope, "loop", "nested"),
      getScopedNodeId(nestedScope, "trial", "nested-source"),
      getScopedNodeId(nestedScope, "trial", "nested-left"),
      getScopedNodeId(outerScope, "trial", "outer-right"),
      rootNodeId("trial", "outer-exit"),
      rootNodeId("trial", "nested-exit"),
    ],
    rightBranchIds,
  );

  const outerMarkerId = rootNodeId("loop", "outer");
  const circuit = canvas.locator(
    `[data-testid="rf__edge-${edgeId(
      "loop-return",
      outerMarkerId,
      outerMarkerId,
    )}"] .react-flow__edge-path`,
  );
  await expect(circuit).toHaveCount(1);
  await expect
    .poll(async () => {
      const [circuitBox, rightBounds] = await Promise.all([
        circuit.boundingBox(),
        horizontalBounds(canvas, rightBranchIds),
      ]);
      expect(circuitBox).not.toBeNull();
      return rightBounds.left - (circuitBox!.x + circuitBox!.width);
    })
    .toBeGreaterThan(0);

  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);
  await canvas.screenshot({
    path: "test-results/unified-canvas-sibling-loop-envelope.png",
  });
});
