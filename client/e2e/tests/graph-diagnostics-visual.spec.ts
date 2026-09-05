import { expect, test } from "../fixtures/test.fixture";
import { fulfillGraph, graph } from "../helpers/loopBranchGraph";

test("[TL-13] reports a dangling canonical edge instead of silently hiding it", async ({
  page,
}) => {
  const experimentId = "exp-dangling-branch";
  const snapshot = graph(
    [
      {
        id: "source",
        type: "trial",
        name: "Dangling Source",
        branches: ["missing-target"],
      },
    ],
    {},
    [],
  );
  snapshot.diagnostics = [
    {
      code: "BRANCH_TARGET_NOT_FOUND",
      sourceId: "source",
      targetId: "missing-target",
    },
  ];
  await page.route(`**/api/experiment-graph/${experimentId}`, (route) =>
    route.fulfill(fulfillGraph(snapshot)),
  );

  await page.goto(`/#/home/experiment/${experimentId}/builder`);

  const error = page.getByTestId("experiment-graph-error");
  await expect(error).toHaveAttribute("role", "alert");
  await expect(error).toContainText("BRANCH_TARGET_NOT_FOUND");
  await expect(error).toContainText("source → missing-target");
  await expect(
    page.locator('[data-testid^="rf__edge-edge::flow::"]'),
  ).toHaveCount(0);
  await page.locator(".canvas-container").screenshot({
    path: "test-results/graph-dangling-edge-error.png",
  });
});
