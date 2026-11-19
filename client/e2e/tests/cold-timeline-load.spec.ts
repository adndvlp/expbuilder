import { expect, test } from "../fixtures/test.fixture";
import { routeGraph, graph } from "../helpers/loopBranchGraph";
import type { TimelineItem } from "../../src/pages/ExperimentBuilder/modules/experiment-graph/types";

const populatedTimeline: TimelineItem[] = [
  { id: "welcome", type: "trial", name: "Welcome" },
  { id: "instructions", type: "trial", name: "Instructions" },
];

test("deduplicates cold workspace reads and keeps the persisted timeline on reload", async ({
  page,
}) => {
  let requestCount = 0;
  const fixture = routeGraph(
    page,
    "exp-cold-load",
    graph(populatedTimeline, {}, []),
  );
  await page.route("**/api/workspace/exp-cold-load", async (route) => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ json: fixture.response("exp-cold-load") });
  });

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/#/home/experiment/exp-cold-load/builder");

  const canvas = page.locator(".canvas-container");
  await expect(canvas.getByText("Welcome", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Instructions", { exact: true })).toBeVisible();
  expect(requestCount).toBe(1);

  await page.waitForTimeout(1000);
  await expect(canvas.getByText("Welcome", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Instructions", { exact: true })).toBeVisible();
  await expect(canvas.locator(".react-flow__node")).toHaveCount(2);

  await page.reload();
  await expect(canvas.getByText("Welcome", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Instructions", { exact: true })).toBeVisible();
  await expect(canvas.locator(".react-flow__node")).toHaveCount(2);
  expect(requestCount).toBe(2);

  await canvas.screenshot({
    path: "test-results/cold-timeline-load.png",
  });
});
