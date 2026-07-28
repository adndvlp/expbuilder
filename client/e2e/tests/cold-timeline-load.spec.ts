import { expect, test } from "../fixtures/test.fixture";

const populatedTimeline = [
  { id: "welcome", type: "trial", name: "Welcome" },
  { id: "instructions", type: "trial", name: "Instructions" },
];

test("keeps the populated timeline when the older cold read finishes empty", async ({
  page,
}) => {
  let requestCount = 0;
  await page.route("**/api/trials-metadata/exp-cold-load", async (route) => {
    requestCount += 1;
    const isOlderColdRead = requestCount === 1;
    if (isOlderColdRead) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        timeline: isOlderColdRead ? [] : populatedTimeline,
      }),
    });
  });

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/#/home/experiment/exp-cold-load/builder");

  const canvas = page.locator(".canvas-container");
  await expect(canvas.getByText("Welcome", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Instructions", { exact: true })).toBeVisible();
  await expect.poll(() => requestCount).toBeGreaterThanOrEqual(2);

  await page.waitForTimeout(1000);
  await expect(canvas.getByText("Welcome", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Instructions", { exact: true })).toBeVisible();
  await expect(canvas.locator(".react-flow__node")).toHaveCount(2);

  await canvas.screenshot({
    path: "test-results/cold-timeline-load.png",
  });
});
