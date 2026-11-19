import { canvasNode } from "../helpers/canvasNode";
import { expect, test } from "../fixtures/test.fixture";
import {
  expectBalancedFan,
  expectBelowAndCentered,
  expectPathAvoidsNodes,
} from "../helpers/layoutAssertions";
import {
  branchEdge,
  edgeId,
  graph,
  routeGraph,
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
    { id: 2, type: "trial", name: "New Trial 1", branches: [6] },
    { id: 3, type: "trial", name: "New Trial 2", branches: [] },
    {
      id: "loop_4",
      type: "loop",
      name: "Loop 1",
      trials: [6, 7, 8],
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
  const edgesBefore = [
    branchEdge(1, 2, null, null),
    branchEdge(1, 3, null, null),
    branchEdge(2, 6, null, "loop_4"),
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
  const fixture = routeGraph(page, experimentId, before);
  const expectedRevision = fixture.document(experimentId).authoringRevision;

  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(`/#/home/experiment/${experimentId}/builder`);
  const canvas = page.locator(".canvas-container");
  const marker = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "loop", "loop_4");
  const loopScope = getLoopLayoutScopeId("loop_4");
  const source = getScopedNodeId(loopScope, "trial", 8);
  const exit = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", 5);
  const sibling = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", 3);
  const exitSource = getScopedNodeId(loopScope, "trial", 6);
  const localLeft = getScopedNodeId(loopScope, "trial", 7);
  const localRight = getScopedNodeId(loopScope, "trial", 8);
  const parent = getScopedNodeId(ROOT_CANVAS_SCOPE_ID, "trial", 2);
  const edge = (from: string, to: string) =>
    canvas.locator(`[data-testid="rf__edge-${edgeId(from, to)}"]`);
  const node = (id: string) => canvasNode(canvas, id);
  const path = (from: string, to: string) =>
    edge(from, to).locator(".react-flow__edge-path");

  await canvasNode(canvas, marker).getByTitle("Expand loop").click();
  await expect(edge(parent, exitSource)).toHaveCount(1);
  await expect(edge(parent, marker)).toHaveCount(0);
  const sourceNode = canvasNode(canvas, source);
  await sourceNode.click();
  await sourceNode.getByTitle("Add branch").click();
  await page.getByRole("checkbox", { name: "Loop 1" }).check();
  const creation = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/workspace/${experimentId}/commands`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  const response = await creation;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({
    kind: "addChild",
    args: {
      sourceId: "8",
      scopeId: "loop_4",
      mode: "parallel",
      layoutBefore: expect.any(Object),
    },
    expectedRevision,
  });
  const { layoutBefore } = response.request().postDataJSON().args;
  expect(Object.keys(layoutBefore).sort()).toEqual([
    "1",
    "2",
    "3",
    "5",
    "6",
    "7",
    "8",
    "loop_4",
  ]);
  for (const position of Object.values(layoutBefore)) {
    expect(position).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  }
  const saved = await response.json();
  const created = getScopedNodeId(loopScope, "trial", saved.result);
  await expect(canvasNode(canvas, created)).toBeVisible();
  expect(
    saved.document.trials.find(
      (trial: { id: number }) => trial.id === saved.result,
    ),
  ).toMatchObject({ name: "New Trial 7", parentLoopId: "loop_4" });
  expect(
    saved.document.trials.find((trial: { id: number }) => trial.id === 8)
      .defaultNextTrialId,
  ).toBe(saved.result);
  expect(
    saved.document.trials.find((trial: { id: number }) => trial.id === 3)
      .branches,
  ).toEqual([]);
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

  await canvasNode(canvas, marker).getByTitle("Collapse loop").click();
  await expect(edge(marker, exit)).toHaveCount(1);
  await expect(edge(sibling, exit)).toHaveCount(0);
  await expectBelowAndCentered(canvas, marker, exit);
  await canvas.screenshot({
    path: "test-results/loop-branch-after-insertion-collapsed.png",
  });
});
