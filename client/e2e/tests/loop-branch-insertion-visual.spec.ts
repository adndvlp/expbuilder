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

test("inserting another loop trial never reconnects an unrelated sibling", async ({
  page,
}) => {
  const experimentId = "exp-loop-branch-insertion";
  const rootBefore: TimelineItem[] = [
    { id: 1, type: "trial", name: "New Trial", branches: [2, 3] },
    { id: 2, type: "trial", name: "New Trial 1", branches: ["loop_4"] },
    { id: 3, type: "trial", name: "New Trial 2", branches: [] },
    {
      id: "loop_4",
      type: "loop",
      name: "Loop 1",
      trials: [6, 7, 8],
      branches: [],
    },
    { id: 5, type: "trial", name: "New Trial 6", branches: [] },
  ];
  const loopBefore: TimelineItem[] = [
    {
      id: 6,
      type: "trial",
      name: "New Trial 3",
      parentLoopId: "loop_4",
      branches: [7, 8, 5],
    },
    {
      id: 7,
      type: "trial",
      name: "New Trial 4",
      parentLoopId: "loop_4",
      branches: [],
    },
    {
      id: 8,
      type: "trial",
      name: "New Trial 5",
      parentLoopId: "loop_4",
      branches: [],
    },
  ];
  const rootAfter = rootBefore.map((item) =>
    item.id === "loop_4" ? { ...item, trials: [6, 7, 8, 9] } : item,
  );
  const loopAfter = [
    ...loopBefore.map((item) =>
      item.id === 8 ? { ...item, branches: [9] } : item,
    ),
    {
      id: 9,
      type: "trial" as const,
      name: "New Trial 7",
      parentLoopId: "loop_4",
      branches: [],
    },
  ];
  const edgesBefore = [
    branchEdge(1, 2, null, null),
    branchEdge(1, 3, null, null),
    branchEdge(2, "loop_4", null, null),
    branchEdge(6, 7, "loop_4", "loop_4"),
    branchEdge(6, 8, "loop_4", "loop_4"),
    branchEdge(6, 5, "loop_4", null, ["loop_4"]),
  ];
  const before = graph(
    rootBefore,
    {
      loop_4: { scopeId: "loop_4", parentScopeId: null, items: loopBefore },
    },
    edgesBefore,
  );
  const after = graph(
    rootAfter,
    {
      loop_4: { scopeId: "loop_4", parentScopeId: null, items: loopAfter },
    },
    [...edgesBefore, branchEdge(8, 9, "loop_4", "loop_4")],
  );
  let submittedBody: unknown;
  await page.route(`**/api/experiment-graph/${experimentId}`, (route) =>
    route.fulfill(fulfillGraph(before)),
  );
  await page.route(`**/api/loop-branch-levels/${experimentId}/8`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        levels: [
          { scopeId: "loop_4", name: "Loop 1", branchCount: 0 },
          { scopeId: null, name: "Main timeline", branchCount: 0 },
        ],
      }),
    }),
  );
  await page.route(`**/api/trial/${experimentId}/8`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ trial: loopBefore[2] }),
    }),
  );
  await page.route(`**/api/loop-branch/${experimentId}`, async (route) => {
    submittedBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        trial: {
          ...loopAfter[3],
          plugin: "html-keyboard-response",
          parameters: {},
          trialCode: "",
        },
        graph: after,
      }),
    });
  });

  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(`/#/home/experiment/${experimentId}/builder`);
  const canvas = page.locator(".canvas-container");
  const marker = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "loop_4");
  const loopScope = getLoopLayoutScopeId("loop_4");
  const source = getScopedNodeId(loopScope, "trial", 8);
  const created = getScopedNodeId(loopScope, "trial", 9);
  const exit = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", 5);
  const sibling = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", 3);
  const exitSource = getScopedNodeId(loopScope, "trial", 6);
  const localLeft = getScopedNodeId(loopScope, "trial", 7);
  const localRight = getScopedNodeId(loopScope, "trial", 8);
  const parent = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", 2);
  const edge = (from: string, to: string) =>
    canvas.locator(`[data-testid="rf__edge-${edgeId(from, to)}"]`);
  const node = (id: string) =>
    canvas.locator(`.react-flow__node[data-id="${id}"]`);
  const path = (from: string, to: string) =>
    edge(from, to).locator(".react-flow__edge-path");

  await canvas
    .locator(`.react-flow__node[data-id="${marker}"]`)
    .getByTitle("Expand loop")
    .click();
  await expect(edge(parent, exitSource)).toHaveCount(1);
  await expect(edge(parent, marker)).toHaveCount(0);
  const sourceNode = canvas.locator(`.react-flow__node[data-id="${source}"]`);
  await sourceNode.click();
  await sourceNode.getByTitle("Add branch").click();
  await page.getByRole("checkbox", { name: "Loop 1" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    canvas.locator(`.react-flow__node[data-id="${created}"]`),
  ).toBeVisible();
  expect(submittedBody).toEqual({
    sourceTrialId: 8,
    targetScopeId: "loop_4",
    mode: "parallel",
    expectedRevision: "visual-regression",
  });
  await expect(edge(source, created)).toHaveCount(1);
  await expect(edge(exitSource, exit)).toHaveCount(1);
  await expect(edge(sibling, exit)).toHaveCount(0);
  await expectBalancedFan(
    canvas,
    exitSource,
    [localLeft, localRight, exit],
    [exit],
  );
  await expectPathAvoidsNodes(path(exitSource, exit), [
    node(localLeft),
    node(localRight),
    node(created),
  ]);
  await canvas.screenshot({
    path: "test-results/loop-branch-after-insertion-expanded.png",
  });

  await canvas
    .locator(`.react-flow__node[data-id="${marker}"]`)
    .getByTitle("Collapse loop")
    .click();
  await expect(edge(marker, exit)).toHaveCount(1);
  await expect(edge(sibling, exit)).toHaveCount(0);
  await expectBelowAndCentered(canvas, marker, exit);
  await canvas.screenshot({
    path: "test-results/loop-branch-after-insertion-collapsed.png",
  });
});
